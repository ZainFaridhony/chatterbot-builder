# Repository Guidelines

## Project Structure & Module Organization
- Application code lives under `app/`; `main.py` wires routers, startup hooks, and dependencies.
- Feature modules follow layers: requests/responses in `app/schemas`, persistence in `app/models`, database adapters in `app/crud`, orchestration in `app/services`, and HTTP entry points in `app/routers`.
- Shared helpers stay in `app/utils`; chatbot training, caching, and storage helpers live in `app/chatterbot_ext/manager.py`.
- Generated SQLite databases and chatterbot artifacts belong in `data/`. Mirror new tests under `tests/`, matching the `app/` subtree.

## Build, Test, and Development Commands
- `python -m venv venv && source venv/bin/activate` creates and activates a local virtual environment.
- `pip install -r requirements.txt` installs runtime and tooling dependencies.
- `uvicorn app.main:app --reload` starts the FastAPI server with hot reload and `.env` overrides.
- `alembic revision --autogenerate -m "describe change"` then `alembic upgrade head` manage schema migrations.

## Coding Style & Naming Conventions
- Target Python 3.11+, four-space indentation, and full type hints across services, routers, and tests.
- Use snake_case for modules, functions, variables; reserve PascalCase for Pydantic schemas and SQLAlchemy models.
- Keep routers thin—delegate business logic to `services` and persistence to `crud`. Prefer FastAPI `Depends` for injection.
- Run `ruff --select F401,F841 .` and `python -m compileall app` before submitting changes.

## Testing Guidelines
- Use `pytest` for unit suites and `pytest -k "integration" --maxfail=1` for heavier checks.
- Mirror test modules with their targets (e.g., `tests/routers/test_projects.py`).
- Mock external services and use `httpx.AsyncClient` with FastAPI lifespan for router tests.

## Commit & Pull Request Guidelines
- Write imperative commit subjects (e.g., `Add Malay fallback seeding`).
- Include concise PR summaries, linked issues, API or schema impacts, and test evidence (logs or screenshots).
- Confirm `uvicorn` smoke tests and pytest suites pass locally before requesting review.

## Security & Configuration Tips
- Store secrets in `.env`; never commit real credentials. Use env vars for local overrides.
- Point `CHATBOT_DATABASE_URL` to a disposable SQLite file when iterating to keep shared data clean.
