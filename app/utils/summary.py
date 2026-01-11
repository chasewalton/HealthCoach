def build_clinician_summary(s) -> str:
    parts = []
    try:
        if getattr(s, "priorities_for_visit", None):
            parts.append("Top concerns: " + "; ".join(s.priorities_for_visit))
        if getattr(s, "recent_medical_history_free_text", None):
            parts.append("Recent history: " + s.recent_medical_history_free_text)
        if getattr(s, "most_important_problems_delays", None):
            parts.append("Problems/delays: " + s.most_important_problems_delays)
        if getattr(s, "going_well", None):
            parts.append("Going well: " + s.going_well)
    except Exception:
        pass
    return "\n".join(parts)
