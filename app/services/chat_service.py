from datetime import datetime, timezone
from typing import Set

import httpx
try:
    import jmespath
except ImportError:  # pragma: no cover - optional dependency
    jmespath = None
from sqlalchemy.orm import Session

from app.chatterbot_ext.manager import chatbot_manager
from app.crud.intent import list_intents
from app.crud.project import get_project
from app.models import BotFallback, Intent, IntentBranch, IntentFallback, IntentResponse
from app.schemas.chat import ChatRequest, ChatResponse, ChatResponsePart
from app.services.state import conversation_state
from app.utils.curl import parse_curl_command
from app.utils.language import detect_language


def get_chat_response(db: Session, project_id: int, chat_in: ChatRequest) -> ChatResponse:
    project = get_project(db, project_id)
    if not project.intents:
        # Ensure relationships are loaded if accessed lazily
        db.refresh(project)

    target_language = chat_in.language or detect_language(
        chat_in.message,
        allowed=project.supported_languages,
        default=project.default_language,
    )
    normalized_message = chat_in.message.strip().lower()
    session_id = chat_in.session_id or None
    active_context_names: set[str] = set()
    if session_id:
        active_context_names = set(conversation_state.get_active_contexts(session_id))

    all_intents = list_intents(db, project_id)
    active_normal_intents = [intent for intent in all_intents if intent.is_active and not intent.is_fallback]
    active_fallback_intents = [intent for intent in all_intents if intent.is_active and intent.is_fallback]
    intents_by_id = {intent.id: intent for intent in all_intents}
    welcome_intent = next((intent for intent in active_normal_intents if intent.is_default_welcome), None)

    global_fallback = next(
        (fb for fb in project.fallbacks if fb.language == target_language),
        None,
    )

    candidate_intents = active_normal_intents
    last_success_intent_id = None
    if session_id:
        followup_ids, last_success_intent_id = conversation_state.get_followups(session_id)
        if followup_ids:
            candidate_intents = [
                intent for intent in active_normal_intents if intent.id in followup_ids
            ]
            if not candidate_intents:
                conversation_state.clear(session_id)
        if not followup_ids or not candidate_intents:
            candidate_intents = [
                intent for intent in active_normal_intents if intent.parent_intent_id is None
            ]
    else:
        candidate_intents = [
            intent for intent in active_normal_intents if intent.parent_intent_id is None
        ]

    candidate_intents = [
        intent
        for intent in candidate_intents
        if _intent_matches_contexts(intent, active_context_names)
    ]

    if not candidate_intents:
        candidate_intents = (
            [
                intent
                for intent in active_normal_intents
                if _intent_matches_contexts(intent, active_context_names)
            ]
            if active_context_names
            else active_normal_intents
        )

    response_parts: list[ChatResponsePart]
    context_updates: list[dict]
    result_intent: Intent | None = None
    is_fallback_response = False
    confidence = 0.0

    if normalized_message == "__welcome__" and welcome_intent:
        result_payload = {
            "intent": welcome_intent,
            "response_text": None,
            "confidence": 1.0,
            "is_fallback": False,
        }
    elif not candidate_intents:
        result_payload = {
            "intent": None,
            "response_text": global_fallback.text if global_fallback else None,
            "confidence": 0.0,
            "is_fallback": True,
        }
    else:
        result_payload = chatbot_manager.get_response(
            db=db,
            project_id=project_id,
            language=target_language,
            message=chat_in.message,
            fallback=global_fallback,
            intents=candidate_intents,
            threshold=project.confidence_threshold,
        )

    result_intent = result_payload.get("intent")
    confidence = result_payload.get("confidence", 0.0) or 0.0
    is_fallback_response = bool(result_payload.get("is_fallback")) or result_intent is None

    fallback_intent: Intent | None = None
    fallback_response_parts: list[ChatResponsePart] = []
    if is_fallback_response:
        fallback_intent = _select_fallback_intent(
            fallback_intents=active_fallback_intents,
            active_contexts=active_context_names,
            last_success_intent_id=last_success_intent_id,
            intents_by_id=intents_by_id,
        )
        if fallback_intent:
            result_intent = fallback_intent
        else:
            result_intent = None
        payload_parts = result_payload.get("response_parts")
        if isinstance(payload_parts, list):
            for part in payload_parts:
                if isinstance(part, dict):
                    try:
                        fallback_response_parts.append(ChatResponsePart(**part))
                    except TypeError:
                        continue
        if not fallback_response_parts:
            fallback_response_parts = _build_fallback_response_parts(global_fallback)

    response_parts = []
    context_updates = []
    if result_intent:
        response_parts, context_updates = _build_intent_responses(
            db,
            result_intent,
            target_language,
            chat_in.message,
            session_id,
        )
    if not response_parts:
        if fallback_response_parts:
            response_parts = fallback_response_parts
        else:
            fallback_text = None
            if is_fallback_response:
                fallback_text = result_payload.get("response_text")
            if not fallback_text and global_fallback:
                fallback_text = global_fallback.text
            if not fallback_text:
                fallback_text = "I didn't quite get that. Could you rephrase?"
            response_parts = [ChatResponsePart(type="text", text=fallback_text)]

    if session_id:
        for update in context_updates:
            conversation_state.update_context(session_id, update)

        if result_intent and not is_fallback_response:
            branch_targets = _evaluate_branches(result_intent, conversation_state.get_context(session_id))
            branch_targets = {target for target in branch_targets if target in intents_by_id and not intents_by_id[target].is_fallback}
            if branch_targets:
                conversation_state.set_followups(
                    session_id,
                    branch_targets,
                    last_successful_intent=result_intent.id,
                )
            else:
                active_children = [
                    child.id
                    for child in result_intent.children
                    if child.is_active and not child.is_fallback
                ]
                conversation_state.set_followups(
                    session_id,
                    active_children,
                    last_successful_intent=result_intent.id,
                )
        elif is_fallback_response:
            if _should_reset_to_root_after_fallback(result_intent, last_success_intent_id):
                conversation_state.reset_to_root(session_id)
            else:
                conversation_state.touch(session_id)
        else:
            conversation_state.clear(session_id)

        new_output_contexts = (
            _collect_output_contexts(result_intent)
            if result_intent
            else []
        )
        conversation_state.apply_output_contexts(session_id, new_output_contexts)

    primary_text = next(
        (
            part.text
            for part in response_parts
            if part.type == "text" and part.text
        ),
        result_payload.get("response_text"),
    )

    return ChatResponse(
        project_id=project_id,
        intent_id=result_intent.id if result_intent else None,
        response=primary_text,
        responses=response_parts,
        language=target_language,
        confidence=confidence,
        is_fallback=is_fallback_response,
        timestamp=datetime.now(timezone.utc),
    )


