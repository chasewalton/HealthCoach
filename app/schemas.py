# app/schemas.py
from typing import List, Optional
import re
from pydantic import BaseModel, Field, field_validator


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    language: Optional[str] = None
    provider: Optional[str] = None  # "ollama" | "openai"
    model: Optional[str] = None     # e.g., "llama3:instruct" or "gpt-5.2"


class ChatResponse(BaseModel):
    reply: str


class SurveyStructured(BaseModel):
    id: Optional[str] = None
    priorities_for_visit: List[str] = Field(default_factory=list)
    dont_leave_without: Optional[str] = None
    next_appointment: Optional[str] = None
    prescription: Optional[str] = None
    med_release_form: Optional[str] = None
    other_visit_items: Optional[str] = None

    recent_medical_history_flags_new_worsening: bool = False
    recent_medical_history_flags_chronic_condition: bool = False
    recent_medical_history_flags_tests: bool = False
    recent_medical_history_flags_urgent_care: bool = False
    recent_medical_history_flags_med_changes: bool = False
    recent_medical_history_flags_other: bool = False
    recent_medical_history_flags_none: bool = False

    recent_medical_history_free_text: Optional[str] = None

    concerns_heard: Optional[str] = None
    problems_tests: Optional[bool] = None
    problems_other: Optional[bool] = None
    most_important_problems_delays: Optional[str] = None
    going_well: Optional[str] = None

    sex: Optional[str] = None
    race: Optional[str] = None
    hispanic_or_latino: Optional[bool] = None
    primary_language: Optional[str] = None
    interpreter_needed: Optional[bool] = None
    total_prdb: Optional[float] = None

    @field_validator("priorities_for_visit", mode="before")
    @classmethod
    def _coerce_priorities(cls, value):
        # Accept list, single string, comma/newline-delimited string, or None
        if value is None:
            return []
        if isinstance(value, list):
            return [str(item).strip() for item in value if str(item).strip()]
        if isinstance(value, str):
            parts = [p.strip() for p in re.split(r"[,\n]+", value) if p.strip()]
            return parts
        # Fallback: best-effort stringify
        return [str(value)]

    @field_validator(
        "recent_medical_history_flags_new_worsening",
        "recent_medical_history_flags_chronic_condition",
        "recent_medical_history_flags_tests",
        "recent_medical_history_flags_urgent_care",
        "recent_medical_history_flags_med_changes",
        "recent_medical_history_flags_other",
        "recent_medical_history_flags_none",
        "problems_tests",
        "problems_other",
        "hispanic_or_latino",
        "interpreter_needed",
        mode="before",
    )
    @classmethod
    def _coerce_bool(cls, value):
        # Normalize common truthy/falsey representations
        if value is None or isinstance(value, bool):
            return value
        if isinstance(value, (int, float)):
            return bool(int(value))
        if isinstance(value, str):
            s = value.strip().lower()
            if s in {"true", "t", "yes", "y", "1"}:
                return True
            if s in {"false", "f", "no", "n", "0"}:
                return False
        # Leave as-is; validation may still succeed if already correct type
        return value


class SummarizeRequest(BaseModel):
    messages: List[ChatMessage]
    provider: Optional[str] = None
    model: Optional[str] = None


class SummarizeResponse(BaseModel):
    structured: SurveyStructured
    clinician_summary: str
