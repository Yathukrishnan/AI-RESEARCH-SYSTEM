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
    "You are the Chief Strategy Officer and Lead Intelligence Analyst for a Tier-1 Tech Publication. "
    "Your audience consists of Managing Directors and VCs who demand strategic synthesis, not summaries. "

    "THE CROSS-POLLINATION MANDATE (CRITICAL): "
    "You are evaluating 150 research papers. You MUST NOT group identical papers together. "
    "Your job is to find the 'Hidden Intersections'. You must club disparate domains "
    "(e.g., Neuroscience + LLM routing, or Quantum Physics + NLP hardware) to reveal macro-trends. "
    "If a report only discusses one narrow subfield, it is a failure. "

    "NO HALLUCINATION MANDATE: "
    "You must ground every strategic claim strictly in the data, abstracts, and author metrics "
    "provided in the prompt. Do not invent capabilities, metrics, or future features that are not "
    "explicitly supported by the batch data. "

    "STRICT FORBIDDEN RULES (Zero-Tolerance): "
    "1. NO PAPER TITLES: Never mention a paper title in the headline or narrative body. "
    "2. NO CITATIONS/BRACKETS: Never use [p1], [25], or any citation markers. "
    "3. NO LISTING: Do not write 'One study shows... another says...'. Write a unified editorial. "

    "EDITORIAL STANDARDS: "
    "- HEADLINES: Must reflect the intersection of fields (e.g., 'The Biological Pivot in Silicon Architecture'). "
    "- EXECUTIVE TAKEAWAYS: 3 bullet points detailing the 'So What?' for the industry. "
    "- 12-MONTH OUTLOOK: A bold prediction based on the data. "
    "- NARRATIVE: 300-500 words of sophisticated prose. "

    "ANTI-HALLUCINATION: Do NOT construct any URLs or Markdown links in any body field. "
    "In the sources array ONLY, use the tag string (e.g. 'P3', no brackets) to identify papers. "
    "Python will construct the real URLs from the tags after generation — do NOT write URLs yourself. "

    "Return ONLY a valid JSON object with a single key 'reports' containing an array. "
    "No markdown wrapper, no code fences. "
    "Each report object MUST have exactly these keys: "
    "headline (string, punchy trend hook — no paper titles, no author names, no brackets), "
    "executive_takeaways (string, Markdown bullet list of exactly 3 points — no citations, no brackets), "
    "twelve_month_outlook (string, 2-3 bold strategic sentences — no citations, no brackets), "
    "narrative_body (string, 300-500 word Markdown deep-dive — no paper titles, no brackets, no links), "
    "novelty_score (float 1.0-10.0), "
    "sources (array of objects, each with: "
    "  tag (string e.g. 'P3', NO brackets — just the number and letter), "
    "  title (string, the full paper title from the context data))."
)