def _select_fallback_intent(
    fallback_intents: list[Intent],
    active_contexts: set[str],
    last_success_intent_id: int | None,
    intents_by_id: dict[int, Intent],
) -> Intent | None:
    if not fallback_intents:
        return None
    matched = [
        intent
        for intent in fallback_intents
        if _intent_matches_contexts(intent, active_contexts)
    ]
    if not matched:
        matched = [intent for intent in fallback_intents if not intent.input_contexts]
    if not matched:
        return None

    if last_success_intent_id:
        lineage = set(_intent_lineage(last_success_intent_id, intents_by_id))
        scoped = [
            intent
            for intent in matched
            if intent.id == last_success_intent_id
            or intent.parent_intent_id in lineage
        ]
        if scoped:
            matched = scoped

    return max(matched, key=lambda item: _intent_depth(item, intents_by_id))


def _intent_depth(intent: Intent, intents_by_id: dict[int, Intent]) -> int:
    depth = 0
    current = intent
    visited: set[int] = set()
    while current.parent_intent_id:
        if current.parent_intent_id in visited:
            break
        visited.add(current.parent_intent_id)
        parent = intents_by_id.get(current.parent_intent_id)
        if not parent:
            break
        depth += 1
        current = parent
    return depth


def _intent_lineage(intent_id: int, intents_by_id: dict[int, Intent]) -> list[int]:
    lineage: list[int] = []
    current_id = intent_id
    visited: set[int] = set()
    while current_id and current_id not in visited:
        visited.add(current_id)
        lineage.append(current_id)
        current = intents_by_id.get(current_id)
        if not current or current.parent_intent_id is None:
            break
        current_id = current.parent_intent_id
    return lineage


