from datetime import datetime

from pydantic import BaseModel, Field

from typing import Literal

from app.schemas.fulfillment import FulfillmentCreate, FulfillmentRead, FulfillmentUpdate

from app.schemas.common import LanguageCode


class TrainingPhraseBase(BaseModel):
    language: LanguageCode = Field(..., description="ISO language code")
    text: str = Field(..., min_length=1)


class TrainingPhraseCreate(TrainingPhraseBase):
    pass


class TrainingPhraseRead(TrainingPhraseBase):
    id: int

    model_config = {"from_attributes": True}


class IntentResponseBase(BaseModel):
    language: LanguageCode
    text: str | None = Field(default=None)
    response_type: Literal["text", "image", "api"] = Field(default="text")
    payload: dict | None = Field(default=None, description="Optional structured payload for non-text responses")
    is_rich_content: bool = False


class IntentResponseCreate(IntentResponseBase):
    pass


class IntentResponseRead(IntentResponseBase):
    id: int

    model_config = {"from_attributes": True}


class IntentBranchBase(BaseModel):
    expression: str = Field(..., description="JMESPath expression evaluated against session context.")
    true_intent_id: int | None = Field(default=None, description="Next intent when expression is truthy")
    false_intent_id: int | None = Field(default=None, description="Fallback intent when expression is falsy")


class IntentBranchCreate(IntentBranchBase):
    pass


class IntentBranchUpdate(IntentBranchBase):
    pass


class IntentBranchRead(IntentBranchBase):
    id: int

    model_config = {"from_attributes": True}


class IntentContextBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)


class IntentInputContextCreate(IntentContextBase):
    pass


class IntentInputContextRead(IntentContextBase):
    id: int

    model_config = {"from_attributes": True}


class IntentOutputContextBase(IntentContextBase):
    lifespan_turns: int = Field(
        default=5,
        ge=0,
        description="Number of conversational turns the context stays active. Zero removes the context.",
    )


class IntentOutputContextCreate(IntentOutputContextBase):
    pass


class IntentOutputContextRead(IntentOutputContextBase):
    id: int

    model_config = {"from_attributes": True}


class IntentFallbackBase(BaseModel):
    language: LanguageCode
    text: str = Field(..., min_length=1)


class IntentFallbackCreate(IntentFallbackBase):
    pass


class IntentFallbackRead(IntentFallbackBase):
    id: int
    intent_id: int
    updated_at: datetime

    model_config = {"from_attributes": True}


class IntentBase(BaseModel):
    name: str = Field(..., max_length=100)
    description: str | None = Field(default=None, max_length=500)
    is_active: bool = True
    is_fallback: bool = False
    is_default_welcome: bool = False
    parent_intent_id: int | None = Field(
        default=None,
        ge=1,
        description="Optional parent intent id for follow-up logic.",
    )


class IntentCreate(IntentBase):
    training_phrases: list[TrainingPhraseCreate]
    responses: list[IntentResponseCreate]
    fulfillment: FulfillmentCreate | None = None
    branches: list[IntentBranchCreate] = Field(default_factory=list)
    input_contexts: list[IntentInputContextCreate] = Field(default_factory=list)
    output_contexts: list[IntentOutputContextCreate] = Field(default_factory=list)
    fallbacks: list[IntentFallbackCreate] = Field(default_factory=list)


class IntentUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=100)
    description: str | None = Field(default=None, max_length=500)
    is_active: bool | None = None
    is_fallback: bool | None = None
    is_default_welcome: bool | None = None
    training_phrases: list[TrainingPhraseCreate] | None = None
    responses: list[IntentResponseCreate] | None = None
    parent_intent_id: int | None = Field(
        default=None,
        ge=1,
        description="Update the parent intent id (set to null by sending null).",
    )
    fulfillment: FulfillmentUpdate | None = None
    branches: list[IntentBranchUpdate] | None = None
    input_contexts: list[IntentInputContextCreate] | None = None
    output_contexts: list[IntentOutputContextCreate] | None = None
    fallbacks: list[IntentFallbackCreate] | None = None


class IntentChildSummary(BaseModel):
    id: int
    name: str

    model_config = {"from_attributes": True}


class IntentRead(IntentBase):
    id: int
    project_id: int
    created_at: datetime
    updated_at: datetime
    training_phrases: list[TrainingPhraseRead]
    responses: list[IntentResponseRead]
    fulfillment: FulfillmentRead | None = None
    branches: list[IntentBranchRead] = Field(default_factory=list)
    children: list[IntentChildSummary] = Field(default_factory=list)
    input_contexts: list[IntentInputContextRead] = Field(default_factory=list)
    output_contexts: list[IntentOutputContextRead] = Field(default_factory=list)
    fallbacks: list[IntentFallbackRead] = Field(default_factory=list)
    is_fallback: bool
    is_default_welcome: bool

    model_config = {"from_attributes": True}
