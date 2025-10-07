from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.chatterbot_ext.manager import chatbot_manager
from app.crud import project as project_crud
from app.db.session import get_db
from app.schemas.project import ProjectCreate, ProjectRead, ProjectUpdate
from app.utils.exceptions import ProjectNotFoundError

router = APIRouter(prefix="/projects", tags=["projects"])


@router.post("", response_model=ProjectRead, status_code=status.HTTP_201_CREATED)
def create_project(project_in: ProjectCreate, db: Session = Depends(get_db)) -> ProjectRead:
    existing = project_crud.get_project_by_name(db, project_in.name)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Project name already exists"
        )
    project = project_crud.create_project(db, project_in)
    db.commit()
    db.refresh(project)
    return project


@router.get("", response_model=list[ProjectRead])
def list_projects(db: Session = Depends(get_db)) -> list[ProjectRead]:
    return project_crud.list_projects(db)


@router.get("/{project_id}", response_model=ProjectRead)
def get_project(project_id: int, db: Session = Depends(get_db)) -> ProjectRead:
    try:
        project = project_crud.get_project(db, project_id)
        return project
    except ProjectNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.patch("/{project_id}", response_model=ProjectRead)
def update_project(
    project_id: int, project_in: ProjectUpdate, db: Session = Depends(get_db)
) -> ProjectRead:
    try:
        project = project_crud.update_project(db, project_id, project_in)
        db.commit()
        db.refresh(project)
        return project
    except ProjectNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(project_id: int, db: Session = Depends(get_db)) -> None:
    try:
        project_crud.delete_project(db, project_id)
        db.commit()
        chatbot_manager.reset_project(project_id)
    except ProjectNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
