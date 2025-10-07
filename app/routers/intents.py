from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.chatterbot_ext.manager import chatbot_manager
from app.crud import intent as intent_crud
from app.crud import project as project_crud
from app.db.session import get_db
from app.schemas.intent import IntentCreate, IntentRead, IntentUpdate
from app.utils.exceptions import (
    IntentNotFoundError,
    InvalidIntentHierarchyError,
    LanguageNotSupportedError,
    ProjectNotFoundError,
)

router = APIRouter(prefix="/projects/{project_id}/intents", tags=["intents"])


@router.get("", response_model=list[IntentRead])
def list_project_intents(project_id: int, db: Session = Depends(get_db)) -> list[IntentRead]:
    try:
        project_crud.get_project(db, project_id)
    except ProjectNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return intent_crud.list_intents(db, project_id)


@router.post("", response_model=IntentRead, status_code=status.HTTP_201_CREATED)
def create_intent(
    project_id: int, intent_in: IntentCreate, db: Session = Depends(get_db)
) -> IntentRead:
    try:
        project = project_crud.get_project(db, project_id)
        intent = intent_crud.create_intent(db, project, intent_in)
        db.commit()
        db.refresh(intent)
        chatbot_manager.reset_project(project_id)
        return intent
    except ProjectNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except (LanguageNotSupportedError, InvalidIntentHierarchyError) as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.put("/{intent_id}", response_model=IntentRead)
def update_intent(
    project_id: int,
    intent_id: int,
    intent_in: IntentUpdate,
    db: Session = Depends(get_db),
) -> IntentRead:
    try:
        project = project_crud.get_project(db, project_id)
        intent = intent_crud.get_intent(db, project_id, intent_id)
        intent = intent_crud.update_intent(db, project, intent, intent_in)
        db.commit()
        db.refresh(intent)
        chatbot_manager.reset_project(project_id)
        return intent
    except (ProjectNotFoundError, IntentNotFoundError) as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except (LanguageNotSupportedError, InvalidIntentHierarchyError) as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.delete("/{intent_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_intent(project_id: int, intent_id: int, db: Session = Depends(get_db)) -> None:
    try:
        project_crud.get_project(db, project_id)
        intent = intent_crud.get_intent(db, project_id, intent_id)
        intent_crud.delete_intent(db, intent)
        db.commit()
        chatbot_manager.reset_project(project_id)
    except (ProjectNotFoundError, IntentNotFoundError) as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
