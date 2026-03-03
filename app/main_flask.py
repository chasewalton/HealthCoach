# app/main_flask.py
from flask import Flask, request, jsonify, send_file, redirect, session
from flask_cors import CORS
import os
import secrets
from app.llm_client import LlamaClient, OpenAIClient, create_client
from app.schemas import ChatRequest, ChatResponse, SummarizeRequest, SummarizeResponse
from app.services.chat_flow import get_next_reply
from app.services.extract_structured import extract_structured
from app.services.summary import generate_doctor_summary
from app.utils.summary import build_clinician_summary
from app.utils.storage import append_row_to_csv, write_json, read_json, ensure_parent_dir, list_files
from app.utils.auth import register_user, verify_user, get_profile as get_account_profile, update_profile as update_account_profile
import app.prompts as _prompts
from datetime import datetime, timezone
import uuid
import json as _json
import shutil
import io
import zipfile

# Serve static files from ../frontend at URL prefix /frontend
app = Flask(
    __name__,
    static_folder="../frontend",
    static_url_path="/frontend",
)
CORS(app)
app.secret_key = os.getenv("SECRET_KEY", secrets.token_hex(32))

default_client = create_client()

def get_client_for(provider: str = "", model: str = ""):
    prov = (provider or "").strip().lower()
    mdl = (model or "").strip()
    if prov == "openai":
        client = OpenAIClient()
        if mdl:
            client.model = mdl
        return client
    # default: use smart provider detection
    client = create_client()
    if mdl:
        client.model = mdl
    return client


@app.get("/")
def root():
    return redirect("/ui")


# Simple route to return the main HTML file
@app.get("/ui")
def ui():
    # This serves frontend/index.html
    return app.send_static_file("index.html")


@app.post("/auth/register")
def auth_register():
    data = request.get_json(force=True) or {}
    username = (data.get("username") or "").strip().lower()
    password = (data.get("password") or "").strip()
    display_name = (data.get("display_name") or "").strip()
    ok, err = register_user(username, password, display_name)
    if not ok:
        return jsonify({"error": err}), 409
    session["username"] = username
    profile = get_account_profile(username)
    return jsonify({"username": username, "profile": profile}), 201


@app.post("/auth/login")
def auth_login():
    data = request.get_json(force=True) or {}
    username = (data.get("username") or "").strip().lower()
    password = (data.get("password") or "").strip()
    if not verify_user(username, password):
        return jsonify({"error": "Invalid username or password"}), 401
    session["username"] = username
    profile = get_account_profile(username)
    return jsonify({"username": username, "profile": profile})


@app.post("/auth/logout")
def auth_logout():
    session.clear()
    return jsonify({"ok": True})


@app.get("/auth/me")
def auth_me():
    username = session.get("username")
    if not username:
        return jsonify({"error": "Not authenticated"}), 401
    profile = get_account_profile(username)
    return jsonify({"username": username, "profile": profile})


@app.put("/auth/profile")
def auth_profile_update():
    username = session.get("username")
    if not username:
        return jsonify({"error": "Not authenticated"}), 401
    data = request.get_json(force=True) or {}
    allowed = {"display_name", "dob", "primary_language", "interpreter_needed",
               "education_level", "health_literacy", "gender"}
    fields = {k: v for k, v in data.items() if k in allowed}
    update_account_profile(username, fields)
    profile = get_account_profile(username)
    return jsonify({"profile": profile})


# ---- Prompt editor (password-gated) ----
EDITOR_PASSWORD = (os.getenv("EDITOR_PASSWORD", "editor") or "editor").strip()

_EDITABLE_PROMPTS = ["SURVEY_CONDUCTOR_PROMPT", "REVIEW_SOAP_PROMPT"]


@app.get("/editor")
def editor_ui():
    return app.send_static_file("editor.html")


@app.post("/editor/auth")
def editor_auth():
    data = request.get_json(force=True) or {}
    password = (data.get("password") or "").strip()
    if password == EDITOR_PASSWORD:
        session["editor"] = True
        return jsonify({"ok": True})
    return jsonify({"error": "Wrong password"}), 401


@app.get("/editor/prompts")
def editor_get_prompts():
    if not session.get("editor"):
        return jsonify({"error": "Not authorized"}), 401
    result = {}
    for name in _EDITABLE_PROMPTS:
        result[name] = getattr(_prompts, name, "")
    return jsonify(result)


@app.put("/editor/prompts")
def editor_save_prompts():
    if not session.get("editor"):
        return jsonify({"error": "Not authorized"}), 401
    data = request.get_json(force=True) or {}
    for name in _EDITABLE_PROMPTS:
        if name in data and isinstance(data[name], str):
            setattr(_prompts, name, data[name])
    return jsonify({"ok": True})


