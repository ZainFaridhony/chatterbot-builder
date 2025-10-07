from sqlalchemy.orm import Session

from app.models import BotFallback, BotProject, Intent, IntentFallback
from app.schemas.fallback import FallbackUpdate
from app.utils.exceptions import LanguageNotSupportedError, IntentNotFoundError


def upsert_fallback(
    db: Session, project: BotProject, fallback_in: FallbackUpdate
) -> BotFallback | IntentFallback:
    if fallback_in.language not in project.supported_languages:
        raise LanguageNotSupportedError(
            f"Language {fallback_in.language} is not supported by project {project.id}"
        )
    normalized_text = fallback_in.text.strip()
    normalized_parts = [
        part.model_dump(exclude_none=True) for part in fallback_in.message_parts
    ]
    if fallback_in.intent_id:
        intent = (
            db.query(Intent)
            .filter(Intent.project_id == project.id, Intent.id == fallback_in.intent_id)
            .first()
        )
        if not intent:
            raise IntentNotFoundError(
                f"Intent {fallback_in.intent_id} not found for project {project.id}"
            )
        fallback = (
            db.query(IntentFallback)
            .filter(
                IntentFallback.intent_id == fallback_in.intent_id,
                IntentFallback.language == fallback_in.language,
            )
            .first()
        )
        if fallback is None:
            fallback = IntentFallback(
                intent_id=fallback_in.intent_id,
                language=fallback_in.language,
                text=normalized_text,
            )
            db.add(fallback)
        else:
            fallback.text = normalized_text
            db.add(fallback)
        fallback.message_parts = normalized_parts
        db.flush()
        db.refresh(fallback)
        return fallback

    fallback = (
        db.query(BotFallback)
        .filter(BotFallback.project_id == project.id, BotFallback.language == fallback_in.language)
        .first()
    )
    if fallback is None:
        fallback = BotFallback(
            project_id=project.id, language=fallback_in.language, text=normalized_text
        )
        db.add(fallback)
    else:
        fallback.text = normalized_text
        db.add(fallback)
    fallback.message_parts = normalized_parts
    db.flush()
    db.refresh(fallback)
    return fallback
