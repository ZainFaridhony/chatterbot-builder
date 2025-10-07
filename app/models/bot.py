from __future__ import annotations

import json
from datetime import datetime
from typing import Any, Dict, List, Optional

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    Float,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import JSON

from app.db.session import Base


class BotProject(Base):
    __tablename__ = "bot_projects"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    supported_languages: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    default_language: Mapped[str] = mapped_column(String(5), nullable=False, default="en")
    confidence_threshold: Mapped[float] = mapped_column(
        Float, nullable=False, default=0.7
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    intents: Mapped[list["Intent"]] = relationship(
        "Intent", back_populates="project", cascade="all, delete-orphan"
    )
    fallbacks: Mapped[list["BotFallback"]] = relationship(
        "BotFallback", back_populates="project", cascade="all, delete-orphan"
    )


class Intent(Base):
    __tablename__ = "intents"
    __table_args__ = (UniqueConstraint("project_id", "name", name="uq_intent_project_name"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    project_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("bot_projects.id", ondelete="CASCADE"), nullable=False
    )
    parent_intent_id: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("intents.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_fallback: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_default_welcome: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    project: Mapped["BotProject"] = relationship("BotProject", back_populates="intents")
    parent: Mapped["Intent | None"] = relationship(
        "Intent",
        remote_side="Intent.id",
        back_populates="children",
    )
    children: Mapped[list["Intent"]] = relationship(
        "Intent",
        back_populates="parent",
        cascade="save-update",
    )
    training_phrases: Mapped[list["IntentTrainingPhrase"]] = relationship(
        "IntentTrainingPhrase", back_populates="intent", cascade="all, delete-orphan"
    )
    responses: Mapped[list["IntentResponse"]] = relationship(
        "IntentResponse", back_populates="intent", cascade="all, delete-orphan"
    )
    fulfillment: Mapped[Optional["IntentFulfillment"]] = relationship(
        "IntentFulfillment",
        uselist=False,
        back_populates="intent",
        cascade="all, delete-orphan",
    )
    branches: Mapped[list["IntentBranch"]] = relationship(
        "IntentBranch",
        back_populates="intent",
        foreign_keys="[IntentBranch.intent_id]",  # Explicitly specify which foreign key to use
        cascade="all, delete-orphan",
    )
    input_contexts: Mapped[list["IntentInputContext"]] = relationship(
        "IntentInputContext",
        back_populates="intent",
        cascade="all, delete-orphan",
    )
    output_contexts: Mapped[list["IntentOutputContext"]] = relationship(
        "IntentOutputContext",
        back_populates="intent",
        cascade="all, delete-orphan",
    )
    fallbacks: Mapped[list["IntentFallback"]] = relationship(
        "IntentFallback",
        back_populates="intent",
        cascade="all, delete-orphan",
    )


class IntentTrainingPhrase(Base):
    __tablename__ = "intent_training_phrases"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    intent_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("intents.id", ondelete="CASCADE"), nullable=False
    )
    language: Mapped[str] = mapped_column(String(5), nullable=False, index=True)
    text: Mapped[str] = mapped_column(Text, nullable=False)

    intent: Mapped["Intent"] = relationship("Intent", back_populates="training_phrases")


class IntentResponse(Base):
    __tablename__ = "intent_responses"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    intent_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("intents.id", ondelete="CASCADE"), nullable=False
    )
    language: Mapped[str] = mapped_column(String(5), nullable=False, index=True)
    text: Mapped[str | None] = mapped_column(Text, nullable=True)
    response_type: Mapped[str] = mapped_column(String(20), nullable=False, default="text")
    payload: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    is_rich_content: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    intent: Mapped["Intent"] = relationship("Intent", back_populates="responses")


class IntentFulfillment(Base):
    __tablename__ = "intent_fulfillments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    intent_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("intents.id", ondelete="CASCADE"), nullable=False, unique=True
    )
    enabled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    method: Mapped[str] = mapped_column(String(10), default="POST", nullable=False)
    headers: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    payload_template: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    timeout_seconds: Mapped[int] = mapped_column(Integer, nullable=False, default=10)
    save_as: Mapped[str | None] = mapped_column(String(100), nullable=True)

    intent: Mapped["Intent"] = relationship("Intent", back_populates="fulfillment")


class IntentBranch(Base):
    __tablename__ = "intent_branches"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    intent_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("intents.id", ondelete="CASCADE"), nullable=False
    )
    expression: Mapped[str] = mapped_column(Text, nullable=False)
    true_intent_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("intents.id"), nullable=True)
    false_intent_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("intents.id"), nullable=True)

    intent: Mapped[Optional["Intent"]] = relationship(
        "Intent",
        foreign_keys=[intent_id],
        back_populates="branches",
    )
    true_intent: Mapped[Optional["Intent"]] = relationship(
        "Intent",
        foreign_keys=[true_intent_id],
        post_update=True,
    )
    false_intent: Mapped[Optional["Intent"]] = relationship(
        "Intent",
        foreign_keys=[false_intent_id],
        post_update=True,
    )


