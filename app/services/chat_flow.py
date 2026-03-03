# Start of Selection
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

# Tokens per mode — generous enough for a question + markers + brief context
MAX_TOKENS_OURDX = 350
MAX_TOKENS_REVIEW = 350

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
    # When conversation is empty, inject a starter so model initiates first
    if not any(m.get("role") == "user" for m in conv_messages):
        starter = "Hi" if use_mode != "review" else "I'd like to review my last visit."
        conv_messages = [{"role": "user", "content": starter}]
    model_messages.extend(conv_messages)

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

    return out.strip()
# End of Selectio