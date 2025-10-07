from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.chatterbot_ext.manager import chatbot_manager
from app.crud import fallback as fallback_crud
from app.crud import project as project_crud
from app.db.session import get_db
from app.schemas.fallback import FallbackRead, FallbackUpdate
from app.utils.exceptions import (
    IntentNotFoundError,
    LanguageNotSupportedError,
    ProjectNotFoundError,
)

router = APIRouter(prefix="/projects/{project_id}/fallback", tags=["fallback"])


@router.put("", response_model=FallbackRead)
def set_fallback(
    project_id: int, fallback_in: FallbackUpdate, db: Session = Depends(get_db)
) -> FallbackRead:
    try:
        project = project_crud.get_project(db, project_id)
        fallback = fallback_crud.upsert_fallback(db, project, fallback_in)
        db.commit()
        db.refresh(fallback)
        chatbot_manager.reset_project(project_id)
        return fallback
    except ProjectNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except LanguageNotSupportedError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except IntentNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
