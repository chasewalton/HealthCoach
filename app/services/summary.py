# app/services/summary.py
from typing import List, Dict
from app.llm_client import ChatClient


def _render_transcript(messages: List[Dict[str, str]]) -> str:
    parts = []
    for m in messages:
        role = (m.get("role") or "").strip().lower()
        if role == "system":
            # Skip prior system messages to avoid over-instruction
            continue
        label = "Patient" if role == "user" else "Assistant"
        parts.append(f"{label}: {m.get('content', '').strip()}")
    return "\n".join(parts).strip()


def generate_doctor_summary(
    client: ChatClient,
    messages: List[Dict[str, str]],
    *,
    language: str = "en",
    max_tokens: int = 420,
) -> str:
    """
    Ask the LLM for a concise, clinician-oriented summary of the conversation.
    Returns a plain text summary suitable for inclusion in the chart note.
    """
    transcript = _render_transcript(messages)
    system = (
        "You are a clinical assistant. Write concise, clinically useful summaries for physicians.\n"
        "Prioritize clarity, factual accuracy, and medically relevant details."
    )
    user = (
        f"Summarize the following patient–assistant conversation in {language}. "
        "Target audience: the patient's clinician.\n\n"
        "Requirements:\n"
        "- Start with 1–2 sentences of overall context.\n"
        "- Then include bullet points covering:\n"
        "  • Top concerns and goals (patient's priorities)\n"
        "  • Pertinent history and recent changes (with timing)\n"
        "  • Key symptoms and pertinent negatives (concise)\n"
        "  • Medications/changes if mentioned\n"
        "  • Suggested plan or next steps if discussed\n"
        "- Keep neutral, non-judgmental tone. Avoid speculation. No PHI beyond what is provided.\n"
        "- Length: about 120–200 words.\n\n"
        "Conversation:\n"
        f"---\n{transcript}\n---"
    )
    try:
        return client.generate(
            messages=[{"role": "system", "content": system}, {"role": "user", "content": user}],
            max_tokens=max_tokens,
            temperature=0.6,
        ).strip()
    except Exception:
        return ""

