"""Shared settings + embedding helper for ingest.py and server.py."""
import os
from pathlib import Path

HERE = Path(__file__).parent

# Any sentence-transformers model works. Change it, then re-run ingest.py.
#   BAAI/bge-small-en-v1.5   small + fast, English only (default)
#   BAAI/bge-base-en-v1.5    better quality, English only
#   BAAI/bge-m3              multilingual incl. Bangla, larger/slower (~2 GB)
MODEL_NAME = os.getenv("EMBED_MODEL", "BAAI/bge-small-en-v1.5")

DB_DIR = os.getenv("CHROMA_DIR", str(HERE / "chroma_db"))
COLLECTION = "laws"

# bge English models want an instruction on the *query* side only.
_name = MODEL_NAME.lower()
_default_query_prefix = (
    "Represent this sentence for searching relevant passages: "
    if "bge" in _name and "-en" in _name
    else ""
)
DOC_PREFIX = os.getenv("DOC_PREFIX", "")
QUERY_PREFIX = os.getenv("QUERY_PREFIX", _default_query_prefix)

_model = None


def get_model():
    global _model
    if _model is None:
        from sentence_transformers import SentenceTransformer

        print(f"Loading embedding model: {MODEL_NAME}")
        _model = SentenceTransformer(MODEL_NAME)
    return _model


def embed(texts, prefix=""):
    vectors = get_model().encode(
        [prefix + t for t in texts],
        normalize_embeddings=True,  # cosine similarity = dot product
        batch_size=16,
        show_progress_bar=False,
    )
    return [list(map(float, v)) for v in vectors]
