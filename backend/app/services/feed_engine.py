"""
Feed engine helpers – shared utilities for feed/card normalization.
The main feed building logic lives in app/api/feed.py using Turso directly.
"""

import json


def paper_to_card(p: dict) -> dict:
    """Normalize a raw Turso row dict for feed/card display."""
    for field in ("authors", "categories", "ai_topic_tags"):
        val = p.get(field)
        if isinstance(val, str):
            try:
                p[field] = json.loads(val)
            except Exception:
                p[field] = []
        elif val is None:
            p[field] = []
    return p
