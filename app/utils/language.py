from __future__ import annotations

from typing import Iterable

from langdetect import DetectorFactory, LangDetectException, detect

SUPPORTED_LANGUAGES: dict[str, tuple[str, ...]] = {
    "en": ("en", "en-us", "en-gb", "english"),
    "id": ("id", "in", "indonesia", "indonesian", "bahasa"),
    "ms": ("ms", "msa", "malay", "bahasa melayu"),
}

DetectorFactory.seed = 0  # deterministic predictions


def normalize_language_code(language: str, default: str = "en") -> str:
    language = language.lower()
    for canonical, aliases in SUPPORTED_LANGUAGES.items():
        if language == canonical or language in aliases:
            return canonical
    return default


def detect_language(text: str, allowed: Iterable[str] | None = None, default: str = "en") -> str:
    allowed_set = set(allowed or SUPPORTED_LANGUAGES.keys())
    try:
        detected = detect(text)
    except LangDetectException:
        return default if default in allowed_set else next(iter(allowed_set))

    normalized = normalize_language_code(detected, default=default)
    if normalized in allowed_set:
        return normalized
    return default if default in allowed_set else next(iter(allowed_set))
