from datetime import datetime

from pydantic import BaseModel, Field, field_validator, model_validator

from app.schemas.common import LanguageCode
from app.schemas.fallback import FallbackRead


class ProjectBase(BaseModel):
    name: str = Field(..., max_length=100)
    description: str | None = Field(default=None, max_length=500)
    supported_languages: list[LanguageCode] = Field(default_factory=lambda: ["en", "id", "ms"])
    default_language: LanguageCode = "en"
    confidence_threshold: float = Field(default=0.7, ge=0.0, le=1.0)

    @field_validator("supported_languages")
    @classmethod
    def ensure_unique_languages(cls, value: list[LanguageCode]) -> list[LanguageCode]:
        seen: set[str] = set()
        unique: list[LanguageCode] = []
        for language in value:
            if language not in seen:
                unique.append(language)
                seen.add(language)
        return unique

    @model_validator(mode="after")
    def ensure_default_in_supported(self) -> "ProjectBase":
        if self.default_language not in self.supported_languages:
            self.supported_languages.append(self.default_language)
        return self


class ProjectCreate(ProjectBase):
    pass


class ProjectUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=100)
    description: str | None = Field(default=None, max_length=500)
    supported_languages: list[LanguageCode] | None = None
    default_language: LanguageCode | None = None
    confidence_threshold: float | None = Field(default=None, ge=0.0, le=1.0)

    @field_validator("supported_languages")
    @classmethod
    def normalize_supported(
        cls, value: list[LanguageCode] | None
    ) -> list[LanguageCode] | None:
        if value is None:
            return None
        seen: set[str] = set()
        unique: list[LanguageCode] = []
        for language in value:
            if language not in seen:
                unique.append(language)
                seen.add(language)
        return unique

    @model_validator(mode="after")
    def ensure_default_in_supported(self) -> "ProjectUpdate":
        if self.default_language and self.supported_languages:
            if self.default_language not in self.supported_languages:
                self.supported_languages.append(self.default_language)
        return self


class ProjectRead(ProjectBase):
    id: int
    created_at: datetime
    updated_at: datetime
    fallbacks: list[FallbackRead] = Field(default_factory=list)

    model_config = {"from_attributes": True}
