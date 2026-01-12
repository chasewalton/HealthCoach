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


def read_json(path: str, default: Any = None) -> Any:
    """Read JSON file, returning default if missing or invalid."""
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return default


def list_files(dir_path: str, suffix: str = "") -> Iterable[str]:
    """Yield absolute paths of files in dir_path (non-recursive), optionally filtered by suffix."""
    if not os.path.isdir(dir_path):
        return []
    files = []
    for name in os.listdir(dir_path):
        full = os.path.join(dir_path, name)
        if os.path.isfile(full) and (not suffix or name.endswith(suffix)):
            files.append(full)
    return sorted(files)
