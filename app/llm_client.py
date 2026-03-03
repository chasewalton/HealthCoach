# app/llm_client.py
import os
from typing import List, Dict, Any, Optional, Protocol
import requests


class ChatClient(Protocol):
    def generate(
        self,
        messages: List[Dict[str, str]],
        max_tokens: int = 180,
        *,
        temperature: float = 1.0,
        format_json: bool = False,
        extra_options: Optional[Dict[str, Any]] = None,
    ) -> str: ...


class LlamaClient:
    def __init__(self) -> None:
        self.base_url = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
        self.model = os.getenv("OLLAMA_MODEL", "llama3:instruct")
        # If true, send system instructions via top-level `system` field (Ollama supports this),
        # removing system-role messages from the chat history to avoid duplication.
        self.use_system_field = str(os.getenv("OLLAMA_USE_SYSTEM_FIELD", "0")).lower() in {
            "1",
            "true",
            "yes",
            "on",
        }

    def generate(
        self,
        messages: List[Dict[str, str]],
        max_tokens: int = 180,
        *,
        temperature: float = 1.0,
        format_json: bool = False,
        extra_options: Optional[Dict[str, Any]] = None,
    ) -> str:
        options: Dict[str, Any] = {"num_predict": max_tokens, "temperature": temperature}
        if extra_options:
            options.update(extra_options)
        # Optionally move system-role messages into top-level `system`
        system_parts = [m.get("content", "") for m in messages if m.get("role") == "system"]
        non_system_messages = [m for m in messages if m.get("role") != "system"]

        payload: Dict[str, Any] = {
            "model": self.model,
            "messages": non_system_messages if (self.use_system_field and system_parts) else messages,
            "stream": False,
            "options": options,
        }
        if self.use_system_field and system_parts:
            payload["system"] = "\n\n".join([s for s in system_parts if s])
        if format_json:
            # Ollama supports `"format": "json"` to return well-formed JSON
            payload["format"] = "json"
        resp = requests.post(f"{self.base_url}/api/chat", json=payload, timeout=120)
        resp.raise_for_status()
        data = resp.json()
        return data["message"]["content"]


class OpenAIClient:
    def __init__(self) -> None:
        # Default to a cost-effective model; override with OPENAI_MODEL
        self.model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
        # Defer import so environments without openai still work for Ollama users
        try:
            from openai import OpenAI  # type: ignore
        except Exception as e:  # pragma: no cover
            raise RuntimeError(
                "openai package is required for OpenAIClient. Install with `pip install openai`."
            ) from e
        # Let SDK pick up OPENAI_API_KEY from env; support OpenRouter via OPENAI_BASE_URL
        self._OpenAI = OpenAI
        base_url = os.getenv("OPENAI_BASE_URL", "").strip() or None
        self._client = OpenAI(base_url=base_url) if base_url else OpenAI()

    def generate(
        self,
        messages: List[Dict[str, str]],
        max_tokens: int = 180,
        *,
        temperature: float = 1.0,
        format_json: bool = False,
        extra_options: Optional[Dict[str, Any]] = None,
    ) -> str:
        # Build kwargs compatible with Chat Completions
        kwargs: Dict[str, Any] = {
            "model": self.model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        if format_json:
            kwargs["response_format"] = {"type": "json_object"}
        if extra_options:
            kwargs.update(extra_options)
        # Use chat.completions for broad compatibility
        result = self._client.chat.completions.create(**kwargs)
        return (result.choices[0].message.content or "").strip()


def create_client() -> ChatClient:
    """
    Factory to create a chat client based on env:
    - LLM_PROVIDER=openai -> OpenAIClient
    - otherwise -> LlamaClient (Ollama)
    """
    provider = (os.getenv("LLM_PROVIDER") or "").strip().lower()
    if provider == "openai":
        return OpenAIClient()
    if os.getenv("OPENAI_API_KEY"):
        return OpenAIClient()
    return LlamaClient()
