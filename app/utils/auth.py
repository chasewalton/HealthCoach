"""Account store: register, verify, get/update profile.

Accounts are stored in DATA_DIR/accounts.json.

Schema:
{
  username: {
    password_hash: str,
    created_at: str,
    profile: {
      display_name, dob, primary_language, interpreter_needed,
      education_level, health_literacy, gender
    }
  }
}
"""
import os
from datetime import datetime, timezone
from typing import Tuple, Optional

import bcrypt

from app.utils.storage import read_json, write_json


def _data_dir() -> str:
    d = os.getenv("DATA_DIR", "")
    if d:
        return os.path.abspath(d)
    # app/utils/auth.py -> go up two levels to app/, then to app/data
    return os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data"))


def _accounts_path() -> str:
    return os.path.join(_data_dir(), "accounts.json")


def _read_accounts() -> dict:
    data = read_json(_accounts_path(), default={})
    return data or {}


def _write_accounts(accounts: dict) -> None:
    write_json(_accounts_path(), accounts)


def register_user(username: str, password: str, display_name: str = "") -> Tuple[bool, Optional[str]]:
    """Register a new user. Returns (True, None) on success or (False, error_msg)."""
    username = (username or "").strip().lower()
    if not username:
        return False, "Username is required"
    if len(username) < 3:
        return False, "Username must be at least 3 characters"
    if len(password) < 6:
        return False, "Password must be at least 6 characters"

    accounts = _read_accounts()
    if username in accounts:
        return False, "Username already taken"

    hashed = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
    accounts[username] = {
        "password_hash": hashed,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "profile": {
            "display_name": display_name or "",
            "dob": "",
            "primary_language": "en",
            "interpreter_needed": None,
            "education_level": "",
            "health_literacy": "",
            "gender": "",
        },
    }
    _write_accounts(accounts)
    return True, None


def verify_user(username: str, password: str) -> bool:
    """Return True if the username/password pair is valid."""
    username = (username or "").strip().lower()
    accounts = _read_accounts()
    entry = accounts.get(username)
    if not entry:
        return False
    stored_hash = entry.get("password_hash", "")
    try:
        return bcrypt.checkpw(password.encode("utf-8"), stored_hash.encode("utf-8"))
    except Exception:
        return False


def get_profile(username: str) -> dict:
    """Return the profile dict for the given username, or {} if not found."""
    username = (username or "").strip().lower()
    accounts = _read_accounts()
    entry = accounts.get(username)
    if not entry:
        return {}
    return dict(entry.get("profile") or {})


def update_profile(username: str, fields: dict) -> bool:
    """Merge allowed fields into the user's profile. Returns True on success."""
    username = (username or "").strip().lower()
    accounts = _read_accounts()
    if username not in accounts:
        return False
    profile = accounts[username].setdefault("profile", {})
    allowed = {"display_name", "dob", "primary_language", "interpreter_needed",
               "education_level", "health_literacy", "gender"}
    for k, v in (fields or {}).items():
        if k in allowed:
            profile[k] = v
    _write_accounts(accounts)
    return True
