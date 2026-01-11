# app/main_flask.py
from flask import Flask, request, jsonify
import os
from app.llm_client import LlamaClient, OpenAIClient
from app.schemas import ChatRequest, ChatResponse, SummarizeRequest, SummarizeResponse
from app.services.chat_flow import get_next_reply
from app.services.extract_structured import extract_structured
from app.utils.summary import build_clinician_summary
from app.utils.storage import append_row_to_csv
from datetime import datetime, timezone
import uuid

# Serve static files from ../frontend at URL prefix /frontend
app = Flask(
    __name__,
    static_folder="../frontend",
    static_url_path="/frontend",
)

default_client = LlamaClient()

def get_client_for(provider: str = "", model: str = ""):
    prov = (provider or "").strip().lower()
    mdl = (model or "").strip()
    if prov == "openai":
        client = OpenAIClient()
        if mdl:
            client.model = mdl
        return client
    # default: ollama
    client = LlamaClient()
    if mdl:
        client.model = mdl
    return client


@app.get("/")
def root():
    return {
        "message": "OurDX chatbot API (Flask) is running. "
                   "Go to /ui for the chat interface, or use POST /chat and /summarize."
    }


# Simple route to return the main HTML file
@app.get("/ui")
def ui():
    # This serves frontend/index.html
    return app.send_static_file("index.html")


@app.post("/chat")
def chat():
    data = request.get_json(force=True)
    req = ChatRequest(**data)
    messages = [m.model_dump() for m in req.messages]
    client = get_client_for(getattr(req, "provider", "") or "", getattr(req, "model", "") or "")
    reply_text = get_next_reply(client, messages, language=req.language)
    resp = ChatResponse(reply=reply_text)
    return jsonify(resp.model_dump())


@app.post("/summarize")
def summarize():
    data = request.get_json(force=True)
    req = SummarizeRequest(**data)
    messages = [m.model_dump() for m in req.messages]
    client = get_client_for(getattr(req, "provider", "") or "", getattr(req, "model", "") or "")
    structured = extract_structured(client, messages)
    clinician_summary = build_clinician_summary(structured)
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
    return jsonify(resp.model_dump())


def build_clinician_summary(_s) -> str:
    # Backward compatibility: function is now imported from utils.summary
    # This local definition will be shadowed by the import above.
    from app.utils.summary import build_clinician_summary as _impl
    return _impl(_s)


if __name__ == "__main__":
    app.run(debug=True)
