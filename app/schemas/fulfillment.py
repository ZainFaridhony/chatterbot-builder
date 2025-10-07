from pydantic import BaseModel, Field, HttpUrl


class FulfillmentBase(BaseModel):
    enabled: bool = Field(default=False)
    url: HttpUrl | None = Field(default=None)
    method: str = Field(default="POST")
    headers: dict | None = Field(default=None)
    payload_template: dict | None = Field(default=None)
    timeout_seconds: int = Field(default=10, ge=1, le=60)
    save_as: str | None = Field(default=None, max_length=100)


class FulfillmentCreate(FulfillmentBase):
    pass


class FulfillmentUpdate(FulfillmentBase):
    enabled: bool | None = None
    method: str | None = None
    timeout_seconds: int | None = Field(default=None, ge=1, le=60)


class FulfillmentRead(FulfillmentBase):
    id: int

    model_config = {"from_attributes": True}
