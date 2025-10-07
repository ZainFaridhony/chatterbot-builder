from sqlalchemy.orm import Session, selectinload

from app.models import (
    BotProject,
    Intent,
    IntentBranch,
    IntentFulfillment,
    IntentResponse,
    IntentFallback,
    IntentInputContext,
    IntentOutputContext,
    IntentTrainingPhrase,
)
from app.schemas.intent import (
    IntentBranchCreate,
    IntentCreate,
    IntentFallbackCreate,
    IntentInputContextCreate,
    IntentOutputContextCreate,
    IntentUpdate,
)
from app.utils.exceptions import (
    IntentNotFoundError,
    InvalidIntentHierarchyError,
    LanguageNotSupportedError,
)


def get_intent(db: Session, project_id: int, intent_id: int) -> Intent:
    intent = (
        db.query(Intent)
        .options(
            selectinload(Intent.training_phrases),
            selectinload(Intent.responses),
            selectinload(Intent.children),
            selectinload(Intent.fulfillment),
            selectinload(Intent.branches),
            selectinload(Intent.input_contexts),
            selectinload(Intent.output_contexts),
            selectinload(Intent.fallbacks),
        )
        .filter(Intent.project_id == project_id, Intent.id == intent_id)
        .first()
    )
    if not intent:
        raise IntentNotFoundError(f"Intent {intent_id} not found for project {project_id}")
    return intent


def list_intents(db: Session, project_id: int) -> list[Intent]:
    return (
        db.query(Intent)
        .options(
            selectinload(Intent.training_phrases),
            selectinload(Intent.responses),
            selectinload(Intent.children),
            selectinload(Intent.fulfillment),
            selectinload(Intent.branches),
            selectinload(Intent.input_contexts),
            selectinload(Intent.output_contexts),
            selectinload(Intent.fallbacks),
        )
        .filter(Intent.project_id == project_id)
        .order_by(Intent.created_at.desc())
        .all()
    )


def create_intent(db: Session, project: BotProject, intent_in: IntentCreate) -> Intent:
    _validate_intent_flags(intent_in.is_fallback, intent_in.is_default_welcome)
    _validate_languages(project.supported_languages, intent_in)
    if intent_in.fallbacks:
        _validate_fallback_languages(project.supported_languages, intent_in.fallbacks)
    parent = _validate_parent(db, project.id, intent_in.parent_intent_id)
    intent = Intent(
        project_id=project.id,
        name=intent_in.name,
        description=intent_in.description,
        is_active=intent_in.is_active,
        is_fallback=intent_in.is_fallback,
        is_default_welcome=intent_in.is_default_welcome,
        parent_intent_id=parent.id if parent else None,
    )
    db.add(intent)
    db.flush()
    _upsert_training_phrases(intent, intent_in.training_phrases)
    _upsert_responses(intent, intent_in.responses)
    if intent_in.fulfillment:
        intent.fulfillment = IntentFulfillment(
            enabled=intent_in.fulfillment.enabled,
            url=intent_in.fulfillment.url,
            method=intent_in.fulfillment.method,
            headers=intent_in.fulfillment.headers,
            payload_template=intent_in.fulfillment.payload_template,
            timeout_seconds=intent_in.fulfillment.timeout_seconds,
            save_as=intent_in.fulfillment.save_as,
        )
    if intent_in.branches:
        _upsert_branches(intent, intent_in.branches)
    if intent_in.input_contexts:
        _upsert_input_contexts(intent, intent_in.input_contexts)
    if intent_in.output_contexts:
        _upsert_output_contexts(intent, intent_in.output_contexts)
    if intent_in.fallbacks:
        _upsert_intent_fallbacks(intent, intent_in.fallbacks)
    db.flush()
    if intent.is_default_welcome:
        _clear_default_welcome(db, project.id, exclude_id=intent.id)
    db.refresh(intent)
    return intent


