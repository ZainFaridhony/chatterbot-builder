from typing import Annotated

from pydantic import AfterValidator, constr


def _normalize_language(value: str) -> str:
    normalized = value.strip().lower()
    if not normalized:
        raise ValueError("Language code cannot be empty")
    return normalized


LanguageCode = Annotated[constr(min_length=2, max_length=10), AfterValidator(_normalize_language)]