@app.post("/chat")
def chat():
    try:
        data = request.get_json(force=True)
        req = ChatRequest(**data)
        messages = [m.model_dump() for m in req.messages]
        client = get_client_for(getattr(req, "provider", "") or "", getattr(req, "model", "") or "")
        reply_text = get_next_reply(
            client,
            messages,
            language=req.language,
            mode=getattr(req, "mode", None),
            review_record=(data.get("review_record") or None),
        )
        resp = ChatResponse(reply=reply_text)
        return jsonify(resp.model_dump())
    except Exception as e:
        print(f"[error] /chat: {type(e).__name__}: {e}")
        return jsonify({"error": str(e)}), 500


@app.post("/summarize")
def summarize():
    data = request.get_json(force=True)
    req = SummarizeRequest(**data)
    messages = [m.model_dump() for m in req.messages]
    client = get_client_for(getattr(req, "provider", "") or "", getattr(req, "model", "") or "")
    structured = extract_structured(client, messages)
    clinician_summary = build_clinician_summary(structured)
    # New: LLM-generated free-text doctor summary from full conversation
    lang = (data.get("language") or "en")
    doctor_text_summary = generate_doctor_summary(client, messages, language=lang)
    # Generate a session id and persist everything into a single master CSV row
    try:
        session_id = structured.id or uuid.uuid4().hex
        # Set id in structured response if missing
        if not structured.id:
            structured.id = session_id
        # Prepare one-row payload with JSON blobs embedded
        import json as _json
        row = {
            "id": session_id,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "conversation_json": _json.dumps(messages, ensure_ascii=False),
            "structured_json": _json.dumps(structured.model_dump(), ensure_ascii=False),
            "clinician_summary": clinician_summary or "",
        }
        # Determine destination path (env override allowed)
        csv_path = os.getenv(
            "OURDX_RESPONSES_CSV",
            os.path.abspath(os.path.join(os.path.dirname(__file__), "../data/raw/ourdx_responses.csv")),
        )
        append_row_to_csv(csv_path, row)
    except Exception as e:
        # Non-fatal: still return API response even if CSV write fails
        print(f"[warn] Failed to append survey row to CSV: {e}")
    resp = SummarizeResponse(structured=structured, clinician_summary=clinician_summary)
    out = resp.model_dump()
    # Add convenience fields without changing Pydantic schema (non-breaking)
    try:
        out["summary"] = structured.model_dump()
    except Exception:
        out["summary"] = {}
    out["text"] = doctor_text_summary or clinician_summary or ""
    return jsonify(out)

@app.post("/export")
def export_zip():
    data = request.get_json(force=True) or {}
    include_summary = bool(data.get("include_summary"))
    include_transcript = bool(data.get("include_transcript"))
    profile = data.get("profile") or {}
    patient_name = (profile.get("patient_name") or "").strip()
    patient_dob = (profile.get("patient_dob") or "").strip()
    base = "_".join([p for p in [patient_name, patient_dob] if p]) or "export"
    ts = datetime.now(timezone.utc).isoformat().replace(":", "-").replace(".", "-")

    mem = io.BytesIO()
    with zipfile.ZipFile(mem, mode="w", compression=zipfile.ZIP_DEFLATED) as zf:
        if include_summary:
            summary_text = (data.get("summary_text") or "").strip()
            zf.writestr(f"summary_{base}_{ts}.txt".lower().replace(" ", "_"), summary_text)
        if include_transcript:
            transcript = data.get("transcript") or {}
            try:
                txt = _json.dumps(transcript, ensure_ascii=False, indent=2)
            except Exception:
                txt = "{}"
            zf.writestr(f"transcript_{base}_{ts}.json".lower().replace(" ", "_"), txt)
    mem.seek(0)
    filename = f"export_{base}_{ts}.zip".lower().replace(" ", "_")
    return send_file(
        mem,
        mimetype="application/zip",
        as_attachment=True,
        download_name=filename,
    )

def build_clinician_summary(_s) -> str:
    # Backward compatibility: function is now imported from utils.summary
    # This local definition will be shadowed by the import above.
    from app.utils.summary import build_clinician_summary as _impl
    return _impl(_s)


# ---------- Transcript storage (server-backed) ----------
def _normalize_name(s: str) -> str:
    return (s or "").strip().lower()


def _profile_key(name: str, dob: str) -> str:
    return f"{_normalize_name(name)}|{(dob or '').strip()}"