class IntentInputContext(Base):
    __tablename__ = "intent_input_contexts"
    __table_args__ = (
        UniqueConstraint("intent_id", "name", name="uq_intent_input_context_name"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    intent_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("intents.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False, index=True)

    intent: Mapped["Intent"] = relationship("Intent", back_populates="input_contexts")


class IntentOutputContext(Base):
    __tablename__ = "intent_output_contexts"
    __table_args__ = (
        UniqueConstraint("intent_id", "name", name="uq_intent_output_context_name"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    intent_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("intents.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    lifespan_turns: Mapped[int] = mapped_column(Integer, nullable=False, default=5)

    intent: Mapped["Intent"] = relationship("Intent", back_populates="output_contexts")


class _FallbackContentMixin:
    _content: Mapped[str]
    _fallback_cache: Dict[str, Any] | None = None

    @staticmethod
    def _sanitize_part(part: dict[str, Any]) -> dict[str, Any] | None:
        if not isinstance(part, dict):
            return None
        part_type = part.get("type")
        if part_type not in {"text", "image", "api"}:
            return None
        sanitized: dict[str, Any] = {"type": part_type}
        if part_type == "text":
            text = part.get("text")
            if not text:
                return None
            sanitized["text"] = str(text)
        elif part_type == "image":
            image_url = part.get("image_url")
            if not image_url:
                return None
            sanitized["image_url"] = str(image_url)
            if part.get("text"):
                sanitized["text"] = str(part["text"])
        else:
            api_response = part.get("api_response")
            if api_response is None:
                return None
            sanitized["api_response"] = api_response
            if part.get("api_status") is not None:
                sanitized["api_status"] = int(part["api_status"])
            if part.get("api_headers") is not None:
                sanitized["api_headers"] = part["api_headers"]
            if part.get("text"):
                sanitized["text"] = str(part["text"])
        return sanitized

    def _decode_content(self) -> dict[str, Any]:
        cached = getattr(self, "_fallback_cache", None)
        if cached is not None:
            return cached
        raw = getattr(self, "_content", "") or ""
        if isinstance(raw, str) and raw.lstrip().startswith("{"):
            try:
                data = json.loads(raw)
                if isinstance(data, dict):
                    text = str(data.get("text", ""))
                    parts_raw = data.get("parts", [])
                    parts: list[dict[str, Any]] = []
                    if isinstance(parts_raw, list):
                        for part in parts_raw:
                            sanitized = self._sanitize_part(part)
                            if sanitized:
                                parts.append(sanitized)
                    payload = {"text": text, "parts": parts}
                    self._fallback_cache = payload
                    return payload
            except (ValueError, TypeError):
                pass
        payload = {"text": raw, "parts": []}
        self._fallback_cache = payload
        return payload

    def _store_content(self, text: str, parts: List[dict[str, Any]] | None) -> None:
        sanitized_parts: list[dict[str, Any]] = []
        if parts:
            for part in parts:
                sanitized = self._sanitize_part(part)
                if sanitized:
                    sanitized_parts.append(sanitized)
        if sanitized_parts:
            self._content = json.dumps({"text": text, "parts": sanitized_parts}, ensure_ascii=False)
        else:
            self._content = text
        self._fallback_cache = {"text": text, "parts": sanitized_parts}

    @property
    def text(self) -> str:
        payload = self._decode_content()
        return payload["text"]

    @text.setter
    def text(self, value: str) -> None:
        payload = self._decode_content()
        self._store_content(value, payload.get("parts"))

    @property
    def message_parts(self) -> list[dict[str, Any]]:
        payload = self._decode_content()
        return payload["parts"]

    @message_parts.setter
    def message_parts(self, parts: list[dict[str, Any]]) -> None:
        payload = self._decode_content()
        self._store_content(payload.get("text", ""), parts)

    @property
    def content_signature(self) -> str:
        return getattr(self, "_content", "")

    def serialized_parts(self) -> list[dict[str, Any]]:
        payload = self._decode_content()
        items: list[dict[str, Any]] = []
        if payload["text"]:
            items.append({"type": "text", "text": payload["text"]})
        for part in payload["parts"]:
            items.append(part)
        return items


class BotFallback(Base, _FallbackContentMixin):
    __tablename__ = "bot_fallbacks"
    __table_args__ = (
        UniqueConstraint("project_id", "language", name="uq_fallback_project_language"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    project_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("bot_projects.id", ondelete="CASCADE"), nullable=False
    )
    language: Mapped[str] = mapped_column(String(5), nullable=False)
    _content: Mapped[str] = mapped_column("text", Text, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    project: Mapped["BotProject"] = relationship("BotProject", back_populates="fallbacks")

    @property
    def intent_id(self) -> None:
        return None


class IntentFallback(Base, _FallbackContentMixin):
    __tablename__ = "intent_fallbacks"
    __table_args__ = (
        UniqueConstraint("intent_id", "language", name="uq_intent_fallback_language"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    intent_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("intents.id", ondelete="CASCADE"), nullable=False, index=True
    )
    language: Mapped[str] = mapped_column(String(5), nullable=False)
    _content: Mapped[str] = mapped_column("text", Text, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    intent: Mapped["Intent"] = relationship("Intent", back_populates="fallbacks")

    @property
    def project_id(self) -> int:
        return self.intent.project_id
