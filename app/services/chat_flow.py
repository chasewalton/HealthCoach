# app/services/chat_flow.py
from typing import List, Dict, Optional
import re
from ..llm_client import ChatClient
from app.prompts import SURVEY_CONDUCTOR_PROMPT, REVIEW_SOAP_PROMPT, REVIEW_FAKE_LAST_RECORD

# Tokens per mode — generous enough for a question + markers + brief context
MAX_TOKENS_OURDX = 350
MAX_TOKENS_REVIEW = 500


def get_next_reply(
    llama: ChatClient,
    messages: List[Dict[str, str]],
    language: Optional[str] = None,
    mode: Optional[str] = None,
    review_record: Optional[str] = None,
) -> str:
    system_context_parts: List[str] = [m.get("content", "") for m in messages if m.get("role") == "system"]

    use_mode = (mode or "ourdx").strip().lower()

    if use_mode == "review":
        record_text = (review_record or "").strip() or REVIEW_FAKE_LAST_RECORD
        system_prompt = "\n\n".join([
            REVIEW_SOAP_PROMPT,
            f"Language: {language}" if language else "",
            "Last visit record:\n" + record_text,
        ]).strip()
    else:
        survey_system = SURVEY_CONDUCTOR_PROMPT
        if language:
            survey_system += f"\n\nRespond in: {language}"
        system_prompt = survey_system

    # Build hard constraints
    if use_mode == "review":
        constraints: List[str] = [
            "Ask at most ONE question per message.",
            "Do NOT repeat questions already answered.",
            "Always end your message with the current [SOAP:section] marker on its own line.",
            "No medical advice or treatment recommendations.",
        ]
    else:
        constraints = [
            "Ask exactly ONE question per message — never bundle questions.",
            "Always append the section marker ([S1]–[S4]) on its own line after your question.",
            "Do NOT repeat a question that has already been answered.",
            "No medical advice or coaching.",
        ]

    if system_context_parts:
        constraints.append("Patient demographics and context are already collected — do NOT ask about name, age, language, education, or who this is about.")
        if use_mode != "review":
            constraints.append("Begin directly with Section 1.")

    # Inject recent assistant turns so the model knows what was already asked
    prior_questions: List[str] = []
    for m in messages:
        if m.get("role") != "assistant":
            continue
        text = (m.get("content") or "").strip()
        if not text:
            continue
        # First sentence is the question
        first = re.split(r"(?<=[.?!])\s+", text, maxsplit=1)[0].strip()
        if first:
            prior_questions.append(first)
    if prior_questions:
        recent = prior_questions[-8:]
        constraints.append("Already asked (do NOT repeat): " + " | ".join(recent))

    hard_constraints = "HARD CONSTRAINTS:\n" + "\n".join(f"- {c}" for c in constraints)

    combined_system = f"{system_prompt}\n\n{hard_constraints}"
    model_messages: List[Dict[str, str]] = [{"role": "system", "content": combined_system}]
    model_messages.extend([m for m in messages if m.get("role") != "system"])

    max_tokens = MAX_TOKENS_REVIEW if use_mode == "review" else MAX_TOKENS_OURDX
    reply = llama.generate(model_messages, max_tokens=max_tokens, temperature=0.2)

    return _clean(reply, use_mode)


def _clean(text: str, use_mode: str) -> str:
    raw = text or ""

    # --- Extract hidden markers before processing ---
    sec_tag = None
    soap_tag = None

    if use_mode != "review":
        sec_matches = re.findall(r"\[S([1-4])\]", raw, flags=re.I | re.M)
        sec_tag = f"[S{sec_matches[-1]}]" if sec_matches else None
    else:
        soap_matches = re.findall(r"\[SOAP:(subjective|objective|assessment|plan)\]", raw, flags=re.I | re.M)
        soap_tag = f"[SOAP:{soap_matches[-1].lower()}]" if soap_matches else None

    # Strip all markers from visible text for clean processing (including legacy [binary]/[mc]/[free] if model sends them)
    marker_pattern = r"\[(?:S[1-4]|binary|mc|free|SOAP:(?:subjective|objective|assessment|plan))\]"
    stripped = re.sub(marker_pattern, "", raw, flags=re.I).strip()

    # Split into lines, drop blank lines
    lines = [ln.strip() for ln in stripped.splitlines() if ln.strip()]

    # Detect bullet/numbered lists
    list_re = re.compile(r"^\s*(?:[-•]|\d+[)\.\-])\s+")
    has_list = any(list_re.match(ln) for ln in lines)

    if has_list:
        # Keep the question line and up to 6 list items
        question_lines = [ln for ln in lines if not list_re.match(ln)]
        item_lines = [ln for ln in lines if list_re.match(ln)][:6]
        out_core = "\n".join((question_lines[:1] if question_lines else []) + item_lines).strip()
    else:
        # Rejoin, then take up to 3 sentences or 320 characters
        full = " ".join(lines).strip()
        sentences = re.split(r"(?<=[.?!])\s+", full)
        short: List[str] = []
        total = 0
        for s in sentences:
            if not s:
                continue
            if total + len(s) > 320 and short:
                break
            short.append(s)
            total += len(s)
            if len(short) >= 3:
                break
        out_core = " ".join(short).strip()

        # If we trimmed a question mark off, recover first complete question
        if "?" in full and not out_core.endswith("?"):
            m = re.search(r"([^?]+\?)", full)
            if m:
                out_core = m.group(1).strip()

    # --- Re-attach markers ---
    out = out_core
    if use_mode != "review":
        if sec_tag and not re.search(r"\[S[1-4]\]", out, flags=re.I):
            out = f"{out}\n{sec_tag}"
    else:
        if soap_tag and not re.search(r"\[SOAP:", out, flags=re.I):
            out = f"{out}\n{soap_tag}"
        # Default to subjective if model forgot the marker
        if not re.search(r"\[SOAP:", out, flags=re.I):
            out = f"{out}\n[SOAP:subjective]"

    # Fallback if the body came back empty
    body_only = re.sub(marker_pattern, "", out, flags=re.I).strip()
    if not body_only:
        if use_mode == "review":
            out = "Has anything changed since your last visit on 2026-01-05?\n[SOAP:subjective]"
        else:
            out = "What are the most important things you want to talk about at your visit?\n[S1]"

    return out.strip()
