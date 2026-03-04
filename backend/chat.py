import os

from flask import Blueprint, request, jsonify, current_app
from openai import OpenAI

from backend.db import get_db, require_auth
from backend.prompts import MODEL_MAP, get_system_prompt, SUMMARY_REVIEW, SUMMARY_PREPARE, _get_override

chat_bp = Blueprint('chat', __name__)

openai_client = OpenAI(
    api_key=os.environ.get('OPENROUTER_API_KEY', ''),
    base_url='https://openrouter.ai/api/v1',
    default_headers={'X-Title': 'HealthCoach'},
)


@chat_bp.route('/api/chat', methods=['POST'])
def chat():
    uid = require_auth()
    data = request.get_json(silent=True) or {}
    message = (data.get('message') or '').strip()
    history = data.get('history') or []
    mode = data.get('mode') or 'review'
    path = data.get('path') or 'guided'
    record = data.get('record') or {}

    if not message:
        return jsonify(error='message is required'), 400

    with get_db() as conn:
        profile_row = conn.execute('SELECT * FROM profiles WHERE user_id=?', (uid,)).fetchone()
    profile = dict(profile_row) if profile_row else {}

    literacy = profile.get('literacy') or 'high'
    language = profile.get('language') or 'en'
    model_pref = profile.get('model_pref') or 'gpt-5.2'
    model = MODEL_MAP.get(model_pref, 'openai/gpt-5.2-2025-12-11')

    system_prompt = get_system_prompt(mode, path, literacy, language, record if mode == 'review' else None)

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
            max_tokens=900,
            temperature=0.7,
        )
        reply = response.choices[0].message.content.strip()
        return jsonify(reply=reply)
    except Exception as e:
        current_app.logger.error('OpenAI error: %s', e)
        return jsonify(error='AI service unavailable. Please try again shortly.'), 502


@chat_bp.route('/api/summary', methods=['POST'])
def generate_summary():
    uid = require_auth()
    data = request.get_json(silent=True) or {}
    history = data.get('history') or []
    mode = data.get('mode') or 'review'

    if not history:
        return jsonify(error='No conversation to summarize.'), 400

    with get_db() as conn:
        profile_row = conn.execute('SELECT * FROM profiles WHERE user_id=?', (uid,)).fetchone()
    profile = dict(profile_row) if profile_row else {}

    literacy = profile.get('literacy') or 'high'
    language = profile.get('language') or 'en'
    model_pref = profile.get('model_pref') or 'gpt-5.2'
    model = MODEL_MAP.get(model_pref, 'openai/gpt-5.2-2025-12-11')

    key = 'summary_review' if mode == 'review' else 'summary_prepare'
    default = SUMMARY_REVIEW if mode == 'review' else SUMMARY_PREPARE
    template = _get_override(key) or default
    system_prompt = template.format(literacy=literacy, language=language)

    conversation = '\n'.join(
        f"{'Patient' if m.get('role') == 'user' else 'HealthCoach'}: {m.get('content', '')}"
        for m in history
        if m.get('role') in ('user', 'assistant') and m.get('content', '').strip()
    )

    messages = [
        {'role': 'system', 'content': system_prompt},
        {'role': 'user', 'content': f"Here is the conversation:\n\n{conversation}\n\nPlease write the summary now."},
    ]

    try:
        response = openai_client.chat.completions.create(
            model=model,
            messages=messages,
            max_tokens=800,
            temperature=0.5,
        )
        summary = response.choices[0].message.content.strip()
        return jsonify(summary=summary)
    except Exception as e:
        current_app.logger.error('Summary error: %s', e)
        return jsonify(error='Could not generate summary. Please try again.'), 502
