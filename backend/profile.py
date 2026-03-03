"""
Profile blueprint: /api/profile
"""
from flask import Blueprint, request, session, jsonify

from backend.db import get_db, require_auth

profile_bp = Blueprint('profile', __name__)


@profile_bp.route('/api/profile', methods=['GET'])
def get_profile():
    uid = require_auth()
    with get_db() as conn:
        row = conn.execute('SELECT * FROM profiles WHERE user_id=?', (uid,)).fetchone()
    if not row:
        return jsonify({})
    return jsonify(dict(row))


@profile_bp.route('/api/profile', methods=['PUT'])
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
            conn.execute('INSERT INTO profiles (user_id) VALUES (?)', (uid,))
            if updates:
                set_clause = ', '.join(f'{k}=?' for k in updates)
                conn.execute(
                    f'UPDATE profiles SET {set_clause} WHERE user_id=?',
                    list(updates.values()) + [uid]
                )
        if 'name' in updates and updates['name']:
            conn.execute('UPDATE users SET display_name=? WHERE id=?', (updates['name'], uid))
            session['display_name'] = updates['name']

    return jsonify(ok=True)
