# tests/test_chat_flow.py
from app.llm_client import LlamaClient
from app.services.chat_flow import get_next_reply


def test_basic_reply():
    llama = LlamaClient()
    messages = [{"role": "user", "content": "I have headaches."}]
    reply = get_next_reply(llama, messages)
    assert isinstance(reply, str)
    assert reply


def test_emergency_detection():
    llama = LlamaClient()
    messages = [{"role": "user", "content": "I have chest pain and can't breathe."}]
    reply = get_next_reply(llama, messages)
    assert "emergency" in reply.lower()