def update_intent(
    db: Session, project: BotProject, intent: Intent, intent_in: IntentUpdate
) -> Intent:
    new_is_fallback = intent_in.is_fallback if intent_in.is_fallback is not None else intent.is_fallback
    new_is_default_welcome = (
        intent_in.is_default_welcome
        if intent_in.is_default_welcome is not None
        else intent.is_default_welcome
    )
    _validate_intent_flags(new_is_fallback, new_is_default_welcome)
    if intent_in.name is not None:
        intent.name = intent_in.name
    if intent_in.description is not None:
        intent.description = intent_in.description
    if intent_in.is_active is not None:
        intent.is_active = intent_in.is_active
    if intent_in.is_fallback is not None:
        intent.is_fallback = intent_in.is_fallback
    if intent_in.is_default_welcome is not None:
        intent.is_default_welcome = intent_in.is_default_welcome

    if "parent_intent_id" in intent_in.model_fields_set:
        parent = _validate_parent(
            db, project.id, intent_in.parent_intent_id, current_intent_id=intent.id
        )
        intent.parent_intent_id = parent.id if parent else None

    if intent_in.training_phrases is not None or intent_in.responses is not None:
        _validate_languages(
            project.supported_languages,
            intent_in,
            ignore_empty=True,
        )
    if intent_in.fallbacks is not None:
        _validate_fallback_languages(project.supported_languages, intent_in.fallbacks)

    if intent_in.training_phrases is not None:
        intent.training_phrases.clear()
        _upsert_training_phrases(intent, intent_in.training_phrases)
    if intent_in.responses is not None:
        intent.responses.clear()
        _upsert_responses(intent, intent_in.responses)
    if intent_in.fulfillment is not None:
        if intent.fulfillment is None:
            intent.fulfillment = IntentFulfillment(
                enabled=intent_in.fulfillment.enabled,
                url=intent_in.fulfillment.url,
                method=intent_in.fulfillment.method or "POST",
                headers=intent_in.fulfillment.headers,
                payload_template=intent_in.fulfillment.payload_template,
                timeout_seconds=intent_in.fulfillment.timeout_seconds or 10,
                save_as=intent_in.fulfillment.save_as,
            )
        else:
            if intent_in.fulfillment.enabled is not None:
                intent.fulfillment.enabled = intent_in.fulfillment.enabled
            if intent_in.fulfillment.url is not None:
                intent.fulfillment.url = intent_in.fulfillment.url
            if intent_in.fulfillment.method is not None:
                intent.fulfillment.method = intent_in.fulfillment.method
            if intent_in.fulfillment.headers is not None:
                intent.fulfillment.headers = intent_in.fulfillment.headers
            if intent_in.fulfillment.payload_template is not None:
                intent.fulfillment.payload_template = intent_in.fulfillment.payload_template
            if intent_in.fulfillment.timeout_seconds is not None:
                intent.fulfillment.timeout_seconds = intent_in.fulfillment.timeout_seconds
            if intent_in.fulfillment.save_as is not None:
                intent.fulfillment.save_as = intent_in.fulfillment.save_as
    if intent_in.branches is not None:
        intent.branches.clear()
        _upsert_branches(intent, intent_in.branches)
    if intent_in.input_contexts is not None:
        intent.input_contexts.clear()
        _upsert_input_contexts(intent, intent_in.input_contexts)
    if intent_in.output_contexts is not None:
        intent.output_contexts.clear()
        _upsert_output_contexts(intent, intent_in.output_contexts)
    if intent_in.fallbacks is not None:
        intent.fallbacks.clear()
        _upsert_intent_fallbacks(intent, intent_in.fallbacks)

    db.add(intent)
    db.flush()
    if intent.is_default_welcome:
        _clear_default_welcome(db, project.id, exclude_id=intent.id)
    db.refresh(intent)
    return intent


def delete_intent(db: Session, intent: Intent) -> None:
    for child in intent.children:
        child.parent_intent_id = intent.parent_intent_id
    db.delete(intent)


