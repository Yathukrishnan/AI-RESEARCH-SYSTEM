"""
EditorAgent — autonomous AI editor that clusters recent papers and
generates Hacker News-style articles, saved to autonomous_articles.

Token-masking strategy: arXiv IDs are never sent to the LLM. Each paper
is assigned a tag ([P1], [P2], …) and Python replaces the tags with
correctly-formed Markdown links after generation.
"""
import json
import logging
import re
from datetime import datetime, timezone, timedelta
from typing import Any

import httpx

from app.core.config import settings
from app.core.turso import db

logger = logging.getLogger(__name__)

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
MODEL = "google/gemini-2.5-flash-lite"

SYSTEM_PROMPT = (
    "You are the autonomous Editor-in-Chief of a brutalist AI research aggregator. "
    "Analyze the provided papers. Look for: "
    "1) Cross-domain overlaps (e.g., Vision + Biotech). "
    "2) Streaks by specific authors. "
    "3) Papers with exceptional engagement across any platform. "
    "Generate exactly 5 articles based on these clusters. "
    "CONSTRAINT 1: The headline MUST be a punchy hook under 140 characters. "
    "CONSTRAINT 2: Provide a 2-paragraph article_body explaining the connection. "
    "Assign a realistic points value (10-500) based on importance. "
    "CRITICAL: You MUST create at least ONE headline and article focused entirely on a specific "
    "Author or Lab if they have published multiple papers or a highly influential paper in the "
    "provided data. "
    "You now have access to a rich set of engagement metrics for each paper (citations, "
    "influential citations, citation velocity, GitHub stars, GitHub forks, star velocity, "
    "HuggingFace upvotes, Hacker News points and comments, platform views/saves/clicks, "
    "trending score, rising score, gem score) and author h-index (h_index_max). "
    "You MUST weigh all of these signals holistically to determine what is truly a breakthrough. "
    "When writing the Author Spotlight, you MUST reference their historical impact (h_index_max) "
    "to justify why we are tracking them. "
    "CRITICAL: The article_body MUST be written in Markdown. "
    "ANTI-HALLUCINATION: You are strictly forbidden from writing URLs or Markdown links. "
    "When you mention a paper in the article_body, you MUST refer to it using its exact tag "
    "from the context data, formatted exactly like this: [P1] or [P2]. "
    "Do NOT construct any URLs. Do NOT write [...](http...) links yourself. "
    "Return ONLY a valid JSON array — no markdown wrapper, no code fences around the array. "
    "Each element must have exactly these keys: "
    "headline (string), article_body (string), points (integer), paper_ids (array of tags e.g. ['[P1]', '[P3]'])."
)


