"""
Database helpers: init, connection, auth guard, utilities.
"""
import os
import json
import sqlite3
from pathlib import Path
from datetime import datetime, timezone

from flask import session, abort

# ============================================================
# PATHS
# ============================================================
DATA_DIR = Path(os.environ.get('DATA_DIR', 'data'))
DATA_DIR.mkdir(parents=True, exist_ok=True)
DB_PATH = DATA_DIR / 'healthcoach.db'


# ============================================================
# INIT
# ============================================================
def init_db():
    with sqlite3.connect(DB_PATH) as conn:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS users (
                id           INTEGER PRIMARY KEY AUTOINCREMENT,
                username     TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                display_name TEXT NOT NULL,
                created_at   TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS profiles (
                user_id     INTEGER PRIMARY KEY REFERENCES users(id),
                name        TEXT,
                dob         TEXT,
                gender      TEXT,
                language    TEXT DEFAULT 'en',
                literacy    TEXT DEFAULT 'high',
                interpreter TEXT DEFAULT 'no',
                education   TEXT,
                model_pref  TEXT DEFAULT 'gpt-5.2'
            );

            CREATE TABLE IF NOT EXISTS records (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id    INTEGER NOT NULL REFERENCES users(id),
                content    TEXT NOT NULL,
                is_default INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS sessions (
                id         TEXT PRIMARY KEY,
                user_id    INTEGER NOT NULL REFERENCES users(id),
                mode       TEXT NOT NULL,
                date_label TEXT NOT NULL,
                messages   TEXT NOT NULL,
                created_at TEXT NOT NULL
            );
        """)


# ============================================================
# HELPERS
# ============================================================
def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def current_user_id():
    return session.get('user_id')


def require_auth():
    uid = current_user_id()
    if not uid:
        abort(401)
    return uid


def now_iso():
    return datetime.now(timezone.utc).isoformat()


def load_default_note():
    note_path = DATA_DIR / 'default_note.json'
    if note_path.exists():
        with open(note_path) as f:
            return json.load(f)
    return {}
