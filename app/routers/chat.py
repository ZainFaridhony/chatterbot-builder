from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.chat import ChatRequest, ChatResponse
from app.services.chat_service import get_chat_response
from app.utils.exceptions import LanguageNotSupportedError, ProjectNotFoundError

router = APIRouter(prefix="/projects/{project_id}/chat", tags=["chat"])


@router.post("", response_model=ChatResponse)
def chat_with_bot(
    project_id: int, chat_in: ChatRequest, db: Session = Depends(get_db)
) -> ChatResponse:
    try:
        return get_chat_response(db, project_id, chat_in)
    except ProjectNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except LanguageNotSupportedError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
