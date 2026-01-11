import os
import csv
from typing import Dict, Any, Iterable
import json


def ensure_parent_dir(path: str) -> None:
    parent = os.path.dirname(os.path.abspath(path))
    os.makedirs(parent, exist_ok=True)


def append_row_to_csv(path: str, row: Dict[str, Any]) -> None:
    ensure_parent_dir(path)
    file_exists = os.path.exists(path) and os.path.getsize(path) > 0
    # Determine header order: stable ordering of keys
    fieldnames: Iterable[str] = list(row.keys())
    with open(path, mode="a", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        if not file_exists:
            writer.writeheader()
        writer.writerow(row)


def write_json(path: str, data: Any) -> None:
    """Write data as pretty JSON (UTF-8)."""
    ensure_parent_dir(path)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def write_text(path: str, text: str) -> None:
    """Write plain text (UTF-8)."""
    ensure_parent_dir(path)
    with open(path, "w", encoding="utf-8") as f:
        f.write(text if text is not None else "")
