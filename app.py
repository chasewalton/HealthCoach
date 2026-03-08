import os

from dotenv import load_dotenv
load_dotenv()

from flask import Flask, send_from_directory, jsonify, request

from backend.db import init_db
from backend.auth import auth_bp
from backend.profile import profile_bp
from backend.record import record_bp
from backend.chat import chat_bp
from backend.sessions import sessions_bp
from backend.admin import admin_bp

app = Flask(__name__)
app.secret_key = os.environ.get('FLASK_SECRET_KEY', 'dev-only-insecure-key')

for bp in [auth_bp, profile_bp, record_bp, chat_bp, sessions_bp, admin_bp]:
    app.register_blueprint(bp)


@app.route('/')
def index():
    return send_from_directory('frontend', 'index.html')


@app.errorhandler(404)
def not_found(e):
    if request.path.startswith('/api/'):
        return jsonify(error='Not found'), 404
    return send_from_directory('frontend', 'index.html')


init_db()

if __name__ == '__main__':
    app.run(debug=True, port=5001)