def _validate_languages(supported_languages: list[str], payload, ignore_empty: bool = False) -> None:
    allowed = set(supported_languages)
    training_phrases = getattr(payload, "training_phrases", [])
    responses = getattr(payload, "responses", [])

    if ignore_empty and training_phrases is None and responses is None:
        return

    for item in training_phrases or []:
        if item.language not in allowed:
            raise LanguageNotSupportedError(f"Language {item.language} is not supported by project")
    for item in responses or []:
        if item.language not in allowed:
            raise LanguageNotSupportedError(f"Language {item.language} is not supported by project")


def _validate_fallback_languages(
    supported_languages: list[str],
    fallbacks: list[IntentFallbackCreate],
) -> None:
    allowed = set(supported_languages)
    for fallback in fallbacks:
        if fallback.language not in allowed:
            raise LanguageNotSupportedError(
                f"Language {fallback.language} is not supported by project"
            )


def _upsert_training_phrases(intent: Intent, training_phrases) -> None:
    for phrase in training_phrases:
        intent.training_phrases.append(
            IntentTrainingPhrase(language=phrase.language, text=phrase.text)
        )


def _upsert_responses(intent: Intent, responses) -> None:
    for response in responses:
        intent.responses.append(
            IntentResponse(
                language=response.language,
                text=response.text,
                response_type=response.response_type,
                payload=dict(response.payload) if response.payload else None,
                is_rich_content=response.is_rich_content,
            )
        )


def _upsert_branches(intent: Intent, branches: list[IntentBranchCreate]) -> None:
    for branch in branches:
        intent.branches.append(
            IntentBranch(
                expression=branch.expression,
                true_intent_id=branch.true_intent_id,
                false_intent_id=branch.false_intent_id,
            )
        )


def _upsert_input_contexts(intent: Intent, contexts: list[IntentInputContextCreate]) -> None:
    for ctx in contexts:
        intent.input_contexts.append(
            IntentInputContext(name=ctx.name.strip())
        )


def _upsert_output_contexts(intent: Intent, contexts: list[IntentOutputContextCreate]) -> None:
    for ctx in contexts:
        lifespan = ctx.lifespan_turns if ctx.lifespan_turns is not None else 5
        intent.output_contexts.append(
            IntentOutputContext(
                name=ctx.name.strip(),
                lifespan_turns=int(lifespan),
            )
        )


def _upsert_intent_fallbacks(intent: Intent, fallbacks: list[IntentFallbackCreate]) -> None:
    seen_languages: set[str] = set()
    for fallback in fallbacks:
        language = fallback.language
        if language in seen_languages:
            raise ValueError(f"Duplicate fallback for language {language} in payload")
        seen_languages.add(language)
        intent.fallbacks.append(
            IntentFallback(
                language=language,
                text=fallback.text,
            )
        )


def _validate_intent_flags(is_fallback: bool, is_default_welcome: bool) -> None:
    if is_fallback and is_default_welcome:
        raise ValueError("Intent cannot be both fallback and default welcome")


def _clear_default_welcome(db: Session, project_id: int, exclude_id: int | None = None) -> None:
    query = (
        db.query(Intent)
        .filter(Intent.project_id == project_id, Intent.is_default_welcome.is_(True))
    )
    if exclude_id is not None:
        query = query.filter(Intent.id != exclude_id)
    query.update({Intent.is_default_welcome: False}, synchronize_session=False)


def _validate_parent(
    db: Session,
    project_id: int,
    parent_intent_id: int | None,
    current_intent_id: int | None = None,
) -> Intent | None:
    if parent_intent_id is None:
        return None
    parent = (
        db.query(Intent)
        .filter(Intent.project_id == project_id, Intent.id == parent_intent_id)
        .first()
    )
    if not parent:
        raise InvalidIntentHierarchyError(
            f"Parent intent {parent_intent_id} does not exist in project {project_id}"
        )
    if current_intent_id and parent.id == current_intent_id:
        raise InvalidIntentHierarchyError("Intent cannot reference itself as parent")

    ancestor = parent.parent
    while ancestor is not None:
        if ancestor.id == current_intent_id:
            raise InvalidIntentHierarchyError("Circular intent hierarchy detected")
        ancestor = ancestor.parent
    return parent