def _slugify(s: str) -> str:
    out = []
    for ch in s:
        if ch.isalnum() or ch in ("-", "_", "|"):
            out.append(ch)
        else:
            out.append("_")
    return "".join(out).strip("_") or "unknown"


def _app_data_dir() -> str:
    data_dir = os.getenv("DATA_DIR", "")
    if data_dir:
        return os.path.abspath(data_dir)
    return os.path.abspath(os.path.join(os.path.dirname(__file__), "data"))


def _patients_index_path() -> str:
    return os.path.join(_app_data_dir(), "patient_index.json")


def _read_patients_index() -> dict:
    idx = read_json(_patients_index_path(), default={})
    return idx or {}


def _write_patients_index(idx: dict) -> None:
    ensure_parent_dir(_patients_index_path())
    write_json(_patients_index_path(), idx or {})


def _get_or_create_patient_id(name: str, dob: str) -> str:
    key = _profile_key(name, dob)
    idx = _read_patients_index()
    entry = idx.get(key)
    if entry and isinstance(entry, dict) and entry.get("id"):
        return entry["id"]
    # Create new id and (optionally) migrate from legacy slug folder if it exists
    new_id = uuid.uuid4().hex
    transcripts_root = os.path.join(_app_data_dir(), "transcripts")
    legacy_dir = os.path.join(transcripts_root, _slugify(key))
    new_dir = os.path.join(transcripts_root, new_id)
    try:
        if os.path.isdir(legacy_dir) and not os.path.isdir(new_dir):
            ensure_parent_dir(os.path.join(new_dir, "_placeholder"))
            shutil.move(legacy_dir, new_dir)
    except Exception as e:
        print(f"[warn] Failed migrating legacy transcripts folder: {e}")
    idx[key] = {
        "id": new_id,
        "patient_name": name or "",
        "patient_dob": dob or "",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    _write_patients_index(idx)
    return new_id


def _transcripts_dir_for(name: str, dob: str) -> str:
    username = session.get("username")
    base = os.path.join(_app_data_dir(), "transcripts")
    if username:
        return os.path.join(base, username)
    folder_id = _get_or_create_patient_id(name, dob)
    return os.path.join(base, folder_id)


@app.post("/transcripts/save")
def transcripts_save():
    data = request.get_json(force=True) or {}
    patient_name = data.get("patient_name") or ""
    patient_dob = data.get("patient_dob") or ""
    conversation_id = data.get("conversation_id") or uuid.uuid4().hex
    messages = data.get("messages") or []
    now = datetime.now(timezone.utc).isoformat()
    dir_path = _transcripts_dir_for(patient_name, patient_dob)
    ensure_parent_dir(os.path.join(dir_path, "_placeholder"))
    file_path = os.path.join(dir_path, f"{conversation_id}.json")
    existing = read_json(file_path, {}) or {}
    created_at = existing.get("created_at") or now
    doc = {
        "id": conversation_id,
        "patient_name": patient_name,
        "patient_dob": patient_dob,
        "created_at": created_at,
        "updated_at": now,
        "messages": messages,
    }
    write_json(file_path, doc)
    return jsonify({"id": conversation_id, "updated_at": now})


@app.get("/transcripts/list")
def transcripts_list():
    patient_name = request.args.get("patient_name", default="", type=str)
    patient_dob = request.args.get("patient_dob", default="", type=str)
    dir_path = _transcripts_dir_for(patient_name, patient_dob)
    files = list_files(dir_path, ".json") or []
    items = []
    for fp in files:
        j = read_json(fp, {}) or {}
        cid = j.get("id") or os.path.splitext(os.path.basename(fp))[0]
        items.append({
            "id": cid,
            "created_at": j.get("created_at"),
            "updated_at": j.get("updated_at"),
            "num_messages": len(j.get("messages") or []),
        })
    items.sort(key=lambda x: x.get("updated_at") or "", reverse=True)
    return jsonify({"items": items})


@app.get("/transcripts/get")
def transcripts_get():
    patient_name = request.args.get("patient_name", default="", type=str)
    patient_dob = request.args.get("patient_dob", default="", type=str)
    conversation_id = request.args.get("id", default="", type=str)
    if not conversation_id:
        return jsonify({"error": "id required"}), 400
    dir_path = _transcripts_dir_for(patient_name, patient_dob)
    file_path = os.path.join(dir_path, f"{conversation_id}.json")
    doc = read_json(file_path, None)
    if not doc:
        return jsonify({"error": "not found"}), 404
    return jsonify(doc)


if __name__ == "__main__":
    app.run(debug=True)

