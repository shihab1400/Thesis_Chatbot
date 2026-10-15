"""
Build the vector database.

    python ingest.py                       # uses ../backend/data/laws.jsonl
    python ingest.py path/to/laws.jsonl

Re-running wipes and rebuilds the collection, so it is safe to repeat.
"""
import json
import sys
from pathlib import Path

import chromadb

import common

BATCH = 32


def main():
    path = (
        Path(sys.argv[1])
        if len(sys.argv) > 1
        else common.HERE.parent / "backend" / "data" / "laws.jsonl"
    )
    if not path.exists():
        sys.exit(f"Dataset not found: {path}")

    records = [json.loads(l) for l in path.open(encoding="utf-8") if l.strip()]
    print(f"{len(records)} chunks from {path}")

    client = chromadb.PersistentClient(path=common.DB_DIR)
    try:
        client.delete_collection(common.COLLECTION)
    except Exception:
        pass  # first run
    col = client.create_collection(
        common.COLLECTION,
        metadata={"hnsw:space": "cosine", "embed_model": common.MODEL_NAME},
    )

    for i in range(0, len(records), BATCH):
        batch = records[i : i + BATCH]
        col.add(
            ids=[r["id"] for r in batch],
            documents=[r["text"] for r in batch],
            embeddings=common.embed([r["text"] for r in batch], common.DOC_PREFIX),
            metadatas=[
                {
                    "act": r.get("act_title") or "",
                    "year": r.get("act_year") or "",
                    "act_no": r.get("act_no") or "",
                    "section": r.get("section_no") or "",
                    "title": r.get("section_title") or "",
                    "chapter": r.get("chapter_no") or "",
                }
                for r in batch
            ],
        )
        print(f"\r{min(i + BATCH, len(records))}/{len(records)}", end="", flush=True)

    print(f"\nDone. Stored {col.count()} chunks in {common.DB_DIR}")


if __name__ == "__main__":
    main()
