from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from threading import Lock
from typing import Any, Iterable, Mapping, Sequence, Set


@dataclass
class _ActiveContext:
    remaining_turns: int


@dataclass
class _ConversationEntry:
    intent_ids: Set[int]
    expires_at: datetime
    context: dict[str, Any]
    active_contexts: dict[str, _ActiveContext] = field(default_factory=dict)
    last_successful_intent: int | None = None


class ConversationState:
    """Simple in-memory store that tracks follow-up intent eligibility per session."""

    def __init__(self, ttl_minutes: int = 30) -> None:
        self._entries: dict[str, _ConversationEntry] = {}
        self._lock = Lock()
        self._ttl = timedelta(minutes=ttl_minutes)

    def _purge_if_expired(self, session_id: str, entry: _ConversationEntry | None) -> _ConversationEntry | None:
        if entry is None:
            return None
        now = datetime.now(timezone.utc)
        if entry.expires_at <= now:
            self._entries.pop(session_id, None)
            return None
        return entry

    def set_followups(
        self,
        session_id: str,
        intent_ids: Iterable[int],
        last_successful_intent: int | None,
    ) -> None:
        if not session_id:
            return
        ids = {int(intent_id) for intent_id in intent_ids if intent_id is not None}
        expires_at = datetime.now(timezone.utc) + self._ttl
        with self._lock:
            entry = self._entries.get(session_id)
            entry = self._purge_if_expired(session_id, entry)
            context = entry.context if entry else {}
            active_contexts = entry.active_contexts if entry else {}
            self._entries[session_id] = _ConversationEntry(
                intent_ids=ids,
                expires_at=expires_at,
                context=context,
                active_contexts=active_contexts,
                last_successful_intent=last_successful_intent,
            )

    def get_followups(self, session_id: str) -> tuple[Set[int], int | None]:
        if not session_id:
            return set(), None
        with self._lock:
            entry = self._entries.get(session_id)
            entry = self._purge_if_expired(session_id, entry)
            if entry:
                return set(entry.intent_ids), entry.last_successful_intent
            return set(), None

    def clear(self, session_id: str) -> None:
        if not session_id:
            return
        with self._lock:
            self._entries.pop(session_id, None)

    def touch(self, session_id: str) -> None:
        if not session_id:
            return
        with self._lock:
            entry = self._entries.get(session_id)
            entry = self._purge_if_expired(session_id, entry)
            if entry:
                entry.expires_at = datetime.now(timezone.utc) + self._ttl
                self._entries[session_id] = entry

    def update_context(self, session_id: str, payload: dict[str, Any]) -> None:
        if not session_id or not payload:
            return
        with self._lock:
            entry = self._entries.get(session_id)
            expires_at = datetime.now(timezone.utc) + self._ttl
            entry = self._purge_if_expired(session_id, entry)
            if entry is None:
                entry = _ConversationEntry(
                    intent_ids=set(),
                    expires_at=expires_at,
                    context={},
                    active_contexts={},
                    last_successful_intent=None,
                )
            entry.context = _merge_dicts(entry.context, payload)
            entry.expires_at = expires_at
            self._entries[session_id] = entry

    def get_context(self, session_id: str) -> dict[str, Any]:
        if not session_id:
            return {}
        with self._lock:
            entry = self._entries.get(session_id)
            entry = self._purge_if_expired(session_id, entry)
            if entry:
                return entry.context
            return {}

    def get_active_contexts(self, session_id: str) -> dict[str, int]:
        if not session_id:
            return {}
        with self._lock:
            entry = self._entries.get(session_id)
            entry = self._purge_if_expired(session_id, entry)
            if not entry:
                return {}
            return {
                name: state.remaining_turns
                for name, state in entry.active_contexts.items()
                if state.remaining_turns > 0
            }

    def clear_context(self, session_id: str) -> None:
        if not session_id:
            return
        with self._lock:
            entry = self._entries.get(session_id)
            entry = self._purge_if_expired(session_id, entry)
            if entry:
                entry.context = {}
                self._entries[session_id] = entry

    def apply_output_contexts(
        self,
        session_id: str,
        contexts: Mapping[str, int] | Sequence[tuple[str, int]] | None,
    ) -> None:
        if not session_id:
            return
        with self._lock:
            entry = self._entries.get(session_id)
            expires_at = datetime.now(timezone.utc) + self._ttl
            entry = self._purge_if_expired(session_id, entry)

            items: list[tuple[str, int]] = []
            if contexts:
                raw_items: Iterable[tuple[str, int | None]]
                if isinstance(contexts, Mapping):
                    raw_items = contexts.items()
                else:
                    raw_items = contexts
                for raw_name, lifespan in raw_items:
                    name = (raw_name or "").strip()
                    if not name:
                        continue
                    turns = int(lifespan) if lifespan is not None else 0
                    items.append((name.lower(), turns))

            if entry is None and not items:
                return
            if entry is None:
                entry = _ConversationEntry(
                    intent_ids=set(),
                    expires_at=expires_at,
                    context={},
                    active_contexts={},
                    last_successful_intent=None,
                )

            # decrement remaining turns for existing contexts
            expired: list[str] = []
            for name, state in entry.active_contexts.items():
                state.remaining_turns -= 1
                if state.remaining_turns <= 0:
                    expired.append(name)
            for name in expired:
                entry.active_contexts.pop(name, None)

            for name, turns in items:
                if turns <= 0:
                    entry.active_contexts.pop(name, None)
                    continue
                entry.active_contexts[name] = _ActiveContext(remaining_turns=turns)

            entry.expires_at = expires_at
            self._entries[session_id] = entry

    def reset_to_root(self, session_id: str) -> None:
        if not session_id:
            return
        with self._lock:
            entry = self._entries.get(session_id)
            entry = self._purge_if_expired(session_id, entry)
            if entry:
                entry.intent_ids = set()
                entry.last_successful_intent = None
                entry.active_contexts = {}
                entry.expires_at = datetime.now(timezone.utc) + self._ttl
                self._entries[session_id] = entry


conversation_state = ConversationState()


def _merge_dicts(base: dict[str, Any], new: dict[str, Any]) -> dict[str, Any]:
    result = dict(base)
    for key, value in new.items():
        if (
            key in result
            and isinstance(result[key], dict)
            and isinstance(value, dict)
        ):
            result[key] = _merge_dicts(result[key], value)
        else:
            result[key] = value
    return result
