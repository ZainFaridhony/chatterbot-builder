from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "FlowMind Chatbot Backend"
    base_dir: Path = Path(__file__).resolve().parent.parent.parent
    data_dir: Path = base_dir / "data"
    database_url: str = "sqlite:///./data/chatbot.db"
    default_languages: tuple[Literal["en", "id", "ms"], ...] = ("en", "id", "ms")
    chatterbot_db_dir: Path = data_dir / "bot_storage"
    response_confidence_threshold: float = 0.35

    model_config = SettingsConfigDict(env_file=".env", env_prefix="CHATBOT_", case_sensitive=False)


@lru_cache
def get_settings() -> Settings:
    settings = Settings()
    settings.data_dir.mkdir(parents=True, exist_ok=True)
    settings.chatterbot_db_dir.mkdir(parents=True, exist_ok=True)
    return settings