def _should_reset_to_root_after_fallback(
    fallback_intent: Intent | None,
    last_success_intent_id: int | None,
) -> bool:
    if fallback_intent is None:
        return True
    if last_success_intent_id is None:
        return not fallback_intent.input_contexts
    if fallback_intent.id == last_success_intent_id:
        return False
    if fallback_intent.parent_intent_id == last_success_intent_id:
        return False
    if fallback_intent.input_contexts:
        return False
    return fallback_intent.parent_intent_id is None



def _build_fallback_response_parts(fallback: BotFallback | IntentFallback | None) -> list[ChatResponsePart]:
    if not fallback:
        return []
    parts: list[ChatResponsePart] = []
    for raw in fallback.serialized_parts():
        if not isinstance(raw, dict):
            continue
        try:
            parts.append(ChatResponsePart(**raw))
        except TypeError:
            continue
    return parts


def _intent_matches_contexts(intent: Intent, active_contexts: set[str]) -> bool:
    if not intent.input_contexts:
        return True
    required = {
        (ctx.name or "").strip().lower()
        for ctx in intent.input_contexts
        if ctx.name
    }
    if not required:
        return True
    return required.issubset(active_contexts)


def _collect_output_contexts(intent: Intent) -> list[tuple[str, int]]:
    contexts: list[tuple[str, int]] = []
    for ctx in intent.output_contexts:
        name = (ctx.name or "").strip()
        if not name:
            continue
        lifespan = ctx.lifespan_turns if ctx.lifespan_turns is not None else 0
        contexts.append((name.lower(), int(lifespan)))
    return contexts


def _build_intent_responses(
    db: Session,
    intent: Intent,
    language: str,
    user_utterance: str,
    session_id: str | None,
) -> tuple[list[ChatResponsePart], list[dict]]:
    parts: list[ChatResponsePart] = []
    context_updates: list[dict] = []
    for response in intent.responses:
        if response.language != language:
            continue
        rtype = (response.response_type or "text").lower()
        if rtype == "text":
            parts.append(ChatResponsePart(type="text", text=response.text or ""))
        elif rtype == "image":
            image_url = None
            if response.payload and isinstance(response.payload, dict):
                image_url = response.payload.get("url") or response.payload.get("image_url")
            image_url = image_url or response.text
            if image_url:
                parts.append(ChatResponsePart(type="image", image_url=image_url, text=response.text))
        elif rtype == "api":
            part, ctx = _execute_api_response(response, intent, language, user_utterance)
            parts.append(part)
            if ctx:
                context_updates.append(ctx)
    if intent.fulfillment and intent.fulfillment.enabled:
        part, ctx = _call_fulfillment(intent, language, user_utterance)
        parts.append(part)
        if ctx:
            context_updates.append(ctx)
    return parts, context_updates


