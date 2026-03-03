import json

from flask import Blueprint, request, jsonify

from backend.db import DATA_DIR
from backend.prompts import REVIEW_GUIDED, REVIEW_SPECIFIC, PREPARE_GUIDED, PREPARE_SPECIFIC, SUMMARY_REVIEW, SUMMARY_PREPARE

admin_bp = Blueprint('admin', __name__)

ADMIN_PASSWORD = 'adam_edits'
PROMPTS_OVERRIDE_PATH = DATA_DIR / 'prompts_override.json'

DEFAULTS = {
    'review_guided':    REVIEW_GUIDED,
    'review_specific':  REVIEW_SPECIFIC,
    'prepare_guided':   PREPARE_GUIDED,
    'prepare_specific': PREPARE_SPECIFIC,
    'summary_review':   SUMMARY_REVIEW,
    'summary_prepare':  SUMMARY_PREPARE,
}


def _load_overrides():
    if PROMPTS_OVERRIDE_PATH.exists():
        try:
            with open(PROMPTS_OVERRIDE_PATH) as f:
                return json.load(f)
        except Exception:
            pass
    return {}


def _save_overrides(overrides):
    with open(PROMPTS_OVERRIDE_PATH, 'w') as f:
        json.dump(overrides, f, indent=2)


@admin_bp.route('/api/admin/prompts', methods=['POST'])
def get_prompts():
    data = request.get_json(silent=True) or {}
    if data.get('password') != ADMIN_PASSWORD:
        return jsonify(error='Wrong password.'), 401
    overrides = _load_overrides()
    prompts = {k: overrides.get(k, v) for k, v in DEFAULTS.items()}
    return jsonify(prompts=prompts)


@admin_bp.route('/api/admin/note-default', methods=['POST'])
def get_default_note():
    data = request.get_json(silent=True) or {}
    if data.get('password') != ADMIN_PASSWORD:
        return jsonify(error='Wrong password.'), 401
    from backend.db import load_default_note
    return jsonify(note=load_default_note())


@admin_bp.route('/api/admin/prompts', methods=['PUT'])
def save_prompts():
    data = request.get_json(silent=True) or {}
    if data.get('password') != ADMIN_PASSWORD:
        return jsonify(error='Wrong password.'), 401
    incoming = data.get('prompts') or {}
    allowed = set(DEFAULTS.keys())
    overrides = _load_overrides()
    for k, v in incoming.items():
        if k in allowed:
            if v and v.strip():
                overrides[k] = v
            else:
                overrides.pop(k, None)   # empty string = reset to default
    _save_overrides(overrides)
    return jsonify(ok=True)
