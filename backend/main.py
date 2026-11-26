from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from pathlib import Path
from typing import Literal, Optional

from engine import MiniGPTEngine
from intent import detect_intent
from retrieval import RetrievalEngine
from web_search import search_wikipedia


app = FastAPI(title="MiniGPT API", version="2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173"
    ],
    allow_origin_regex=r"https://.*\.onrender\.com",
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"]
)

ASSETS = Path(__file__).resolve().parent.parent / "assets" / "minigpt_assets"

engine = MiniGPTEngine(ASSETS / "minigpt_chat.pth")
retrieval = RetrievalEngine(ASSETS)


class ConversationContext(BaseModel):
    topic: str = Field(default="", max_length=1000)
    mode: Literal["knowledge", "document"] = "knowledge"


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=1000)
    mode: Literal["auto", "knowledge", "document", "neural"] = "auto"
    context: Optional[ConversationContext] = None


@app.get("/")
def home():
    return {"message": "MiniGPT API is running"}


@app.get("/health")
@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "model_loaded": engine.model is not None,
        "device": engine.device,
        "parameters": sum(p.numel() for p in engine.model.parameters()) if engine.model is not None else 0,
        "knowledge_entries": len(retrieval.knowledge),
        "document_chunks": len(retrieval.documents)
    }


@app.post("/chat")
@app.post("/api/chat")
def chat(request: ChatRequest):
    question = request.message.strip()
    mode = request.mode

    if not question:
        raise HTTPException(status_code=400, detail="Enter a question.")

    if mode == "neural":
        try:
            answer = engine.reply(question)
            return {
                "response": answer or "No response generated.",
                "mode": "neural",
                "sources": [],
                "warning": "Experimental response; may be inaccurate."
            }
        except ValueError as error:
            raise HTTPException(status_code=400, detail=str(error))

    if question.lower().startswith("/doc "):
        mode = "document"
        question = question[5:].strip()

    followup_prefixes = (
        "tell me more",
        "explain more",
        "what is its",
        "what are its",
        "how does it",
        "give me an example"
    )

    previous = request.context

    followup = (
        previous is not None
        and bool(previous.topic)
        and question.lower().startswith(followup_prefixes)
        and (mode == "auto" or mode == previous.mode)
    )

    if followup:
        topic = previous.topic
        effective_question = topic + " " + question
        if mode == "auto":
            mode = previous.mode
    else:
        topic = question
        effective_question = question

    is_auto = mode == "auto"
    print(f"[Chat] incoming mode={request.mode!r}, question={question!r}")

    if is_auto and not followup:
        try:
            intent_result = detect_intent(question)
            if intent_result:
                print(f"[Chat] intent={intent_result.get('intent')!r}")
                if "response" in intent_result:
                    return {
                        "response": intent_result["response"],
                        "mode": "intent",
                        "match_type": intent_result["intent"],
                        "sources": [],
                        "context": {
                            "topic": topic,
                            "mode": "knowledge",
                        },
                    }
                if intent_result.get("route") == "document":
                    mode = "document"
        except Exception as err:
            print(f"[Chat] intent detection failed, falling back: {err}")

    if mode == "auto":
        mode = "knowledge"

    if mode == "document":
        result = retrieval.document_reply(effective_question)
    else:
        result = retrieval.knowledge_reply(effective_question)
        print(f"[Chat] retrieval match_type={result.get('match_type')!r}")
        if is_auto and result.get("match_type") == "none":
            print("[Chat] Auto mode fallback -> triggering Wikipedia search")
            wiki_result = search_wikipedia(effective_question)
            if wiki_result is not None:
                result = wiki_result

    result["context"] = {
        "topic": topic,
        "mode": mode
    }

    return result