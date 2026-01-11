# app/services/extract_structured.py
from typing import List, Dict
from app.llm_client import ChatClient
from app.schemas import SurveyStructured

import json
import re
from pydantic import ValidationError

EXTRACTION_SYSTEM_PROMPT = """
You are a careful data extraction assistant. Given a patient/parent–clinician style chat transcript,
produce a single JSON object that conforms to the OurDX survey schema below. Be concise and faithful
to the source; DO NOT invent facts. If a field is not supported by the transcript, set it to null
for strings/numbers or false for booleans. Output JSON ONLY (no code fences, no commentary).

Schema (keys and types):
- id: string | null
- priorities_for_visit: string[]                (up to 3 short items; derive from main concerns)
- dont_leave_without: string | null
- next_appointment: string | null
- prescription: string | null
- med_release_form: string | null
- other_visit_items: string | null

- recent_medical_history_flags_new_worsening: boolean
- recent_medical_history_flags_chronic_condition: boolean
- recent_medical_history_flags_tests: boolean
- recent_medical_history_flags_urgent_care: boolean
- recent_medical_history_flags_med_changes: boolean
- recent_medical_history_flags_other: boolean
- recent_medical_history_flags_none: boolean

- recent_medical_history_free_text: string | null

- concerns_heard: string | null                 (map to: "Completely" | "Somewhat" | "Not at all" | "Not discussed yet" when possible; otherwise free text)
- problems_tests: boolean | null                (Yes/No → true/false)
- problems_other: boolean | null                (Yes/No → true/false)
- most_important_problems_delays: string | null
- going_well: string | null

- sex: string | null
- race: string | null
- hispanic_or_latino: boolean | null
- primary_language: string | null
- interpreter_needed: boolean | null
- total_prdb: number | null                     (use a number if explicitly given; otherwise null)

Normalization rules:
- For booleans, map common variants to true/false: yes/y/true/1 → true; no/n/false/0 → false.
- If multiple concerns are listed together, split into separate short strings (max ~10 words each).
- Prefer quoting user wording concisely; avoid adding medical advice or interpretations.
- If timeframe is ambiguous, include exact phrases in free-text fields; do not infer.
"""

def extract_json_string(text: str) -> str:
    # Prefer fenced code block
    m = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", text)
    if m:
        return m.group(1).strip()
    # Fallback: take substring from first '{' to the matching closing '}' (best-effort)
    start = text.find('{')
    if start == -1:
        raise ValueError("No JSON object found in model output.")
    # Simple brace counter to find end
    depth = 0
    for i, ch in enumerate(text[start:], start=start):
        if ch == '{':
            depth += 1
        elif ch == '}':
            depth -= 1
            if depth == 0:
                return text[start:i+1].strip()
    raise ValueError("Unbalanced JSON braces in model output.")

def parse_survey_structured(raw: str) -> "SurveyStructured":
    json_str = extract_json_string(raw)
    # Option A: validate parsed python dict
    data = json.loads(json_str)
    return SurveyStructured.model_validate(data)
    # Option B: if you prefer string input:
    # return SurveyStructured.model_validate_json(json_str)


def extract_structured(llama: ChatClient, messages: List[Dict[str, str]]) -> SurveyStructured:
    """
    Calls the LLM with the extraction system prompt and the given conversation,
    then parses the model output into a SurveyStructured object.
    """
    # Merge any system context (e.g., demographics) into the extraction prompt
    extra_ctx_parts = [m.get("content", "") for m in messages if m.get("role") == "system"]
    system_prompt = EXTRACTION_SYSTEM_PROMPT
    if extra_ctx_parts:
        system_prompt = (
            system_prompt
            + "\n\nAdditional context from application (demographics/education/health literacy):\n"
            + "\n".join(extra_ctx_parts)
        )

    model_messages: List[Dict[str, str]] = [{"role": "system", "content": system_prompt}]
    model_messages.extend([m for m in messages if m.get("role") != "system"])

    # Ask for JSON-only, low temperature for determinism
    raw = llama.generate(model_messages, max_tokens=900, temperature=0.1, format_json=True)
    try:
        return parse_survey_structured(raw)
    except (ValidationError, ValueError) as e:
        # Add a brief recovery attempt by nudging the model to output JSON only
        followup_messages = model_messages + [
            {
                "role": "user",
                "content": "Return only a valid JSON object with all required keys per the schema. Unknowns must be null or false.",
            }
        ]
        second_raw = llama.generate(followup_messages, max_tokens=900, temperature=0.1, format_json=True)
        return parse_survey_structured(second_raw)