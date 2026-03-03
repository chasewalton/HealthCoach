"""
HealthCoach Flask Backend
Serves index.html at / and all /api/* routes from the same origin.
"""

# ============================================================
# IMPORTS & CONFIG
# ============================================================
import os
import uuid
import json
import sqlite3
from pathlib import Path
from datetime import datetime, timezone

import bcrypt
from flask import Flask, request, session, jsonify, send_from_directory, abort
from openai import OpenAI

app = Flask(__name__, static_folder=None)
app.secret_key = os.environ.get('FLASK_SECRET_KEY', 'dev-only-insecure-key')

# Resolve data directory — works both locally and on Render persistent disk
DATA_DIR = Path(os.environ.get('DATA_DIR', 'data'))
DATA_DIR.mkdir(parents=True, exist_ok=True)
DB_PATH = DATA_DIR / 'healthcoach.db'

openai_client = OpenAI(
    api_key=os.environ.get('OPENROUTER_API_KEY', ''),
    base_url='https://openrouter.ai/api/v1',
    default_headers={
        'HTTP-Referer': os.environ.get('APP_URL', 'https://healthcoach-ai-bidmc.onrender.com'),
        'X-Title': 'HealthCoach',
    },
)

# ============================================================
# DATABASE
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
                model_pref  TEXT DEFAULT 'gpt-4o'
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

# Called at module level so gunicorn picks it up
init_db()


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
    note_path = Path('data') / 'default_note.json'
    if note_path.exists():
        with open(note_path) as f:
            return json.load(f)
    return {}


# ============================================================
# STATIC — serve index.html for all non-API paths
# ============================================================
@app.route('/')
def index():
    return send_from_directory('.', 'index.html')


@app.errorhandler(404)
def not_found(e):
    # Return index.html for any non-API 404 (SPA routing)
    if request.path.startswith('/api/'):
        return jsonify(error='Not found'), 404
    return send_from_directory('.', 'index.html')


# ============================================================
# AUTH
# ============================================================
@app.route('/api/auth/register', methods=['POST'])
def register():
    data = request.get_json(silent=True) or {}
    username = (data.get('username') or '').strip().lower()
    password = data.get('password') or ''
    display_name = (data.get('displayName') or username).strip()

    if not username or not password:
        return jsonify(error='Username and password are required.'), 400
    if len(password) < 4:
        return jsonify(error='Password must be at least 4 characters.'), 400

    pw_hash = bcrypt.hashpw(password.encode(), bcrypt.gensalt(rounds=10)).decode()

    try:
        with get_db() as conn:
            cur = conn.execute(
                'INSERT INTO users (username, password_hash, display_name, created_at) VALUES (?,?,?,?)',
                (username, pw_hash, display_name, now_iso())
            )
            user_id = cur.lastrowid
            conn.execute(
                'INSERT INTO profiles (user_id, name) VALUES (?,?)',
                (user_id, display_name)
            )
    except sqlite3.IntegrityError:
        return jsonify(error='Username already exists.'), 409

    session['user_id'] = user_id
    session['username'] = username
    session['display_name'] = display_name
    return jsonify(userId=user_id, username=username, displayName=display_name), 201


@app.route('/api/auth/login', methods=['POST'])
def login():
    data = request.get_json(silent=True) or {}
    username = (data.get('username') or '').strip().lower()
    password = data.get('password') or ''

    with get_db() as conn:
        row = conn.execute('SELECT * FROM users WHERE username=?', (username,)).fetchone()

    if not row or not bcrypt.checkpw(password.encode(), row['password_hash'].encode()):
        return jsonify(error='Incorrect username or password.'), 401

    session['user_id'] = row['id']
    session['username'] = row['username']
    session['display_name'] = row['display_name']
    return jsonify(userId=row['id'], username=row['username'], displayName=row['display_name'])


