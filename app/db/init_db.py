from sqlalchemy import text

from app.db.session import Base, engine
from app import models  # noqa: F401 ensures models are registered


def init_db() -> None:
    Base.metadata.create_all(bind=engine)
    _apply_sqlite_patches()


def _apply_sqlite_patches() -> None:
    if engine.dialect.name != "sqlite":
        return
    with engine.begin() as conn:
        project_columns = {
            row[1]
            for row in conn.execute(text("PRAGMA table_info(bot_projects);")).fetchall()
        }
        if "confidence_threshold" not in project_columns:
            conn.execute(
                text(
                    "ALTER TABLE bot_projects "
                    "ADD COLUMN confidence_threshold FLOAT DEFAULT 0.7"
                )
            )
            conn.execute(
                text(
                    "UPDATE bot_projects SET confidence_threshold = 0.7 "
                    "WHERE confidence_threshold IS NULL"
                )
            )

        intent_columns = {
            row[1]
            for row in conn.execute(text("PRAGMA table_info(intents);")).fetchall()
        }
        if "parent_intent_id" not in intent_columns:
            conn.execute(
                text(
                    "ALTER TABLE intents "
                    "ADD COLUMN parent_intent_id INTEGER REFERENCES intents(id)"
                )
            )
        if "is_fallback" not in intent_columns:
            conn.execute(
                text(
                    "ALTER TABLE intents "
                    "ADD COLUMN is_fallback BOOLEAN DEFAULT 0"
                )
            )
        if "is_default_welcome" not in intent_columns:
            conn.execute(
                text(
                    "ALTER TABLE intents "
                    "ADD COLUMN is_default_welcome BOOLEAN DEFAULT 0"
                )
            )

        conn.execute(
            text(
                "UPDATE intents SET is_fallback = 0 WHERE is_fallback IS NULL"
            )
        )
        conn.execute(
            text(
                "UPDATE intents SET is_default_welcome = 0 WHERE is_default_welcome IS NULL"
            )
        )

        response_columns = {
            row[1]
            for row in conn.execute(text("PRAGMA table_info(intent_responses);"))
        }
        if "response_type" not in response_columns:
            conn.execute(
                text(
                    "ALTER TABLE intent_responses "
                    "ADD COLUMN response_type TEXT DEFAULT 'text'"
                )
            )
        if "payload" not in response_columns:
            conn.execute(
                text(
                    "ALTER TABLE intent_responses "
                    "ADD COLUMN payload JSON"
                )
            )
        if "text" in response_columns:
            # Ensure existing text rows are not null
            conn.execute(
                text(
                    "UPDATE intent_responses SET text = '' WHERE text IS NULL"
                )
            )

        fulfillment_columns = {
            row[1]
            for row in conn.execute(text("PRAGMA table_info(intent_fulfillments);"))
        }
        if "save_as" not in fulfillment_columns:
            conn.execute(
                text(
                    "ALTER TABLE intent_fulfillments "
                    "ADD COLUMN save_as TEXT"
                )
            )

        branch_tables = conn.execute(
            text(
                "SELECT name FROM sqlite_master WHERE type='table' AND name='intent_branches'"
            )
        ).fetchall()
        if not branch_tables:
            conn.execute(
                text(
                    "CREATE TABLE intent_branches ("
                    "id INTEGER PRIMARY KEY AUTOINCREMENT,"
                    "intent_id INTEGER NOT NULL REFERENCES intents(id) ON DELETE CASCADE,"
                    "expression TEXT NOT NULL,"
                    "true_intent_id INTEGER REFERENCES intents(id),"
                    "false_intent_id INTEGER REFERENCES intents(id)"
                    ")"
                )
            )

        fallback_tables = conn.execute(
            text(
                "SELECT name FROM sqlite_master WHERE type='table' AND name='intent_fallbacks'"
            )
        ).fetchall()
        if not fallback_tables:
            conn.execute(
                text(
                    "CREATE TABLE intent_fallbacks ("
                    "id INTEGER PRIMARY KEY AUTOINCREMENT,"
                    "intent_id INTEGER NOT NULL REFERENCES intents(id) ON DELETE CASCADE,"
                    "language TEXT NOT NULL,"
                    "text TEXT NOT NULL,"
                    "updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,"
                    "UNIQUE(intent_id, language)"
                    ")"
                )
            )
