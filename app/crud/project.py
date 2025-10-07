from sqlalchemy.orm import Session, selectinload

from app.models import BotFallback, BotProject
from app.schemas.project import ProjectCreate, ProjectUpdate
from app.schemas.common import LanguageCode
from app.utils.exceptions import ProjectNotFoundError


def create_project(db: Session, project_in: ProjectCreate) -> BotProject:
    project = BotProject(
        name=project_in.name,
        description=project_in.description,
        supported_languages=list(project_in.supported_languages),
        default_language=project_in.default_language,
        confidence_threshold=project_in.confidence_threshold,
    )
    db.add(project)
    db.flush()
    _ensure_fallbacks(db, project, project.supported_languages)
    db.refresh(project)
    return project


def get_project(db: Session, project_id: int) -> BotProject:
    project = (
        db.query(BotProject)
        .options(selectinload(BotProject.fallbacks))
        .filter(BotProject.id == project_id)
        .first()
    )
    if not project:
        raise ProjectNotFoundError(f"Project {project_id} not found")
    return project


def get_project_by_name(db: Session, name: str) -> BotProject | None:
    return db.query(BotProject).filter(BotProject.name == name).first()


def list_projects(db: Session) -> list[BotProject]:
    return (
        db.query(BotProject)
        .options(selectinload(BotProject.fallbacks))
        .order_by(BotProject.created_at.desc())
        .all()
    )


def update_project(db: Session, project_id: int, project_in: ProjectUpdate) -> BotProject:
    project = get_project(db, project_id)
    if project_in.name is not None and project_in.name != project.name:
        conflict = get_project_by_name(db, project_in.name)
        if conflict and conflict.id != project.id:
            raise ValueError("Project name already exists")
        project.name = project_in.name
    supported_languages = project_in.supported_languages
    if supported_languages is not None:
        project.supported_languages = list(supported_languages)
    if project_in.description is not None:
        project.description = project_in.description
    if project_in.default_language is not None:
        project.default_language = project_in.default_language
    if project_in.confidence_threshold is not None:
        project.confidence_threshold = project_in.confidence_threshold
    _ensure_fallbacks(db, project, project.supported_languages)
    db.add(project)
    db.flush()
    db.refresh(project)
    return project


def _ensure_fallbacks(db: Session, project: BotProject, languages: list[LanguageCode]) -> None:
    existing = {fallback.language: fallback for fallback in project.fallbacks}
    for language in languages:
        if language not in existing:
            fallback = BotFallback(
                project_id=project.id,
                language=language,
                text="Sorry, I did not understand that. Could you rephrase?",
            )
            db.add(fallback)
    for language, fallback in existing.items():
        if language not in languages:
            db.delete(fallback)


def delete_project(db: Session, project_id: int) -> None:
    project = get_project(db, project_id)
    db.delete(project)
