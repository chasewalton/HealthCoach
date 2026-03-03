"""
Auth blueprint: /api/auth/*
"""
import sqlite3

import bcrypt
from flask import Blueprint, request, session, jsonify

from backend.db import get_db, current_user_id, now_iso

auth_bp = Blueprint('auth', __name__)


@auth_bp.route('/api/auth/register', methods=['POST'])
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


@auth_bp.route('/api/auth/login', methods=['POST'])
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


@auth_bp.route('/api/auth/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify(ok=True)


@auth_bp.route('/api/auth/me', methods=['GET'])
def me():
    uid = current_user_id()
    if not uid:
        return jsonify(error='Not authenticated'), 401
    return jsonify(userId=uid, username=session.get('username'), displayName=session.get('display_name'))
