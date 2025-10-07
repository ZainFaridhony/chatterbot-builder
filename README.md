# FlowMind Chatbot Backend

FlowMind provides a multilingual chatbot management stack. The FastAPI backend orchestrates project, intent, fallback, and chat flows; the Vite/React frontend offers a visual designer. Together they let teams build, train, and validate bots for English, Bahasa Indonesia, and Malay in minutes.

## Features
- Project-scoped intent lifecycle with multilingual training phrases and responses
- Automatic language detection, configurable fallbacks, and session-aware follow-ups
- ChatterBot-powered training cache that retrains per project/language when data changes
- React console with intent flow editor, chat tester, and CRUD shortcuts backed by the API

## Architecture at a Glance
```
[FastAPI App]
  └─ routers → services → crud → SQLite (or external DB)
       └─ chatterbot_ext.manager handles training + confidence gating
```

## Database Schema
FlowMind stores chatbot configuration in SQLAlchemy models defined under `app/models/bot.py`. Cascading deletes keep child records in sync when a project or intent is removed.

```
bot_projects
  |- intents
  |   |- intent_training_phrases
  |   |- intent_responses
  |   |- intent_fulfillments
  |   |- intent_branches
  |   |- intent_input_contexts
  |   |- intent_output_contexts
  |   \- intent_fallbacks
  \- bot_fallbacks
```

| Table | Primary Fields | Notes |
| --- | --- | --- |
| `bot_projects` | `name` (unique), `supported_languages` JSON, `default_language`, `confidence_threshold`, timestamps | Root entity; deleting a project cascades to intents and project fallbacks. |
| `intents` | `project_id` FK, optional `parent_intent_id`, flags (`is_active`, `is_fallback`, `is_default_welcome`) | Supports hierarchical flows, default welcome intents, and project-scoped uniqueness on `name`. |
| `intent_training_phrases` | `intent_id` FK, `language`, `text` | Stores localized training utterances; `language` is indexed for fast lookups. |
| `intent_responses` | `intent_id` FK, `language`, `text`, `response_type`, JSON `payload`, `is_rich_content` | Supports multi-language responses plus structured payloads (cards, API output). |
| `intent_fulfillments` | `intent_id` unique FK, `enabled`, webhook URL/method, headers, payload template | One-to-one webhook execution settings with timeout control. |
| `intent_branches` | `intent_id` FK, `expression`, `true_intent_id`, `false_intent_id` | Evaluates expressions to route to follow-up intents. |
| `intent_input_contexts` | `intent_id` FK, `name` (unique per intent) | Declares contexts required to match an intent. |
| `intent_output_contexts` | `intent_id` FK, `name` (unique per intent), `lifespan_turns` | Emits contexts with configurable lifespan after response. |
| `bot_fallbacks` | `project_id` FK, `language`, serialized fallback body, timestamps | Project-level fallback message per locale with sanitized rich content parts. |
| `intent_fallbacks` | `intent_id` FK, `language`, serialized fallback body, timestamps | Intent-specific fallback override per locale. |

Fallback content is stored as JSON-encoded text; helper methods sanitize nested rich content parts before persistence.

## Repository Layout
- `app/main.py` wires routers, startup hooks, and health checks
- `app/core/config.py` centralizes Pydantic settings (`CHATBOT_DATABASE_URL`, data dirs)
- Layered backend modules:
  - `app/schemas/`, `app/models/`, `app/crud/`, `app/services/`, `app/routers/`
  - `app/utils/` hosts shared helpers like language detection
  - `app/chatterbot_ext/manager.py` manages per-project ChatterBot instances
- `frontend/` contains the Vite React console (React Flow designer, chat tester)
- `data/` stores the SQLite database and generated ChatterBot artifacts
- `tests/` mirrors `app/` for pytest suites; add integration markers where needed

## Quick Start
```bash
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload

# optional: run the React console in another terminal
cd frontend && npm install && npm run dev
```
Visit `http://localhost:8000/docs` for interactive API docs and `http://localhost:5173` for the UI (Vite proxies `/api` to FastAPI).

## Environment & Data
- Duplicate `.env.example` → `.env`; set `CHATBOT_DATABASE_URL` to a scratch SQLite file during local work.
- Generated databases and ChatterBot corpora must stay under `data/`. Keep credentials out of source control.
- Alembic migrations live in `alembic/`; run with `alembic revision --autogenerate -m "describe change"` then `alembic upgrade head`.

## Development Workflow
- Run style and import hygiene checks with `ruff --select F401,F841 .`.
- Validate typing-friendly bytecode with `python -m compileall app`.
- Execute tests via `pytest` (unit) and `pytest -k "integration" --maxfail=1` (heavier flows). Use `httpx.AsyncClient` + FastAPI lifespan fixtures for router tests.
- Keep routers thin; push business logic into `services` and persistence into `crud` with dependency injection (`Depends`).

## API Highlights
- `POST /projects` create a project with supported languages & confidence threshold
- `POST /projects/{project_id}/intents` add intents, training phrases, responses
- `PUT /projects/{project_id}/fallback` configure per-language fallback content
- `POST /projects/{project_id}/chat` fetch runtime responses (pass `session_id` for follow-ups)
- `DELETE /projects/{project_id}/intents/{intent_id}` cascade-removes phrases, responses, fallbacks

Use the React console (`frontend/src`) as reference for Axios usage (`src/lib/api.ts`) and intent tree visualisation.

## Scaling & Extensibility
1. Switch `CHATBOT_DATABASE_URL` to PostgreSQL; tune pooling and run Alembic migrations.
2. Offload intensive retraining to a background worker by queueing `chatbot_manager.reset_project` calls.
3. Capture analytics by logging chat responses into a warehouse and surfacing dashboards.
4. Extend `app/utils/language.py` for additional locales, normalization, or transliteration rules.

## Contributing
- Write imperative commit subjects (e.g., `Add Malay fallback seeding`).
- Summarize API or schema impacts in PR descriptions, link issues, and attach test logs or screenshots when HTTP responses change.
- Confirm the FastAPI server starts and the relevant pytest suites pass before requesting review.