class EditorAgent:
    """Fetch recent papers → LLM clustering → save generated articles."""

    # ── 1. Context data ───────────────────────────────────────────────────────

    async def _fetch_context_data(self) -> tuple[list[dict[str, Any]], dict[str, dict]]:
        """
        Return (llm_context, paper_map).

        llm_context — safe list sent to the LLM (no arXiv IDs).
        paper_map   — {"[P1]": {"id": "2501.12345", "title": "..."}, …}
        """
        rows = await db.fetchall(
            """
            SELECT
                arxiv_id,
                title,
                authors,
                primary_category,
                categories,
                ai_topic_category,
                ai_topic_tags,
                h_index_max,
                citation_count,
                influential_citation_count,
                citation_velocity,
                github_stars,
                github_forks,
                star_velocity,
                hf_upvotes,
                hn_points,
                hn_comments,
                view_count,
                save_count,
                click_count,
                trending_score,
                rising_score,
                gem_score,
                current_score,
                trend_label
            FROM papers
            WHERE (
                created_at > date('now', '-7 days')
                OR github_stars > 100
            )
              AND is_deleted   = 0
              AND is_duplicate = 0
            ORDER BY (
                COALESCE(github_stars, 0)
                + COALESCE(hf_upvotes, 0)
                + COALESCE(hn_points, 0)
                + COALESCE(citation_count, 0) * 10
                + COALESCE(influential_citation_count, 0) * 50
            ) DESC, created_at DESC
            LIMIT 40
            """,
        )

        llm_context: list[dict[str, Any]] = []
        paper_map: dict[str, dict] = {}

        for i, r in enumerate(rows, start=1):
            tag = f"[P{i}]"

            # Parse JSON columns safely
            try:
                authors_raw = json.loads(r.get("authors") or "[]")
                authors = (
                    [a.get("name", "") for a in authors_raw[:3]]
                    if authors_raw and isinstance(authors_raw[0], dict)
                    else authors_raw[:3]
                )
            except Exception:
                authors = []

            try:
                cats = json.loads(r.get("categories") or "[]")
            except Exception:
                cats = []

            try:
                ai_tags = json.loads(r.get("ai_topic_tags") or "[]")
            except Exception:
                ai_tags = []

            subjects = list(
                {r.get("primary_category"), r.get("ai_topic_category"), *cats, *ai_tags} - {None, ""}
            )

            arxiv_id = r.get("arxiv_id", "")
            title = (r.get("title") or "")[:120]

            # Store the real ID in the map — never sent to the LLM
            paper_map[tag] = {"id": arxiv_id, "title": title}

            # Send only the tag, not the ID — include all engagement signals
            llm_context.append({
                "tag": tag,
                "title": title,
                "authors": authors,
                "subjects": subjects[:5],
                "h_index_max": round(float(r.get("h_index_max") or 0), 1),
                "cites": int(r.get("citation_count") or 0),
                "influential_cites": int(r.get("influential_citation_count") or 0),
                "cite_velocity": round(float(r.get("citation_velocity") or 0), 2),
                "stars": int(r.get("github_stars") or 0),
                "forks": int(r.get("github_forks") or 0),
                "star_velocity": round(float(r.get("star_velocity") or 0), 2),
                "hf": int(r.get("hf_upvotes") or 0),
                "hn_pts": int(r.get("hn_points") or 0),
                "hn_comments": int(r.get("hn_comments") or 0),
                "views": int(r.get("view_count") or 0),
                "saves": int(r.get("save_count") or 0),
                "clicks": int(r.get("click_count") or 0),
                "trending_score": round(float(r.get("trending_score") or 0), 3),
                "rising_score": round(float(r.get("rising_score") or 0), 3),
                "gem_score": round(float(r.get("gem_score") or 0), 3),
                "trend_label": r.get("trend_label") or "",
            })

        logger.info("EditorAgent: fetched %d papers for context", len(llm_context))
        return llm_context, paper_map

    # ── 2. LLM call ──────────────────────────────────────────────────────────

    async def _call_llm(self, context: list[dict], system_prompt: str = SYSTEM_PROMPT) -> list[dict]:
        """Send masked context to Gemini 2.5 Flash Lite, return parsed articles."""
        api_key = settings.OPENROUTER_API_KEY
        if not api_key:
            raise RuntimeError("OPENROUTER_API_KEY is not configured")

        user_message = (
            "Here are the recent AI research papers. Each has a tag (e.g. [P1]) — "
            "use ONLY these tags when referencing papers. "
            "Generate exactly 5 editor articles:\n\n"
            + json.dumps(context, ensure_ascii=False)
        )

        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(
                OPENROUTER_URL,
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                    "HTTP-Referer": "https://ai-research-intelligence.com",
                },
                json={
                    "model": MODEL,
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_message},
                    ],
                    "max_tokens": 3000,
                    "temperature": 0.1,
                },
            )

        if resp.status_code != 200:
            raise RuntimeError(f"OpenRouter error {resp.status_code}: {resp.text[:300]}")

        raw = resp.json()["choices"][0]["message"]["content"].strip()

        # Strip markdown code fences if the model wraps anyway
        raw = re.sub(r"^```(?:json)?\s*", "", raw, flags=re.MULTILINE)
        raw = re.sub(r"\s*```$", "", raw, flags=re.MULTILINE)
        raw = raw.strip()

        articles = json.loads(raw)
        if not isinstance(articles, list):
            raise ValueError("LLM did not return a JSON array")

        logger.info("EditorAgent: LLM returned %d articles", len(articles))
        return articles

    # ── 3. Post-process: replace tags with real Markdown links ────────────────

    @staticmethod
    def _resolve_tags(body: str, paper_map: dict[str, dict]) -> str:
        """Replace every [Pn] tag in body with a proper Markdown link."""
        for tag, meta in paper_map.items():
            link = f"[{meta['title']}](https://arxiv.org/abs/{meta['id']})"
            body = body.replace(tag, link)
        return body

    @staticmethod
    def _fix_arxiv_urls(text: str) -> str:
        """Truncate hallucinated extra digits in arXiv URLs (e.g. 2604.011791 → 2604.01179)."""
        return re.sub(r'(https://arxiv\.org/abs/\d{4}\.\d{5})\d+', r'\1', text)

    # ── 4. Save + orchestrate ─────────────────────────────────────────────────

    @staticmethod
    def _find_top_author(llm_context: list[dict]) -> str | None:
        """Return the most frequently appearing author across all context papers."""
        tally: dict[str, int] = {}
        for paper in llm_context:
            for author in paper.get("authors", []):
                name = (author or "").strip()
                if name:
                    tally[name] = tally.get(name, 0) + 1
        if not tally:
            return None
        return max(tally, key=lambda n: tally[n])

    async def generate_and_save_feed(self) -> int:
        """Full pipeline: fetch → LLM → resolve tags → save. Returns count saved."""
        llm_context, paper_map = await self._fetch_context_data()
        if not llm_context:
            logger.warning("EditorAgent: no papers found, aborting")
            return 0

        # Build a run-specific system prompt with a mandatory author spotlight
        top_author = self._find_top_author(llm_context)
        if top_author:
            author_mandate = (
                f"MANDATORY: Article 1 MUST be an Author Spotlight focusing entirely on the "
                f"work of '{top_author}'. You MUST include their name in the headline."
            )
            prompt = SYSTEM_PROMPT + " " + author_mandate
        else:
            prompt = SYSTEM_PROMPT

        articles = await self._call_llm(llm_context, system_prompt=prompt)

        saved = 0
        for art in articles:
            headline = str(art.get("headline", ""))[:140]
            raw_body = str(art.get("article_body", ""))

            # Replace [P1]-style tags with real arXiv Markdown links, then
            # strip any hallucinated extra digits from URLs (e.g. 2604.011791 → 2604.01179)
            article_body = self._fix_arxiv_urls(self._resolve_tags(raw_body, paper_map))

            points = int(art.get("points", 50))

            # paper_ids may be tags ("[P1]") or real IDs; resolve to real IDs
            raw_ids = art.get("paper_ids", [])
            if not isinstance(raw_ids, list):
                raw_ids = []
            paper_ids = [
                paper_map[pid]["id"] if pid in paper_map else pid
                for pid in raw_ids
            ]
            cluster_count = len(paper_ids)

            try:
                await db.execute(
                    """
                    INSERT INTO autonomous_articles
                        (headline, article_body, points, cluster_count, paper_ids)
                    VALUES (?, ?, ?, ?, ?)
                    """,
                    [headline, article_body, points, cluster_count, json.dumps(paper_ids)],
                )
                saved += 1
            except Exception as e:
                logger.error("EditorAgent: failed to save article '%s': %s", headline[:60], e)

        logger.info("EditorAgent: saved %d / %d articles", saved, len(articles))
        return saved