@app.route('/api/auth/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify(ok=True)


@app.route('/api/auth/me', methods=['GET'])
def me():
    uid = current_user_id()
    if not uid:
        return jsonify(error='Not authenticated'), 401
    return jsonify(userId=uid, username=session.get('username'), displayName=session.get('display_name'))


# ============================================================
# PROFILE
# ============================================================
@app.route('/api/profile', methods=['GET'])
def get_profile():
    uid = require_auth()
    with get_db() as conn:
        row = conn.execute('SELECT * FROM profiles WHERE user_id=?', (uid,)).fetchone()
    if not row:
        return jsonify({})
    return jsonify(dict(row))


@app.route('/api/profile', methods=['PUT'])
def update_profile():
    uid = require_auth()
    data = request.get_json(silent=True) or {}
    fields = ['name', 'dob', 'gender', 'language', 'literacy', 'interpreter', 'education', 'model_pref']
    updates = {k: data.get(k) for k in fields if k in data}

    with get_db() as conn:
        existing = conn.execute('SELECT user_id FROM profiles WHERE user_id=?', (uid,)).fetchone()
        if existing:
            if updates:
                set_clause = ', '.join(f'{k}=?' for k in updates)
                conn.execute(
                    f'UPDATE profiles SET {set_clause} WHERE user_id=?',
                    list(updates.values()) + [uid]
                )
        else:
            conn.execute(
                'INSERT INTO profiles (user_id) VALUES (?)', (uid,)
            )
            if updates:
                set_clause = ', '.join(f'{k}=?' for k in updates)
                conn.execute(
                    f'UPDATE profiles SET {set_clause} WHERE user_id=?',
                    list(updates.values()) + [uid]
                )
        # Sync display name to users table if name provided
        if 'name' in updates and updates['name']:
            conn.execute('UPDATE users SET display_name=? WHERE id=?', (updates['name'], uid))
            session['display_name'] = updates['name']

    return jsonify(ok=True)


# ============================================================
# RECORD
# ============================================================
@app.route('/api/record', methods=['GET'])
def get_record():
    uid = require_auth()
    with get_db() as conn:
        row = conn.execute(
            'SELECT * FROM records WHERE user_id=? ORDER BY created_at DESC LIMIT 1', (uid,)
        ).fetchone()

    if row:
        try:
            content = json.loads(row['content'])
        except (json.JSONDecodeError, TypeError):
            content = {'type': 'plaintext', 'text': row['content']}
        return jsonify(content=content, isDefault=bool(row['is_default']))

    # No record yet — return built-in default
    default = load_default_note()
    return jsonify(content=default, isDefault=True)


@app.route('/api/record', methods=['POST'])
def upload_record():
    uid = require_auth()
    data = request.get_json(silent=True) or {}
    raw = data.get('content')

    if not raw:
        return jsonify(error='content is required'), 400

    if isinstance(raw, str):
        content_str = json.dumps({'type': 'plaintext', 'text': raw})
    elif isinstance(raw, dict):
        content_str = json.dumps(raw)
    else:
        return jsonify(error='content must be string or object'), 400

    with get_db() as conn:
        conn.execute(
            'INSERT INTO records (user_id, content, is_default, created_at) VALUES (?,?,0,?)',
            (uid, content_str, now_iso())
        )

    return jsonify(ok=True), 201


# ============================================================
# CHAT
# ============================================================
MODEL_MAP = {
    'gpt-5.2':  'openai/gpt-4o',
    'gpt-4o':   'openai/gpt-4o',
    'claude-3': 'anthropic/claude-3-5-sonnet',
}

REVIEW_SYSTEM = """You are HealthCoach, a warm and patient health literacy assistant helping a patient understand their recent clinic visit.

You have access to the patient's SOAP note below. Walk the patient through the note section by section (Subjective → Objective → Assessment → Plan), explaining medical terms in plain language appropriate for the patient's literacy level.

Be conversational, encouraging, and brief. Use bullet points for clarity. Never guess or fabricate medical information — only explain what's in the note. If the patient asks something outside the note, say you don't have that information and suggest they ask their provider.

Patient literacy level: {literacy}
Patient language preference: {language}

SOAP NOTE:
{record}
"""

PREPARE_SYSTEM = """You are HealthCoach, a warm health coaching assistant helping a patient prepare for an upcoming clinic visit.

Guide the patient through 4 sections:
1. What Matters Most — their main concern or goal for the visit
2. 6-Month Health — any new symptoms, ER visits, lab tests, or medication changes since last visit
3. Getting It Right — whether their last visit met their needs, any communication concerns
4. Wrap-Up — summarize what they've shared and encourage them to share with their provider

Be conversational, empathetic, and brief. Ask one focused question at a time. Acknowledge their answers warmly before moving on.

Patient literacy level: {literacy}
Patient language preference: {language}
"""

@app.route('/api/chat', methods=['POST'])
def chat():
    uid = require_auth()
    data = request.get_json(silent=True) or {}
    message = (data.get('message') or '').strip()
    history = data.get('history') or []
    mode = data.get('mode') or 'review'
    record = data.get('record') or {}

    if not message:
        return jsonify(error='message is required'), 400

    # Fetch profile for personalization
    with get_db() as conn:
        profile_row = conn.execute('SELECT * FROM profiles WHERE user_id=?', (uid,)).fetchone()
    profile = dict(profile_row) if profile_row else {}

    literacy = profile.get('literacy') or 'high'
    language = profile.get('language') or 'en'
    model_pref = profile.get('model_pref') or 'gpt-4o'
    model = MODEL_MAP.get(model_pref, 'openai/gpt-4o')

    # Build system prompt
    if mode == 'review':
        record_str = json.dumps(record, indent=2) if record else '(No SOAP note provided)'
        system_prompt = REVIEW_SYSTEM.format(
            literacy=literacy, language=language, record=record_str
        )
    else:
        system_prompt = PREPARE_SYSTEM.format(literacy=literacy, language=language)

    # Trim history to last 20 turns
    trimmed_history = history[-20:] if len(history) > 20 else history

    messages = [{'role': 'system', 'content': system_prompt}]
    for turn in trimmed_history:
        role = turn.get('role')
        content = turn.get('content', '')
        if role in ('user', 'assistant') and content:
            messages.append({'role': role, 'content': content})
    messages.append({'role': 'user', 'content': message})

    try:
        response = openai_client.chat.completions.create(
            model=model,
            messages=messages,
            max_tokens=600,
            temperature=0.7,
        )
        reply = response.choices[0].message.content.strip()
        return jsonify(reply=reply)
    except Exception as e:
        app.logger.error('OpenAI error: %s', e)
        return jsonify(error='AI service unavailable. Please try again shortly.'), 502


# ============================================================
# SESSIONS
# ============================================================
@app.route('/api/sessions', methods=['GET'])
def list_sessions():
    uid = require_auth()
    with get_db() as conn:
        rows = conn.execute(
            'SELECT id, mode, date_label, messages FROM sessions WHERE user_id=? ORDER BY created_at DESC LIMIT 20',
            (uid,)
        ).fetchall()
    result = []
    for row in rows:
        try:
            msgs = json.loads(row['messages'])
        except (json.JSONDecodeError, TypeError):
            msgs = []
        result.append({
            'id': row['id'],
            'mode': row['mode'],
            'date': row['date_label'],
            'messages': msgs,
        })
    return jsonify(sessions=result)


@app.route('/api/sessions', methods=['POST'])
def save_session():
    uid = require_auth()
    data = request.get_json(silent=True) or {}
    messages = data.get('messages') or []
    mode = data.get('mode') or 'review'
    date_label = data.get('date') or datetime.now().strftime('%b %d, %Y')
    session_id = data.get('id') or str(uuid.uuid4())

    if not messages:
        return jsonify(error='messages required'), 400

    with get_db() as conn:
        existing = conn.execute('SELECT id FROM sessions WHERE id=?', (session_id,)).fetchone()
        if existing:
            conn.execute(
                'UPDATE sessions SET messages=?, date_label=? WHERE id=? AND user_id=?',
                (json.dumps(messages), date_label, session_id, uid)
            )
        else:
            conn.execute(
                'INSERT INTO sessions (id, user_id, mode, date_label, messages, created_at) VALUES (?,?,?,?,?,?)',
                (session_id, uid, mode, date_label, json.dumps(messages), now_iso())
            )
    return jsonify(id=session_id), 201


@app.route('/api/sessions/<session_id>', methods=['GET'])
def get_session(session_id):
    uid = require_auth()
    with get_db() as conn:
        row = conn.execute(
            'SELECT * FROM sessions WHERE id=? AND user_id=?', (session_id, uid)
        ).fetchone()
    if not row:
        return jsonify(error='Session not found'), 404
    try:
        msgs = json.loads(row['messages'])
    except (json.JSONDecodeError, TypeError):
        msgs = []
    return jsonify(id=row['id'], mode=row['mode'], date=row['date_label'], messages=msgs)


# ============================================================
# ENTRY POINT
# ============================================================
if __name__ == '__main__':
    app.run(debug=True, port=5000)
