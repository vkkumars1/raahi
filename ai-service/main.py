from __future__ import annotations
"""
Raahi AI service (FastAPI).
Streams a commuting assistant ("Raahi Sathi") backed by Groq's free Llama API, with tool calling:
  - search_rides: geocodes pickup/drop (Nominatim) and calls the Express API's /rides/search
  - explain_fare: shows how a guest's fare is computed
  - safety_tips: static safety checklist
The response is plain text streamed token by token. When rides were found, a fenced JSON block
{"type":"rides","rides":[...]} is appended at the end so the frontend can render ticket cards.
"""
import json
import os
from datetime import datetime, timedelta, timezone
from typing import AsyncIterator, Literal

import httpx
from fastapi import FastAPI
from fastapi.responses import PlainTextResponse, StreamingResponse
from pydantic import BaseModel, Field

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
API_URL = os.getenv("API_URL", "http://localhost:4000").rstrip("/")  # Express API base
IST = timezone(timedelta(hours=5, minutes=30))

app = FastAPI(title="Raahi AI service")


class Msg(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(max_length=2000)


class ChatIn(BaseModel):
    messages: list[Msg] = Field(min_length=1, max_length=20)


SYSTEM = """You are Raahi Sathi, the assistant of Raahi, a verified-commuter carpooling app for Indian cities.
Rules:
- Keep answers short (2-4 sentences), friendly, light Hinglish is fine.
- Only help with commuting, ride search, fares, safety and using Raahi. Politely refuse anything else.
- To find rides you MUST call search_rides; never invent rides, prices or times.
- If pickup, drop or time is missing, ask for it in one short question.
- Fares: guests pay only for the distance they ride (distance x host price per km, minimum Rs 10).
Current time in India: {now}."""

TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "search_rides",
            "description": "Find carpool rides between two places around a given time.",
            "parameters": {
                "type": "object",
                "properties": {
                    "pickup": {"type": "string", "description": "Pickup place, e.g. 'Sector 56 Gurugram'"},
                    "drop": {"type": "string", "description": "Drop place, e.g. 'Cyber Hub Gurugram'"},
                    "time_iso": {"type": "string", "description": "Desired departure as ISO 8601 with +05:30 offset"},
                },
                "required": ["pickup", "drop", "time_iso"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "explain_fare",
            "description": "Explain/calculate a guest's fare for a distance and host price per km.",
            "parameters": {
                "type": "object",
                "properties": {"distance_km": {"type": "number"}, "price_per_km": {"type": "number"}},
                "required": ["distance_km", "price_per_km"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "safety_tips",
            "description": "Safety tips for sharing a ride.",
            "parameters": {"type": "object", "properties": {}},
        },
    },
]

SAFETY = [
    "Ride only with verified profiles and check the trust score.",
    "Share your ride details with a friend before leaving.",
    "Meet at a public, well-lit pickup point.",
    "Match the vehicle and host name before you get in.",
    "Use the in-app group chat so there is a record of plans.",
]


async def geocode(client: httpx.AsyncClient, q: str) -> dict | None:
    r = await client.get(
        "https://nominatim.openstreetmap.org/search",
        params={"q": q, "format": "json", "limit": 1, "countrycodes": "in"},
        headers={"User-Agent": "raahi-assistant/1.0 (portfolio project)"},
    )
    data = r.json() if r.status_code == 200 else []
    return {"lat": float(data[0]["lat"]), "lng": float(data[0]["lon"]), "label": data[0]["display_name"]} if data else None


async def run_tool(name: str, args: dict, found: list) -> str:
    if name == "safety_tips":
        return json.dumps({"tips": SAFETY})
    if name == "explain_fare":
        km, ppk = float(args["distance_km"]), float(args["price_per_km"])
        return json.dumps({"fare_rupees": max(10, round(km * ppk)), "formula": f"{km} km x Rs {ppk}/km, minimum Rs 10"})
    if name == "search_rides":
        async with httpx.AsyncClient(timeout=20) as client:
            p, d = await geocode(client, args["pickup"]), await geocode(client, args["drop"])
            if not p or not d:
                return json.dumps({"error": "Could not locate pickup or drop. Ask the user to be more specific."})
            r = await client.get(
                f"{API_URL}/rides/search",
                params={"pickupLat": p["lat"], "pickupLng": p["lng"], "dropLat": d["lat"], "dropLng": d["lng"],
                        "time": args["time_iso"], "windowMinutes": 45},
            )
            if r.status_code != 200:
                return json.dumps({"error": "Search is unavailable right now"})
            results = r.json().get("results", [])[:3]
            slim = [
                {
                    "id": x["ride"]["id"],
                    "host": x["ride"]["host"]["name"],
                    "from": x["ride"]["origin"]["label"],
                    "to": x["ride"]["destination"]["label"],
                    "departTime": x["ride"]["departTime"],
                    "fare": x["fare"],
                    "matchPercent": x["matchPercent"],
                    "seatsLeft": x["ride"]["seatsLeft"],
                }
                for x in results
            ]
            found.extend(slim)
            return json.dumps({"count": len(slim), "rides": slim})
    return json.dumps({"error": "unknown tool"})


async def groq(client: httpx.AsyncClient, payload: dict):
    return await client.post(GROQ_URL, json=payload, headers={"Authorization": f"Bearer {GROQ_API_KEY}"})


async def stream_chat(body: ChatIn) -> AsyncIterator[str]:
    if not GROQ_API_KEY:
        yield "Sathi abhi offline hai (GROQ_API_KEY set nahi hai). Aap rides /find page se dhundh sakte hain."
        return

    now = datetime.now(IST).strftime("%A %d %B %Y, %I:%M %p IST")
    messages: list[dict] = [{"role": "system", "content": SYSTEM.format(now=now)}]
    messages += [m.model_dump() for m in body.messages]
    found: list[dict] = []

    try:
        async with httpx.AsyncClient(timeout=60) as client:
            # Phase 1: let the model decide on tools (max 2 rounds)
            for _ in range(2):
                r = await groq(client, {"model": GROQ_MODEL, "messages": messages, "tools": TOOLS, "temperature": 0.3})
                if r.status_code != 200:
                    yield "Sathi ko thodi dikkat aa rahi hai, kuch der baad try karein."
                    return
                msg = r.json()["choices"][0]["message"]
                calls = msg.get("tool_calls")
                if not calls:
                    # no tools needed: emit the answer in small chunks so the UI still streams
                    text = msg.get("content") or ""
                    for i in range(0, len(text), 24):
                        yield text[i : i + 24]
                    break
                messages.append({"role": "assistant", "content": msg.get("content") or "", "tool_calls": calls})
                for c in calls:
                    try:
                        out = await run_tool(c["function"]["name"], json.loads(c["function"]["arguments"] or "{}"), found)
                    except Exception:
                        out = json.dumps({"error": "tool failed"})
                    messages.append({"role": "tool", "tool_call_id": c["id"], "content": out})
            else:
                # Phase 2: stream the final answer after tool results (true token streaming)
                async with client.stream(
                    "POST", GROQ_URL,
                    json={"model": GROQ_MODEL, "messages": messages, "temperature": 0.3, "stream": True},
                    headers={"Authorization": f"Bearer {GROQ_API_KEY}"},
                ) as s:
                    async for line in s.aiter_lines():
                        if not line.startswith("data: ") or line.endswith("[DONE]"):
                            continue
                        delta = json.loads(line[6:])["choices"][0]["delta"].get("content")
                        if delta:
                            yield delta
    except httpx.HTTPError:
        yield "Network issue, please try again."
        return

    if found:
        yield "\n\n```json\n" + json.dumps({"type": "rides", "rides": found}) + "\n```"


@app.get("/health")
async def health():
    return {"status": "ok", "model": GROQ_MODEL, "llm_configured": bool(GROQ_API_KEY)}


@app.post("/chat")
async def chat(body: ChatIn):
    return StreamingResponse(stream_chat(body), media_type="text/plain; charset=utf-8")


@app.get("/", response_class=PlainTextResponse)
async def root():
    return "Raahi AI service"
