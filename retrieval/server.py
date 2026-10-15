"""
Search service used by the NestJS backend.

    python -m uvicorn server:app --port 8000
"""
from contextlib import asynccontextmanager

import chromadb
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

import common

state = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    client = chromadb.PersistentClient(path=common.DB_DIR)
    try:
        col = client.get_collection(common.COLLECTION)
    except Exception:
        col = None
        print("!! No collection found. Run: python ingest.py")
    if col is not None:
        built_with = (col.metadata or {}).get("embed_model")
        if built_with and built_with != common.MODEL_NAME:
            print(
                f"!! Database was built with '{built_with}' but EMBED_MODEL is "
                f"'{common.MODEL_NAME}'. Re-run ingest.py."
            )
        common.get_model()  # load now so the first request is fast
        print(f"Ready: {col.count()} chunks")
    state["col"] = col
    yield


app = FastAPI(lifespan=lifespan)


class SearchRequest(BaseModel):
    query: str = Field(min_length=1, max_length=4000)
    k: int = Field(default=5, ge=1, le=20)


def excerpt(text: str, limit: int = 450) -> str:
    lines = text.split("\n")
    idx = next((i for i, l in enumerate(lines) if l.startswith("Section")), -1)
    body = " ".join(lines[idx + 1 :])
    return body if len(body) <= limit else body[:limit] + "…"


@app.get("/health")
def health():
    col = state.get("col")
    return {"ok": col is not None, "chunks": col.count() if col else 0,
            "model": common.MODEL_NAME}


@app.post("/search")
def search(req: SearchRequest):
    col = state.get("col")
    if col is None:
        raise HTTPException(503, "No vector database. Run: python ingest.py")

    qv = common.embed([req.query], common.QUERY_PREFIX)
    res = col.query(
        query_embeddings=qv,
        n_results=min(req.k, col.count()),
        include=["documents", "metadatas", "distances"],
    )
    results = []
    for id_, doc, meta, dist in zip(
        res["ids"][0], res["documents"][0], res["metadatas"][0], res["distances"][0]
    ):
        results.append(
            {
                "id": id_,
                "act": meta["act"],
                "year": meta["year"],
                "actNo": meta["act_no"],
                "section": meta["section"],
                "title": meta["title"],
                "chapter": meta["chapter"],
                "score": round(1 - dist, 3),  # cosine distance -> similarity
                "excerpt": excerpt(doc),
                "text": doc,  # full chunk, used by the backend to build the prompt
            }
        )
    return {"results": results}
