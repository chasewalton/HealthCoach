# app/services/chat_flow.py
"""Combines prompts with runtime context, calls LLM. Returns model response as-is."""
from typing import List, Dict, Optional
from ..llm_client import ChatClient
from app.prompts import (
    SYSTEM_PROMPT_EN,
    SURVEY_CONDUCTOR_PROMPT,
    REVIEW_SOAP_PROMPT,
    REVIEW_FAKE_LAST_RECORD,
    CONTEXT_PATIENT_LABEL,
)

MAX_TOKENS_OURDX = 250
MAX_TOKENS_REVIEW = 250
MAX_CONTEXT_MESSAGES = 12

def get_next_reply(
    client: ChatClient,
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
        #system_prompt = "\n\n".join([part for part in base_instructions if part]).strip()
    else:
        base_instructions = [
            SYSTEM_PROMPT_EN.strip(),
            SURVEY_CONDUCTOR_PROMPT.strip(),
        ]
        #system_prompt = "\n\n".join([part for part in survey_system if part]).strip()

    # Compose system content without prior questions logic
    system_content = "\n\n".join([part for part in base_instructions if part]).strip()
    if system_context_parts:
        patient_text = "\n".join(s.strip() for s in system_context_parts if s.strip())
        system_content = f"{system_content}\n\n{CONTEXT_PATIENT_LABEL}\n{patient_text}"

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
    reply = client.generate(model_messages, max_tokens=max_tokens, temperature=0.0)
    return (reply or "").strip()