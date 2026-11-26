import json
import re
from sentence_transformers import SentenceTransformer


class RetrievalEngine:
    def __init__(self, assets):
        self.knowledge = json.loads(
            (assets / "minigpt_knowledge.json").read_text(encoding="utf-8")
        )

        self.documents = json.loads(
            (assets / "minigpt_documents.json").read_text(encoding="utf-8")
        )

        print("Loading semantic search model...")

        self.embedder = SentenceTransformer(
            "sentence-transformers/all-MiniLM-L6-v2",
            device="cpu"
        )

        self.questions = [
            q for q in self.knowledge
            if not re.search(r"\d", q)
        ]

        self.question_vectors = self.embedder.encode(
            self.questions,
            convert_to_tensor=True,
            normalize_embeddings=True
        ) if self.questions else None

        self.document_vectors = self.embedder.encode(
            [doc["text"] for doc in self.documents],
            convert_to_tensor=True,
            normalize_embeddings=True
        ) if self.documents else None

        print("Retrieval engine ready!")

    def normalize(self, question):
        return " ".join(re.findall(r"\w+", question.lower()))

    def knowledge_reply(self, question):
        key = self.normalize(question)

        if key in self.knowledge:
            return {
                "response": self.knowledge[key],
                "mode": "knowledge",
                "match_type": "exact",
                "sources": []
            }

        if re.search(r"\d", question) or not self.questions:
            return self.unknown_reply()

        vector = self.embedder.encode(
            question,
            convert_to_tensor=True,
            normalize_embeddings=True
        )

        scores = self.question_vectors @ vector
        ranked = scores.argsort(descending=True).tolist()

        index = ranked[0]
        matched = self.questions[index]
        score = scores[index].item()
        answer = self.knowledge[matched]

        second = next(
            (
                scores[i].item()
                for i in ranked[1:]
                if self.knowledge[self.questions[i]] != answer
            ),
            -1.0
        )

        if score >= 0.72 and score - second >= 0.05:
            return {
                "response": answer,
                "mode": "knowledge",
                "match_type": "semantic",
                "matched_question": matched,
                "similarity": round(score, 3),
                "sources": []
            }

        return self.unknown_reply()

    def unknown_reply(self):
        return {
            "response": "I could not find a reliable answer.",
            "mode": "knowledge",
            "match_type": "none",
            "sources": []
        }

    def document_reply(self, question):
        if not self.documents:
            return {
                "response": "No documents are available.",
                "mode": "document",
                "sources": []
            }

        vector = self.embedder.encode(
            question,
            convert_to_tensor=True,
            normalize_embeddings=True
        )

        scores = self.document_vectors @ vector
        values, indices = scores.topk(
            min(2, len(self.documents))
        )

        passages = []
        sources = []

        for score, index in zip(values.tolist(), indices.tolist()):
            if score >= 0.35:
                doc = self.documents[index]
                passages.append(doc["text"])

                sources.append({
                    "filename": doc["source"],
                    "page": doc["page"],
                    "similarity": round(score, 3)
                })

        return {
            "response": "\n\n".join(passages) if passages else "No relevant passage found.",
            "mode": "document",
            "sources": sources
        }