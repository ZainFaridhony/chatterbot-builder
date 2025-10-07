from __future__ import annotations

import hashlib
from pathlib import Path
from typing import Dict, Iterable, Tuple

from chatterbot import ChatBot
from chatterbot.tagging import LowercaseTagger
from chatterbot.trainers import ListTrainer
from sqlalchemy.orm import Session, selectinload

from app.core.config import get_settings
from app.models import BotFallback, Intent, IntentResponse

settings = get_settings()


class ChatbotManager:
    def __init__(self) -> None:
        self._cache: Dict[Tuple[int, str], ChatBot] = {}
        self._fingerprints: Dict[Tuple[int, str], str] = {}

    def reset_project(self, project_id: int) -> None:
        keys_to_remove = [key for key in self._cache if key[0] == project_id]
        for key in keys_to_remove:
            self._cache.pop(key, None)
            self._fingerprints.pop(key, None)

    def get_response(
        self,
        db: Session,
        project_id: int,
        language: str,
        message: str,
        fallback: BotFallback | None,
        intents: Iterable[Intent],
        threshold: float,
    ):
        key = (project_id, language)
        fingerprint = self._compute_fingerprint(intents, fallback)
        bot = self._cache.get(key)
        if bot is None or self._fingerprints.get(key) != fingerprint:
            bot = self._build_bot(project_id, language, fallback)
            self._train_bot(bot, intents, language)
            self._cache[key] = bot
            self._fingerprints[key] = fingerprint
        response = bot.get_response(message)
        matched_intent = (
            db.query(Intent)
            .options(selectinload(Intent.children))
            .join(IntentResponse)
            .filter(
                Intent.project_id == project_id,
                IntentResponse.language == language,
                IntentResponse.text == str(response),
            )
            .first()
        )
        confidence = getattr(response, "confidence", 0.0) or 0.0
        should_use_intent = matched_intent is not None and confidence >= threshold
        return {
            "intent": matched_intent,
            "response_text": str(response) if should_use_intent else (fallback.text if fallback else None),
            "response_parts": fallback.serialized_parts() if fallback else [],
            "confidence": confidence,
            "is_fallback": not should_use_intent,
        }

    def _build_bot(
        self, project_id: int, language: str, fallback: BotFallback | None
    ) -> ChatBot:
        db_path = Path(settings.chatterbot_db_dir) / f"bot_{project_id}_{language}.sqlite3"
        if db_path.exists():
            db_path.unlink()
        return ChatBot(
            f"project_{project_id}_{language}",
            storage_adapter="chatterbot.storage.SQLStorageAdapter",
            database_uri=f"sqlite:///{db_path}",
            preprocessors=["chatterbot.preprocessors.clean_whitespace"],
            logic_adapters=[
                {
                    "import_path": "chatterbot.logic.BestMatch",
                    "default_response": fallback.text if fallback else "",
                    "maximum_similarity_threshold": 0.95,
                }
            ],
            tagger=LowercaseTagger,
            read_only=False,
        )

    def _train_bot(self, bot: ChatBot, intents: Iterable[Intent], language: str) -> None:
        trainer = ListTrainer(bot)
        for intent in intents:
            phrases = [
                phrase.text
                for phrase in intent.training_phrases
                if phrase.language == language
            ]
            responses = [
                response.text
                for response in intent.responses
                if response.language == language and (response.response_type or "text") == "text"
            ]
            if not phrases or not responses:
                continue
            for phrase in phrases:
                for response in responses:
                    trainer.train([phrase, response])
        bot.read_only = True

    def _compute_fingerprint(
        self, intents: Iterable[Intent], fallback: BotFallback | None
    ) -> str:
        hasher = hashlib.sha256()
        for intent in sorted(intents, key=lambda i: i.id):
            hasher.update(f"{intent.id}:{intent.updated_at.isoformat()}".encode())
            hasher.update(f"Parent:{intent.parent_intent_id}".encode())
            for phrase in sorted(intent.training_phrases, key=lambda p: p.id):
                hasher.update(f"P:{phrase.id}:{phrase.language}:{phrase.text}".encode())
        for response in sorted(intent.responses, key=lambda r: r.id):
            hasher.update(f"R:{response.id}:{response.language}:{response.text}".encode())
        fallback_key = (
            f"{fallback.language}:{fallback.content_signature}" if fallback else "none"
        )
        hasher.update(f"F:{fallback_key}".encode())
        return hasher.hexdigest()


chatbot_manager = ChatbotManager()
