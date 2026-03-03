import json
import uuid
from datetime import datetime

from flask import Blueprint, request, jsonify

from backend.db import get_db, require_auth, now_iso

sessions_bp = Blueprint('sessions', __name__)


@sessions_bp.route('/api/sessions', methods=['GET'])
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


@sessions_bp.route('/api/sessions', methods=['POST'])
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


@sessions_bp.route('/api/sessions/<session_id>', methods=['GET'])
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