class EditorAgent:
    """Fetch recent papers → LLM clustering → save generated articles."""

    # ── 1. Context data ───────────────────────────────────────────────────────

    async def _fetch_context_data(self) -> tuple[list[dict[str, Any]], dict[str, dict]]:
        """
        Return (llm_context, paper_map).

        llm_context — safe list sent to the LLM (no arXiv IDs).
        paper_map   — {"[P1]": {"id": "2501.12345", "title": "..."}, …}

        Deduplication: cross-references all previously published sources_json so
        the LLM never sees a paper it has already written about.
        Diversity shuffle: fetches top-1000 by engagement, groups by primary subject,
        then round-robins one paper per category to guarantee cross-domain breadth.
        """
        # 1. Collect every arXiv URL already published in autonomous_articles
        memory_rows = await db.fetchall("SELECT sources_json FROM autonomous_articles")
        published_urls: set[str] = set()
        for row in memory_rows:
            raw = row.get("sources_json")
            if raw:
                try:
                    for src in json.loads(raw):
                        url = src.get("url", "")
                        if url:
                            published_urls.add(url)
                except Exception:
                    pass
        logger.info("EditorAgent: %d URLs already published", len(published_urls))

        # 2. Fetch massive pool — top engagement across the last 60 days
        raw_rows = await db.fetchall(
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
            WHERE published_at >= '2025-10-01'
              AND is_deleted   = 0
              AND is_duplicate = 0
            ORDER BY (
                COALESCE(github_stars, 0)
                + COALESCE(hf_upvotes, 0)
                + COALESCE(hn_points, 0)
                + COALESCE(citation_count, 0) * 10
                + COALESCE(influential_citation_count, 0) * 50
                + COALESCE(h_index_max, 0) * 5
            ) DESC
            LIMIT 1000
            """,
        )

        # 3. Diversity organizer — group unseen papers by primary subject
        categorized_papers: dict[str, list[dict]] = {}
        for r in raw_rows:
            arxiv_id = r.get("arxiv_id", "")
            if f"https://arxiv.org/abs/{arxiv_id}" in published_urls:
                continue
            # Primary subject: prefer primary_category, fall back to ai_topic_category
            subject = (
                r.get("primary_category")
                or r.get("ai_topic_category")
                or "general"
            ).split(".")[0].strip()  # e.g. "cs.LG" → "cs"
            categorized_papers.setdefault(subject, []).append(r)

        logger.info(
            "EditorAgent: %d subjects found across %d fresh candidates",
            len(categorized_papers), sum(len(v) for v in categorized_papers.values()),
        )

        # 4. Round-robin dealer — one paper per category per round until 150
        fresh_rows: list[dict] = []
        while len(fresh_rows) < 150:
            added_this_round = False
            for subject in list(categorized_papers.keys()):
                if categorized_papers[subject]:
                    fresh_rows.append(categorized_papers[subject].pop(0))
                    added_this_round = True
                if len(fresh_rows) == 150:
                    break
            if not added_this_round:
                break  # exhausted all valid papers before reaching 150

        logger.info("EditorAgent: %d papers selected via diversity shuffle", len(fresh_rows))

        llm_context: list[dict[str, Any]] = []
        paper_map: dict[str, dict] = {}

        for i, r in enumerate(fresh_rows, start=1):
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
                    "max_tokens": 8000,
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

        parsed = json.loads(raw)
        # Accept intelligence_reports, reports, or bare array
        if isinstance(parsed, dict):
            articles = (
                parsed.get("intelligence_reports")
                or parsed.get("reports")
                or []
            )
        elif isinstance(parsed, list):
            articles = parsed
        else:
            raise ValueError("LLM did not return a recognisable JSON structure")
        if not articles:
            raise ValueError("LLM returned an empty reports list")

        logger.info("EditorAgent: LLM returned %d reports", len(articles))
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

        # Extract the 150 arXiv IDs sent to the LLM for context traceability
        selected_arxiv_ids = [meta["id"] for meta in paper_map.values() if meta.get("id")]
        run_timestamp = datetime.now(timezone.utc).isoformat()

        # Record this editor run before calling the LLM
        # Turso Hrana returns last_insert_rowid in the execute result dict directly
        run_result = await db.execute(
            """
            INSERT INTO editor_runs (run_timestamp, candidate_pool_size, selected_context_ids)
            VALUES (?, ?, ?)
            """,
            [run_timestamp, 1000, json.dumps(selected_arxiv_ids)],
        )
        raw_run_id = run_result.get("last_insert_rowid")
        try:
            run_id = int(raw_run_id) if raw_run_id is not None else None
        except (TypeError, ValueError):
            run_id = None
        logger.info(
            "EditorAgent: recorded editor_run id=%s with %d context IDs",
            run_id, len(selected_arxiv_ids),
        )

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

            # narrative_body — editorial prose, no tags or links
            article_body = str(art.get("narrative_body") or art.get("article_body", ""))

            # new structured fields
            executive_takeaways = str(art.get("executive_takeaways", ""))
            twelve_month_outlook = str(art.get("twelve_month_outlook", ""))

            # strategic_outlook — fallback to twelve_month_outlook or legacy field
            strategic_outlook = (
                twelve_month_outlook
                or str(art.get("strategic_outlook") or art.get("strategic_implications", ""))
            )

            # Resolve sources: [{tag, title}] → [{title, url}]
            # The LLM provides the tag (e.g. "P3"); Python builds the arXiv URL.
            raw_sources = art.get("sources", [])
            if not isinstance(raw_sources, list):
                raw_sources = []
            resolved_sources = []
            resolved_refs = []   # kept for cluster_count / paper_ids
            for src in raw_sources:
                if not isinstance(src, dict):
                    continue
                raw_tag = str(src.get("tag", "")).strip()
                # Accept both "P3" and "[P3]" from the LLM
                bracket_tag = raw_tag if raw_tag.startswith("[") else f"[{raw_tag}]"
                meta = paper_map.get(bracket_tag, {})
                arxiv_id = meta.get("id", "")
                title = str(src.get("title", "") or meta.get("title", raw_tag))
                resolved_sources.append({
                    "title": title,
                    "url": f"https://arxiv.org/abs/{arxiv_id}" if arxiv_id else "",
                })
                resolved_refs.append({"title": title, "id": arxiv_id})

            key_authors = art.get("key_authors", [])
            if not isinstance(key_authors, list):
                key_authors = []

            try:
                novelty_score = float(art.get("novelty_score", 0.0))
            except (TypeError, ValueError):
                novelty_score = 0.0

            try:
                points = int(art.get("points", round(novelty_score * 50)))
            except (TypeError, ValueError):
                points = 0

            cluster_count = len(resolved_refs)
            paper_ids = [r["id"] for r in resolved_refs if r.get("id")]

            try:
                await db.execute(
                    """
                    INSERT INTO autonomous_articles
                        (headline, article_body, points, cluster_count, paper_ids,
                         key_authors, strategic_implications, novelty_score,
                         strategic_outlook, references_json,
                         executive_takeaways, twelve_month_outlook, sources_json, run_id)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    [
                        headline, article_body, points, cluster_count, json.dumps(paper_ids),
                        json.dumps(key_authors), strategic_outlook, novelty_score,
                        strategic_outlook, json.dumps(resolved_refs),
                        executive_takeaways, twelve_month_outlook, json.dumps(resolved_sources),
                        run_id,
                    ],
                )
                saved += 1
            except Exception as e:
                logger.error("EditorAgent: failed to save article '%s': %s", headline[:60], e)

        logger.info("EditorAgent: saved %d / %d articles", saved, len(articles))
        return saved
