import re
from typing import Optional


_GREETING_RE = re.compile(
    r"^(hi|hello|hey|howdy|greetings|good\s+(morning|afternoon|evening))\b[!.,\s]*$",
    re.IGNORECASE,
)
_FAREWELL_RE = re.compile(
    r"^(bye|goodbye|see\s+you|take\s+care|farewell)\b[!.,\s]*$",
    re.IGNORECASE,
)
_GRATITUDE_RE = re.compile(
    r"^(thanks|thank\s+you|thx|many\s+thanks|appreciate\s+it)\b[!.,\s]*$",
    re.IGNORECASE,
)
_IDENTITY_RE = re.compile(
    r"^(who\s+are\s+you|what\s+are\s+you|what\s+can\s+you\s+do|introduce\s+yourself)\b[?!.,\s]*$",
    re.IGNORECASE,
)
_DOCUMENT_HINT_RE = re.compile(
    r"\b(in\s+the\s+document|in\s+my\s+documents|from\s+the\s+pdf|in\s+the\s+pdf|document\s+say)\b",
    re.IGNORECASE,
)


def detect_intent(question: str) -> Optional[dict]:
    """
    Lightweight intent recognition for Auto mode.
    Returns a dict with either:
      - {"intent": str, "response": str} for direct conversational intents
      - {"intent": "document_query", "route": "document"} to route to document retrieval
      - None for general queries (falls through to knowledge + Wikipedia)
    """
    cleaned = " ".join(question.strip().split())
    if not cleaned:
        return None

    if _GREETING_RE.match(cleaned):
        return {
            "intent": "greeting",
            "response": "Hello! I am MiniGPT, your research assistant. Ask me anything from the knowledge base, indexed documents, or Wikipedia.",
        }

    if _FAREWELL_RE.match(cleaned):
        return {
            "intent": "farewell",
            "response": "Goodbye! Feel free to return whenever you have more questions.",
        }

    if _GRATITUDE_RE.match(cleaned):
        return {
            "intent": "gratitude",
            "response": "You're welcome! Let me know if you need anything else.",
        }

    if _IDENTITY_RE.match(cleaned):
        return {
            "intent": "identity",
            "response": (
                "I am MiniGPT, a research assistant powered by a custom PyTorch GPT model, "
                "a local knowledge base, document retrieval, and a Wikipedia fallback in Auto mode."
            ),
        }

    if _DOCUMENT_HINT_RE.search(cleaned):
        return {
            "intent": "document_query",
            "route": "document",
        }

    return None
