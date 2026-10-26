import asyncio, json
from fastapi.testclient import TestClient
import main

client = TestClient(main.app)


def test_health():
    assert client.get("/health").json()["status"] == "ok"


def test_chat_without_key_degrades_gracefully(monkeypatch):
    monkeypatch.setattr(main, "GROQ_API_KEY", "")
    r = client.post("/chat", json={"messages": [{"role": "user", "content": "hi"}]})
    assert r.status_code == 200 and "offline" in r.text


def test_chat_validation():
    assert client.post("/chat", json={"messages": []}).status_code == 422


def test_tools():
    found = []
    fare = json.loads(asyncio.run(main.run_tool("explain_fare", {"distance_km": 18, "price_per_km": 3.5}, found)))
    assert fare["fare_rupees"] == 63
    assert len(json.loads(asyncio.run(main.run_tool("safety_tips", {}, found)))["tips"]) >= 3
