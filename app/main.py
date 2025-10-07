from fastapi import FastAPI

from app.core.config import get_settings
from app.db.init_db import init_db
from app.routers import chat, fallbacks, intents, projects

settings = get_settings()

app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    description="Backend platform to manage multilingual chatbot projects and flows.",
)


@app.on_event("startup")
def on_startup() -> None:
    init_db()


@app.get("/")
def healthcheck() -> dict[str, str]:
    return {"status": "ok", "app": settings.app_name}


app.include_router(projects.router)
app.include_router(intents.router)
app.include_router(fallbacks.router)
app.include_router(chat.router)
