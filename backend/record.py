import json

from flask import Blueprint, request, jsonify

from backend.db import get_db, require_auth, now_iso, load_default_note

record_bp = Blueprint('record', __name__)


@record_bp.route('/api/record', methods=['GET'])
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

    default = load_default_note()
    return jsonify(content=default, isDefault=True)


@record_bp.route('/api/record', methods=['POST'])
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