def _execute_api_response(
    response: IntentResponse, intent: Intent, language: str, user_utterance: str
) -> tuple[ChatResponsePart, dict | None]:
    payload = response.payload or {}
    try:
        if isinstance(payload, dict) and "curl" in payload:
            _, request_config = parse_curl_command(payload["curl"])
        else:
            request_config = {
                "method": payload.get("method", "GET").upper(),
                "url": payload.get("url"),
                "headers": payload.get("headers", {}),
                "params": payload.get("params"),
                "json": payload.get("json"),
                "data": payload.get("data"),
            }
        method = request_config.pop("method", "GET")
        url = request_config.pop("url", None)
        if not url:
            raise ValueError("API response payload requires a URL")
        request_kwargs = {k: v for k, v in request_config.items() if v is not None}
        _enrich_payload_template(request_kwargs, intent, language, user_utterance)
        with httpx.Client(timeout=10.0) as client:
            resp = client.request(method, url, **request_kwargs)
        try:
            body = resp.json()
        except ValueError:
            body = resp.text
        context_update = _build_context_update(payload, body, response.id)
        return ChatResponsePart(
            type="api",
            api_status=resp.status_code,
            api_response=body,
            api_headers=dict(resp.headers),
            text=response.text,
        ), context_update
    except Exception as exc:  # pylint: disable=broad-except
        return ChatResponsePart(
            type="api",
            api_status=None,
            api_response={"error": str(exc)},
            text="",
        ), None


def _call_fulfillment(intent: Intent, language: str, user_utterance: str) -> tuple[ChatResponsePart, dict | None]:
    fulfillment = intent.fulfillment
    if not fulfillment or not fulfillment.enabled or not fulfillment.url:
        return ChatResponsePart(type="api", api_status=None, api_response=None), None
    request_kwargs = {
        "method": fulfillment.method or "POST",
        "url": fulfillment.url,
        "headers": fulfillment.headers or {},
        "timeout": fulfillment.timeout_seconds or 10,
    }
    if fulfillment.payload_template:
        payload = _render_payload_template(fulfillment.payload_template, intent, language, user_utterance)
        if fulfillment.method.upper() == "GET":
            request_kwargs["params"] = payload
        else:
            request_kwargs["json"] = payload
    try:
        timeout = request_kwargs.pop("timeout", 10)
        with httpx.Client(timeout=timeout) as client:
            resp = client.request(**request_kwargs)
        try:
            body = resp.json()
        except ValueError:
            body = resp.text
        context_update = None
        if fulfillment.save_as:
            context_update = {fulfillment.save_as: body}
        return ChatResponsePart(
            type="api",
            api_status=resp.status_code,
            api_response=body,
            api_headers=dict(resp.headers),
            text="",
        ), context_update
    except Exception as exc:  # pylint: disable=broad-except
        return ChatResponsePart(
            type="api",
            api_status=None,
            api_response={"error": str(exc)},
            text="",
        ), None


def _render_payload_template(payload: dict, intent: Intent, language: str, user_utterance: str) -> dict:
    rendered: dict = {}
    for key, value in payload.items():
        if isinstance(value, str):
            rendered[key] = (
                value.replace("{{intent_id}}", str(intent.id))
                .replace("{{intent_name}}", intent.name)
                .replace("{{language}}", language)
                .replace("{{user_text}}", user_utterance)
            )
        elif isinstance(value, dict):
            rendered[key] = _render_payload_template(value, intent, language, user_utterance)
        else:
            rendered[key] = value
    return rendered


def _enrich_payload_template(request_kwargs: dict, intent: Intent, language: str, user_utterance: str) -> None:
    payload = request_kwargs.get("json") or request_kwargs.get("data")
    if isinstance(payload, dict):
        enriched = _render_payload_template(payload, intent, language, user_utterance)
        if "json" in request_kwargs:
            request_kwargs["json"] = enriched
        else:
            request_kwargs["data"] = enriched


def _build_context_update(payload: dict, body: object, response_id: int) -> dict | None:
    if not isinstance(payload, dict):
        return None
    save_key = payload.get("save_as")
    if save_key:
        return {str(save_key): body}
    return {f"api_response_{response_id}": body}


def _evaluate_branches(intent: Intent, context: dict) -> Set[int]:
    targets: Set[int] = set()
    if not jmespath:
        return targets
    for branch in intent.branches:
        try:
            result = jmespath.search(branch.expression, context)
        except Exception:  # pylint: disable=broad-except
            result = None
        truthy = bool(result)
        if truthy and branch.true_intent_id:
            targets.add(branch.true_intent_id)
        elif not truthy and branch.false_intent_id:
            targets.add(branch.false_intent_id)
    return targets
