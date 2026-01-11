# app/services/chat_flow.py
from typing import List, Dict, Optional
import re
from ..llm_client import ChatClient
from app.prompts import SURVEY_CONDUCTOR_PROMPT, FEW_SHOT_EXAMPLES


def get_next_reply(
    llama: ChatClient, messages: List[Dict[str, str]], language: Optional[str] = None
) -> str:
    system_context_parts: List[str] = [m.get("content", "") for m in messages if m.get("role") == "system"]

    survey_system = SURVEY_CONDUCTOR_PROMPT
    if language:
        survey_system = survey_system + f"\n\nLanguage: {language}"
    # Add few-shot examples to guide behavior and markers/question types
    survey_system = survey_system + "\n\n" + FEW_SHOT_EXAMPLES

    # Add hard constraints to discourage repetition and restating sections
    constraints: List[str] = [
        "Do NOT repeat questions that were already asked; if answered, move to the next topic.",
        "Ask ONE short question at a time.",
        "No medical advice or coaching.",
    ]
    if system_context_parts:
        constraints.extend(
            [
                "Demographics and context were already collected by the application.",
                "Do NOT ask about demographics, education, literacy, interpreter, language, or who this is about.",
                "Start at Section 1 and proceed in order.",
            ]
        )
    # Summarize recent assistant prompts (first sentence) to avoid repeats
    prior_assistant_lines: List[str] = []
    for m in messages:
        if m.get("role") != "assistant":
            continue
        text = (m.get("content") or "").strip()
        if not text:
            continue
        first = re.split(r"[\n\.!?]", text, maxsplit=1)[0].strip()
        if first:
            prior_assistant_lines.append(first)
    if prior_assistant_lines:
        constraints.append("Previously asked (do not repeat): " + "; ".join(prior_assistant_lines[-6:]))
    hard_constraints = "HARD CONSTRAINTS:\n- " + "\n- ".join(constraints)

    # Combine survey prompt, examples, and constraints into a single system message
    combined_system_content = f"{survey_system}\n\n{hard_constraints}"
    model_messages: List[Dict[str, str]] = [{"role": "system", "content": combined_system_content}]
    model_messages.extend([m for m in messages if m.get("role") != "system"])

    reply = llama.generate(model_messages, max_tokens=180, temperature=0.2)

    # Post-process: keep content concise, preserve lists/newlines, and KEEP hidden markers.
    def _clean(text: str) -> str:
        raw = text or ""
        lines = [ln.strip() for ln in raw.splitlines() if ln.strip()]
        # Don't remove any filler or transition lines now; keep all lines
        # Just collect all non-empty lines
        keep: List[str] = lines.copy()

        # Check for lists (bullets or numbered)
        has_list = any(re.match(r"^\s*(?:[-•]|\d+[)\.\-])\s+", ln) for ln in keep)
        if has_list:
            question = next((ln for ln in keep if not re.match(r"^\s*(?:[-•]|\d+[)\.\-])\s+", ln)), "")
            items: List[str] = [ln for ln in keep if re.match(r"^\s*(?:[-•]|\d+[)\.\-])\s+", ln)]
            items = items[:6]
            out_core = "\n".join(([question] if question else []) + items).strip()
        else:
            cleaned = " ".join(keep).strip()
            # Truncate to ~2 sentences or ~160 chars
            parts = re.split(r"(?<=[\.?\!])\s+", cleaned)
            short: List[str] = []
            total_len = 0
            for p in parts:
                if not p:
                    continue
                if total_len + len(p) > 160:
                    break
                short.append(p)
                total_len += len(p)
                if len(short) >= 2:
                    break
            out_core = " ".join(short).strip()
            # If question mark present but not at end, chop at first question
            if "?" in cleaned and not out_core.endswith("?"):
                m = re.search(r"([^?]+\?)", cleaned)
                if m:
                    out_core = m.group(1).strip()

        # Find existing section/question type markers anywhere in the text (not just EOL)
        sec_matches = re.findall(r"\[S([1-4])\]", raw, flags=re.I | re.M)
        sec_tag = f"[S{sec_matches[-1]}]" if sec_matches else None
        qtype_matches = re.findall(r"\[(binary|mc|free)\]", raw, flags=re.I | re.M)
        qtype_tag = f"[{qtype_matches[-1].lower()}]" if qtype_matches else None
        inferred_qtype = None
        if not qtype_tag:
            if has_list:
                inferred_qtype = "[mc]"
            elif re.search(r"\(\s*yes\s*\/\s*no\s*\)", raw, re.I) or re.search(r"\bYes\/No\b", raw, re.I):
                inferred_qtype = "[binary]"

        out = out_core
        # Append markers on their own lines if not already present anywhere
        if sec_tag and not re.search(r"\[S[1-4]\]", out, flags=re.I):
            out = f"{out}\n{sec_tag}".strip()
        if qtype_tag and not re.search(r"\[(binary|mc|free)\]", out, flags=re.I):
            out = f"{out}\n{qtype_tag}".strip()
        if inferred_qtype and not re.search(r"\[(binary|mc|free)\]", out, flags=re.I):
            out = f"{out}\n{inferred_qtype}".strip()

        # Fallback for empty body
        if not re.search(r"\S", re.sub(r"\[(?:S[1-4]|binary|mc|free)\]", "", out)):
            out = "What are the most important things you want to talk about at your visit?\n[S1]\n[free]"
        return out or raw

    return _clean(reply)
