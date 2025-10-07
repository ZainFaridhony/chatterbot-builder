from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, HttpUrl, model_validator

from app.schemas.common import LanguageCode


class FallbackMessagePart(BaseModel):
    type: Literal["text", "image", "api"]
    text: str | None = None
    image_url: HttpUrl | None = None
    api_status: int | None = Field(default=None, ge=100, le=599)
    api_response: dict | list | str | None = None
    api_headers: dict | None = None

    @model_validator(mode="after")
    def validate_payload(self) -> "FallbackMessagePart":
        if self.type == "text":
            if not (self.text and self.text.strip()):
                raise ValueError("Text response requires non-empty text")
        elif self.type == "image":
            if not self.image_url:
                raise ValueError("Image response requires an image_url")
        elif self.type == "api":
            if self.api_response is None:
                raise ValueError("API response requires api_response payload")
        return self


class FallbackBase(BaseModel):
    language: LanguageCode
    text: str = Field(..., min_length=1)
    intent_id: int | None = Field(
        default=None,
        ge=1,
        description="Optional intent id this fallback is scoped to. Null for global project fallback.",
    )
    message_parts: list[FallbackMessagePart] = Field(default_factory=list)


class FallbackUpdate(FallbackBase):
    pass


class FallbackRead(FallbackBase):
    project_id: int
    updated_at: datetime

    model_config = {"from_attributes": True}
