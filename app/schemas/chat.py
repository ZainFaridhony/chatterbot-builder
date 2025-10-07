from datetime import datetime

from pydantic import BaseModel, Field

from app.schemas.common import LanguageCode


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1)
    language: LanguageCode | None = Field(
        default=None, description="Optional override if client already knows the language."
    )
    session_id: str | None = Field(
        default=None,
        description="Conversation/session identifier to enable follow-up intent tracking.",
        min_length=1,
        max_length=128,
    )


class ChatResponsePart(BaseModel):
    type: str = Field(description="text, image, or api")
    text: str | None = None
    image_url: str | None = None
    api_status: int | None = None
    api_response: dict | str | None = None
    api_headers: dict | None = None


class ChatResponse(BaseModel):
    project_id: int
    intent_id: int | None
    response: str | None
    responses: list[ChatResponsePart]
    language: LanguageCode
    confidence: float
    is_fallback: bool
    timestamp: datetime
