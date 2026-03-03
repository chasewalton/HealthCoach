# app/services/chat_flow.py
"""Combines prompts with runtime context, calls LLM, extracts/cleans markers. All instructions live in prompts.py."""
from typing import List, Dict, Optional
import re
from ..llm_client import ChatClient
from app.prompts import (
    SYSTEM_PROMPT_EN,
    SURVEY_CONDUCTOR_PROMPT,
    REVIEW_SOAP_PROMPT,
    REVIEW_FAKE_LAST_RECORD,
    CONTEXT_PATIENT_LABEL,
    CONTEXT_ALREADY_ASKED_LABEL,
)

# Tokens per mode — enough for a question + markers; lower = faster generation
MAX_TOKENS_OURDX = 250
MAX_TOKENS_REVIEW = 250

# Max messages to send (recent context only); reduces prompt size and latency
MAX_CONTEXT_MESSAGES = 12

# Pre-compiled regexes for _clean (avoids recompile on every call)
_RE_SEC = re.compile(r"\[S([1-4])\]", re.I)
_RE_SOAP = re.compile(r"\[SOAP:(subjective|objective|assessment|plan)\]", re.I)
_RE_MARKER = re.compile(r"\[(?:S[1-4]|binary|mc|free|SOAP:(?:subjective|objective|assessment|plan))\]", re.I)

def get_next_reply(
    llama: ChatClient,
    messages: List[Dict[str, str]],
    language: Optional[str] = None,
    mode: Optional[str] = None,
    review_record: Optional[str] = None,
) -> str:
    """
    Always sends instructions to the model via a `system` message. 
    For all modes, the SYSTEM_PROMPT_EN instructions are included at the top, followed by mode-specific context and dynamic values.
    """
    system_context_parts: List[str] = [m.get("content", "") for m in messages if m.get("role") == "system"]

    use_mode = (mode or "ourdx").strip().lower()

    # SYSTEM_PROMPT_EN used as the instruction base in every mode
    if use_mode == "review":
        record_text = (review_record or "").strip() or REVIEW_FAKE_LAST_RECORD
        base_instructions = [
            SYSTEM_PROMPT_EN.strip(),
            REVIEW_SOAP_PROMPT.strip(),
            "Last visit record:\n" + record_text,
        ]
        system_prompt = "\n\n".join([part for part in base_instructions if part]).strip()
    else:
        survey_system = [
            SYSTEM_PROMPT_EN.strip(),
            SURVEY_CONDUCTOR_PROMPT.strip(),
        ]
        system_prompt = "\n\n".join([part for part in survey_system if part]).strip()

    # Compose system content without prior questions logic
    system_content = system_prompt
    if system_context_parts:
        patient_text = "\n".join(s.strip() for s in system_context_parts if s.strip())
        system_content = f"{system_prompt}\n\n{CONTEXT_PATIENT_LABEL}\n{patient_text}"

    # SYSTEM message always present at top
    model_messages: List[Dict[str, str]] = [{"role": "system", "content": system_content}]
    conv_messages = [m for m in messages if m.get("role") != "system"]
    if len(conv_messages) > MAX_CONTEXT_MESSAGES:
        conv_messages = conv_messages[-MAX_CONTEXT_MESSAGES:]
    # When conversation is empty, inject a starter so model initiates first
    if not any(m.get("role") == "user" for m in conv_messages):
        starter = "Hi" if use_mode != "review" else "I'd like to review my last visit."
        conv_messages = [{"role": "user", "content": starter}]
    model_messages.extend(conv_messages)

    max_tokens = MAX_TOKENS_REVIEW if use_mode == "review" else MAX_TOKENS_OURDX
    reply = llama.generate(model_messages, max_tokens=max_tokens, temperature=0.2)

    return _clean(reply, use_mode)


def _clean(text: str, use_mode: str) -> str:
    raw = (text or "").strip()
    if not raw:
        return "[SOAP:subjective]" if use_mode == "review" else ""

    # Extract markers (pre-compiled regex)
    sec_tag = None
    soap_tag = None
    if use_mode != "review":
        m = _RE_SEC.findall(raw)
        sec_tag = f"[S{m[-1]}]" if m else None
    else:
        m = _RE_SOAP.findall(raw)
        soap_tag = f"[SOAP:{m[-1].lower()}]" if m else None

    # Strip markers, collapse blank lines
    stripped = _RE_MARKER.sub("", raw).strip()
    lines = [ln.strip() for ln in stripped.splitlines() if ln.strip()]
    out = "\n".join(lines).strip()

    # Re-attach marker
    if use_mode != "review":
        if sec_tag and "[S" not in out.upper():
            out = f"{out}\n{sec_tag}"
    else:
        if soap_tag and "[SOAP:" not in out.upper():
            out = f"{out}\n{soap_tag}"
        elif "[SOAP:" not in out.upper():
            out = f"{out}\n[SOAP:subjective]"

    return out.strip()