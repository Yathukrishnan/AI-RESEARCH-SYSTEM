import httpx
import asyncio
import logging
import json
import re
from typing import Dict, List, Optional
from sklearn.feature_extraction.text import TfidfVectorizer
import numpy as np
from app.core.config import settings

logger = logging.getLogger(__name__)

# Comprehensive AI keyword list
AI_KEYWORDS = [
    # Core AI/ML
    "transformer", "attention mechanism", "self-attention", "cross-attention",
    "large language model", "llm", "gpt", "bert", "t5", "llama", "claude", "gemini",
    "neural network", "deep learning", "machine learning", "artificial intelligence",
    # Generative
    "diffusion model", "denoising diffusion", "stable diffusion", "image generation",
    "text generation", "generative model", "gan", "vae", "variational autoencoder",
    # Training techniques
    "rlhf", "reinforcement learning from human feedback", "fine-tuning", "instruction tuning",
    "prompt tuning", "prefix tuning", "lora", "adapter", "peft", "parameter efficient",
    "contrastive learning", "self-supervised", "semi-supervised", "few-shot", "zero-shot",
    # Architectures
    "multimodal", "vision-language", "vision language", "encoder-decoder", "autoregressive",
    "mixture of experts", "moe", "sparse model", "efficient transformer", "linear attention",
    "state space model", "mamba", "rwkv", "recurrent",
    # Tasks
    "text classification", "sentiment analysis", "named entity recognition", "ner",
    "question answering", "machine translation", "summarization", "text summarization",
    "image classification", "object detection", "semantic segmentation", "pose estimation",
    "speech recognition", "text-to-speech", "tts", "asr",
    # Specific domains
    "reasoning", "chain of thought", "cot", "in-context learning", "retrieval augmented",
    "rag", "knowledge graph", "graph neural network", "gnn", "reinforcement learning",
    "reward model", "policy gradient", "ppo", "dpo", "constitutional ai",
    # Safety/Alignment
    "ai safety", "alignment", "hallucination", "factuality", "robustness",
    "adversarial", "explainability", "interpretability", "bias", "fairness",
    # Efficiency
    "quantization", "pruning", "distillation", "knowledge distillation", "compression",
    "inference optimization", "efficient inference", "speculative decoding",
    # Vision
    "vision transformer", "vit", "clip", "sam", "segment anything", "dino",
    "controlnet", "image editing",
    # Embeddings
    "embedding", "representation learning", "word embedding", "sentence embedding",
    "vector database", "semantic search", "dense retrieval",
]

def compute_tfidf_keyword_score(text: str, keywords: List[str]) -> float:
    """Compute TF-IDF based keyword relevance score."""
    if not text or not keywords:
        return 0.0

    text_lower = text.lower()

    # Direct keyword matching with weights
    exact_matches = 0
    partial_matches = 0

    for kw in keywords:
        kw_lower = kw.lower()
        if kw_lower in text_lower:
            # Count occurrences
            count = text_lower.count(kw_lower)
            if count >= 2:
                exact_matches += 1.5
            else:
                exact_matches += 1
        elif any(word in text_lower for word in kw_lower.split()):
            partial_matches += 0.3

    total_words = len(text.split()) or 1
    raw_score = (exact_matches * 2 + partial_matches) / (total_words ** 0.3)

    # Normalize to 0-1
    return min(1.0, raw_score / 5.0)

class AIValidationService:
    def __init__(self, api_key: str):
        self._api_key = api_key
        self.model = "google/gemini-2.5-flash-lite"
        self.base_url = "https://openrouter.ai/api/v1"

    async def validate_paper(self, title: str, abstract: str, keywords: List[str]) -> Dict:
        """Use Gemini Flash Lite to validate AI relevance and classify paper."""
        if not self._api_key:
            # Fallback to TF-IDF only
            return self._tfidf_fallback(title, abstract, keywords)

        prompt = f"""Analyze this research paper and respond with ONLY valid JSON (no markdown, no code blocks):

Title: {title[:300]}
Abstract: {abstract[:800]}

Respond with exactly this JSON structure:
{{
  "relevance_score": <0.0-1.0, how relevant to AI/ML research>,
  "impact_score": <0.0-1.0, potential research impact>,
  "topic_tags": [<list of 3-5 specific AI topics from the paper>],
  "summary": "<2-sentence plain English summary>",
  "hook": "<short punchy headline, max 70 chars, like a viral tweet — pick ONE of: key finding, specific number/stat, tech/model name, or author/institution — e.g. 'GPT-4 level reasoning at 1% the cost' or 'Meta's new model writes code faster than humans' — NO 'This paper' or academic phrasing>",
  "is_ai_relevant": <true/false>
}}"""

        try:
            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(
                    f"{self.base_url}/chat/completions",
                    headers={
                        "Authorization": f"Bearer {self._api_key}",
                        "Content-Type": "application/json",
                        "HTTP-Referer": "https://ai-research-intelligence.com",
                    },
                    json={
                        "model": self.model,
                        "messages": [{"role": "user", "content": prompt}],
                        "max_tokens": 500,
                        "temperature": 0.1,
                    }
                )

                if resp.status_code != 200:
                    logger.warning(f"OpenRouter API error: {resp.status_code}")
                    return self._tfidf_fallback(title, abstract, keywords)

                content = resp.json()["choices"][0]["message"]["content"].strip()

                # Clean up response - remove markdown if present
                content = re.sub(r'```json\s*', '', content)
                content = re.sub(r'```\s*', '', content)
                content = content.strip()

                result = json.loads(content)
                return {
                    "ai_relevance_score": float(result.get("relevance_score", 0.5)),
                    "ai_impact_score": float(result.get("impact_score", 0.5)),
                    "ai_topic_tags": result.get("topic_tags", [])[:5],
                    "ai_summary": result.get("summary", ""),
                    "hook": result.get("hook", ""),
                    "is_ai_relevant": result.get("is_ai_relevant", True)
                }

        except Exception as e:
            logger.warning(f"AI validation error: {e}")
            return self._tfidf_fallback(title, abstract, keywords)

    async def generate_hook_only(self, title: str, abstract: str) -> str:
        """Generate just a punchy hook/headline for a paper. Cheaper than full validation."""
        if not self._api_key:
            return self._make_fallback_hook(title, abstract)

        prompt = f"""Write a SHORT punchy headline for this AI/ML research paper. Like a viral tweet — 5 to 10 words max.

Title: {title[:250]}
Abstract: {abstract[:500]}

Rules:
- 5–10 words only, strict
- Pick ONE angle: a specific number/stat, the tech/model name, the key finding, or a famous lab/author
- Sound exciting, not academic
- No "This paper", no "Researchers found", no full sentences with "that"
- Good examples:
  "GPT-4 level reasoning at 1% the cost"
  "Meta's model now writes code faster than humans"
  "Stanford's trick: make any LLM forget on command"
  "LoRA fine-tuning just got 10x faster"
  "Mamba beats Transformers on long sequences"
  "MIT solves LLM hallucination with one weird trick"

Respond with ONLY the headline, nothing else. No quotes."""

        try:
            async with httpx.AsyncClient(timeout=20) as client:
                resp = await client.post(
                    f"{self.base_url}/chat/completions",
                    headers={
                        "Authorization": f"Bearer {self._api_key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": self.model,
                        "messages": [{"role": "user", "content": prompt}],
                        "max_tokens": 60,
                        "temperature": 0.8,
                    }
                )
                if resp.status_code == 200:
                    content = resp.json()["choices"][0]["message"]["content"].strip()
                    content = content.strip('"\'').strip()
                    if content:
                        return content[:100]
        except Exception as e:
            logger.warning(f"Hook generation error: {e}")

        return self._make_fallback_hook(title, abstract)

    # Per-section psychological directives and tone instructions
    _SECTION_DIRECTIVES = {
        "Hero Hook": {
            "psychology": "Authority Bias — if the best in the world are working on it, you must pay attention.",
            "directive": (
                "Adopt the tone of an industry insider. Emphasize the author's elite track record, "
                "institutional backing, and the inevitability of this research becoming the new standard. "
                "Frame it as a must-read mandate. Reference their h-index, lab, or past breakthroughs if available. "
                "Use phrases like 'the industry pays attention', 'blueprint for', 'dictates what gets built next'."
            ),
            "examples": [
                "When the team behind LLaMA publishes on quantization, the hardware industry pays attention — their new memory architecture effectively obsoletes current scaling laws",
                "The foundational architects of the Transformer are back — this 40-page masterclass isn't just a paper, it's the blueprint for next-generation models",
                "Yoshua Bengio's lab just dropped a quiet pre-print on causal representation — these exact papers dictate what startups will be building 12 months from now",
            ],
        },
        "Hype Carousel": {
            "psychology": "FOMO / Bandwagon — fear of falling behind peers who are already adopting this.",
            "directive": (
                "Write with urgent, fast-paced energy. Focus entirely on adoption velocity, "
                "community consensus, and rapid movement. Use words like 'pivoting', 'dominating', "
                "'accelerating', 'window is closing'. Make the reader feel they are already late."
            ),
            "examples": [
                "With 2,000 upvotes in under 24 hours, this fine-tuning technique is becoming the new open-source standard",
                "The open-source community has reached consensus — this routing architecture is dominating today",
                "If you are renting A100s this week without reading this inference breakthrough, you are burning cash",
            ],
        },
        "Intelligence Grid": {
            "psychology": "Pattern Recognition — overwhelmed readers want the big picture of a micro-trend.",
            "directive": (
                "Act as a strategic synthesizer. Connect the papers to a broader macro-trend. "
                "Frame each as a critical puzzle piece in an accelerating shift. Use phrases like "
                "'missing link', 'violent shift', 'transitions from X to Y', 'has been blocking for months'."
            ),
            "examples": [
                "Agentic routing is rapidly moving from theoretical to applied — this is the missing link",
                "The industry focus has violently shifted to edge deployment — this solves the bottleneck",
                "The week's papers tell one story: context windows are being fundamentally reinvented",
            ],
        },
        "Under the Radar": {
            "psychology": "Alpha Discovery — intellectual prestige of finding the diamond before the major labs do.",
            "directive": (
                "Write like a scout finding hidden talent. Emphasize the asymmetry: unknown author or "
                "institution, no PR machine, no massive compute — but mathematically elegant results that "
                "outperform well-funded labs. Make the reader feel like an insider."
            ),
            "examples": [
                "No major lab backing, no massive compute — just an elegant solution outperforming models ten times its size",
                "Pure signal, zero noise — a brilliant independent researcher solves what OpenAI has been struggling with",
                "Published with zero fanfare, this bypasses traditional tokenization with a 40% efficiency boost the major labs missed",
            ],
        },
        "Velocity Desk": {
            "psychology": "The Awakening — curiosity driven by sudden anomalies. Why is everyone looking at this now?",
            "directive": (
                "Act as a market anomaly detector. Highlight the sudden explosive spike after a quiet period. "
                "Frame it as the industry having a collective 'sudden realization'. Use language like "
                "'sat quietly for months', 'massive surge', 'the rush to production has started', '400% spike'."
            ),
            "examples": [
                "This sat quietly for three months until a 400% citation spike yesterday — the industry just realized its importance",
                "A massive surge in GitHub activity in the last 12 hours — the rush to production has officially started",
                "Something changed this week — the community suddenly woke up to this architecture's potential",
            ],
        },
        "Theory Corner": {
            "psychology": "First Principles — to build the future you must understand the deep math underlying the code.",
            "directive": (
                "Write with austere academic reverence. Focus on mathematical bounds, foundational truths, "
                "and the pure physics of computation. Use phrases like 'before we write the code', "
                "'rigorous proof', 'upper bound', 'bedrock', 'dictates what gets built next'. No hype."
            ),
            "examples": [
                "Before we write the code, we must rewrite the math — a new theoretical upper bound for transformer efficiency",
                "No code attached, just rigorous scaling laws that will dictate compute budgets for the next generation",
                "The foundational math this week reshapes the physics of training at scale",
            ],
        },
        "Contrarian View": {
            "psychology": "Cognitive Threat — creating dissonance. If you rely on the standard stack, this threatens it.",
            "directive": (
                "Adopt a provocative, highly critical tone. Frame findings as a direct threat to established "
                "scaling dogmas or popular architectures. Use language like 'fundamentally flawed', "
                "'brutal takedown', 'dead end', 'everyone is getting this wrong', 'stop investing in X'."
            ),
            "examples": [
                "Scaling laws are hitting a wall — a brutal takedown of the compute-is-all-you-need paradigm",
                "The industry consensus on transformer memory is fundamentally flawed — this proves it",
                "Stop investing in MoE — this exposes structural routing flaws proving dense models are still under-optimized",
            ],
        },
    }

    async def generate_hero_author_hook(
        self,
        author_name: str,
        h_index: float,
        title: str,
        abstract: str,
        hf_upvotes: int = 0,
        hn_points: int = 0,
        citation_count: int = 0,
    ) -> str:
        """
        Generate a 1–2 sentence author-centric bio hook for the Hero section.
        Emphasises the researcher's track record, community proof (HF/HN), and
        why this specific paper demands attention right now.
        Falls back to empty string so the frontend uses getSpotlight() static copy.
        """
        if not self._api_key:
            return ""

        # Build social proof context for the prompt
        social_lines = []
        if hf_upvotes > 0:
            social_lines.append(f"{hf_upvotes} upvotes on HuggingFace Papers")
        if hn_points > 0:
            social_lines.append(f"{hn_points} points on Hacker News")
        if citation_count > 0:
            social_lines.append(f"{citation_count} citations")
        social_proof = " · ".join(social_lines) if social_lines else "emerging community interest"

        h_context = ""
        if h_index >= 70:
            h_context = f"h-index {int(h_index)} — one of the most cited researchers in the world"
        elif h_index >= 40:
            h_context = f"h-index {int(h_index)} — a top-tier authority in AI research"
        elif h_index >= 20:
            h_context = f"h-index {int(h_index)} — a rising influential voice in the field"
        elif h_index > 0:
            h_context = f"h-index {int(h_index)}"

        # Author credibility tier — used inside the prompt
        if h_index >= 70:
            author_tier = f"one of the most cited AI researchers alive (h-index {int(h_index)})"
            urgency     = "When researchers at this level publish, the entire field adjusts."
        elif h_index >= 40:
            author_tier = f"a top-tier authority in AI/ML (h-index {int(h_index)})"
            urgency     = "Their track record means this pre-print will shape lab roadmaps before the ink dries."
        elif h_index >= 20:
            author_tier = f"a respected voice in the research community (h-index {int(h_index)})"
            urgency     = "A researcher with real standing just made a bold move — the community is already reacting."
        elif h_index > 0:
            author_tier = f"an emerging researcher (h-index {int(h_index)})"
            urgency     = "Their results are turning heads despite coming from outside the big labs."
        else:
            author_tier = "a researcher the community is paying attention to right now"
            urgency     = "The work is speaking louder than the name — community reaction says it all."

        prompt = f"""You are a sharp AI research editor writing the FEATURED PAPER spotlight for today's dashboard.

Your job: write exactly 2 punchy sentences that make a senior ML practitioner stop scrolling and read this paper NOW.

━━━ PAPER DATA ━━━
Author:           {author_name or "Unknown"}
Author standing:  {author_tier}
Why urgency:      {urgency}
Paper title:      {title[:220]}
Key finding:      {abstract[:450]}
Community proof:  {social_proof}

━━━ YOUR VOICE ━━━
You are an insider — a well-connected researcher who reads every important pre-print.
You are NOT a journalist. You are NOT a PR writer.
You speak in sharp, confident half-sentences. You name-drop. You imply stakes.

━━━ SENTENCE 1 — THE AUTHOR FRAME ━━━
Open with the author by name. State their credibility in one brutal fact (h-index, lab, past breakthrough).
Then pivot immediately to what they just did.

━━━ SENTENCE 2 — THE STAKES ━━━
Name the specific finding or technique from the abstract. End with what this BREAKS or ENABLES in the field.
Weave in the community signal ({social_proof}) if it strengthens the point.

━━━ STRICT RULES ━━━
- Exactly 2 sentences. Hard limit.
- 35–55 words total across both sentences.
- Never start with "This paper", "The paper", "Researchers", or "A new study".
- No hedging — no "might", "could", "may suggest".
- No em-dash overuse — max one per sentence.
- Mention the author name in sentence 1.
- The second sentence must contain a specific technical term from the abstract.

━━━ STRONG EXAMPLES (match this energy) ━━━
"Andrej Karpathy hasn't published in two years — this pre-print on tokenizer-free LLMs just broke that silence with 1,200 HuggingFace upvotes in 48 hours. The architecture bypasses BPE entirely, cutting inference latency by 34% — and it runs on consumer GPUs."

"Yann LeCun, h-index 130, just quietly dropped a 12-page proof that transformer attention is provably inefficient beyond 8k context. With 890 Hacker News points and counting, this isn't a fringe take — it's the theoretical foundation the next architecture cycle will be built on."

"Jeff Dean's team published on sparse mixture-of-experts routing at 3 AM — 600 upvotes before the US woke up. The new gating mechanism cuts active parameter count by 60% without touching accuracy, which effectively makes frontier-scale inference 4x cheaper overnight."

━━━━━━━━━━━━━━━━━━
Respond with ONLY the 2 sentences. No labels, no quotes, no explanation."""

        try:
            async with httpx.AsyncClient(timeout=20) as client:
                resp = await client.post(
                    f"{self.base_url}/chat/completions",
                    headers={
                        "Authorization": f"Bearer {self._api_key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": self.model,
                        "messages": [{"role": "user", "content": prompt}],
                        "max_tokens": 160,
                        "temperature": 0.80,
                    }
                )
                if resp.status_code == 200:
                    text = resp.json()["choices"][0]["message"]["content"].strip().strip('"\'')
                    if text and len(text) > 20:
                        return text[:400]
        except Exception as e:
            logger.warning(f"Hero author hook generation error: {e}")

        return ""

    async def generate_section_hook(self, section: str, papers: list) -> str:
        """
        Generate a punchy section subheading using psychological copywriting directives.
        Called once per dashboard cache fill (date-keyed → once per day).
        Returns "" on failure so the frontend falls back to its hardcoded rotation.
        """
        if not self._api_key or not papers:
            return ""

        lines = [p.get("hook_text") or p.get("title") or "" for p in papers[:4] if p]
        lines = [t[:150].strip() for t in lines if t.strip()]
        if not lines:
            return ""

        directive_block = self._SECTION_DIRECTIVES.get(section)
        if not directive_block:
            return ""

        bullet_list = "\n".join(f"- {t}" for t in lines)
        examples = "\n".join(f'  "{e}"' for e in directive_block["examples"])

        prompt = f"""You are writing a ONE-LINE subheading for the "{section}" section of an AI research intelligence dashboard.

PSYCHOLOGICAL GOAL: {directive_block["psychology"]}

YOUR TONE DIRECTIVE: {directive_block["directive"]}

EXAMPLE OUTPUTS (match this energy exactly):
{examples}

THE ACTUAL PAPERS SHOWN IN THIS SECTION RIGHT NOW:
{bullet_list}

RULES:
- Write exactly ONE subheading, 10–18 words
- Draw from the actual papers above — name specific techniques, numbers, or findings if present
- Follow the tone directive precisely
- No generic filler — every word must earn its place
- No quotes, no punctuation at the end

Respond with ONLY the subheading."""

        try:
            async with httpx.AsyncClient(timeout=15) as client:
                resp = await client.post(
                    f"{self.base_url}/chat/completions",
                    headers={
                        "Authorization": f"Bearer {self._api_key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": self.model,
                        "messages": [{"role": "user", "content": prompt}],
                        "max_tokens": 80,
                        "temperature": 0.8,
                    }
                )
                if resp.status_code == 200:
                    text = resp.json()["choices"][0]["message"]["content"].strip()
                    text = text.strip('"\'').rstrip('.').strip()
                    if text and len(text) < 200:
                        return text
        except Exception as e:
            logger.warning(f"Section hook generation failed for '{section}': {e}")

        return ""

    # ── Public Landing Page Methods ────────────────────────────────────────────

    # Maps arXiv category prefixes → human topic
    _TOPIC_MAP = {
        "cs.CL": "Language",  "cs.AI": "Language",
        "cs.CV": "Vision",
        "cs.RO": "Robots",
        "q-bio": "Health",    "eess.SP": "Health",
        "cs.CR": "Safety",    "cs.LG": "Language",
        "physics": "Science", "astro-ph": "Science",
        "math": "Science",    "cond-mat": "Science",
        "cs.AR": "Efficiency","cs.PF": "Efficiency",
        "econ": "Business",   "cs.IR": "Business",
        "cs.SY": "Robots",
    }
    _TOPIC_LABELS = [
        "Language", "Vision", "Robots", "Health",
        "Safety", "Science", "Efficiency", "Business", "Climate", "General"
    ]

    async def generate_topic_group_hook(
        self,
        topic_label: str,
        topic_tagline: str,
        paper_hooks: list,
    ) -> str:
        """
        Generate a compelling journalist-style narrative hook for an entire topic GROUP.
        This is shown on the landing page to represent the whole topic — not any single paper.
        Reads like an opening paragraph from a great magazine article.
        Falls back to static hook if AI unavailable.
        """
        if not self._api_key or not paper_hooks:
            return ""

        sample = "\n".join(f"- {h}" for h in paper_hooks[:5] if h)

        prompt = f"""You are a senior journalist at a magazine like The Atlantic or Wired, writing a
single-sentence OPENING HOOK that draws curious non-technical readers into a story about AI research.

The story is about this topic area: {topic_label}
({topic_tagline})

Here are some of the actual research papers in this area this week:
{sample}

Your job: write ONE sentence (25–40 words) that:
- Feels like the opening of an investigative magazine article
- Makes a curious non-technical adult HAVE to keep reading
- Does NOT mention any specific paper, author, or technical term
- Captures the BIGGER HUMAN STORY behind this research area
- Has a sense of scale, consequence, or mystery
- Uses plain language — no jargon, no acronyms

Strong examples of the style:
"Hidden inside thousands of research papers lies a simple question that has stumped scientists for fifty years — and AI is now giving us the clearest answer we have ever had."
"The same AI powering your phone's autocorrect is being quietly trained on millions of patient records, and it just found drug combinations that doctors missed for decades."
"The people building the most powerful AI systems in human history are also the ones most publicly worried about what happens if they succeed."
"Right now, thousands of engineers are in a race to build a machine that reads, writes, and reasons better than any human — and the latest research shows they are dangerously close."

Write ONLY the one sentence hook. No quotes around it. No explanation."""

        try:
            async with httpx.AsyncClient(timeout=20) as client:
                resp = await client.post(
                    f"{self.base_url}/chat/completions",
                    headers={"Authorization": f"Bearer {self._api_key}", "Content-Type": "application/json"},
                    json={
                        "model": self.model,
                        "messages": [{"role": "user", "content": prompt}],
                        "max_tokens": 100,
                        "temperature": 0.85,
                    }
                )
                if resp.status_code == 200:
                    text = resp.json()["choices"][0]["message"]["content"].strip().strip('"\'').rstrip('.')
                    if text and len(text) > 40:
                        return text + "."
        except Exception as e:
            logger.warning(f"Topic group hook error ({topic_label}): {e}")

        return ""

    async def generate_journalist_paper_hook(
        self,
        title: str,
        abstract: str,
        ai_summary: str = "",
        topic_label: str = "",
    ) -> str:
        """
        Generate a journalist-style hook for a single paper — shown on the Topic page.
        Unlike hook_text (punchy 5-10 word headline), this is a full sentence that tells
        a non-technical reader WHY this specific paper matters, written like a journalist.
        Falls back to hook_text or title if AI unavailable.
        """
        if not self._api_key:
            return ""

        source = ai_summary or abstract or ""
        if not source:
            return ""

        prompt = f"""You are a journalist explaining a research paper to a curious adult who reads The Economist.
Write ONE sentence (20–35 words) that explains what this paper discovered and why a normal person should care.

Topic area: {topic_label}
Paper title: {title[:180]}
What the paper says: {source[:500]}

Rules:
- ONE sentence, 20–35 words
- No technical jargon or acronyms — if you must use one, explain it in plain words
- Start with what changed, what was found, or what is now possible — not "Researchers found"
- Make a normal person feel curious, not overwhelmed
- Do NOT start with "This paper", "Researchers", "Scientists", "A new study"
- Write as if you are telling a smart friend about something you just read

Good examples:
"For the first time, a machine can read your medical scan and spot early signs of cancer that a trained doctor would miss on the first pass."
"The software that translates between languages just got dramatically better at understanding sarcasm, jokes, and the kind of thing people mean but never actually say."
"A cheap, open-source model is now doing things that used to require a supercomputer — and anyone can download it for free."

Write ONLY the single sentence. No quotes. No labels."""

        try:
            async with httpx.AsyncClient(timeout=20) as client:
                resp = await client.post(
                    f"{self.base_url}/chat/completions",
                    headers={"Authorization": f"Bearer {self._api_key}", "Content-Type": "application/json"},
                    json={
                        "model": self.model,
                        "messages": [{"role": "user", "content": prompt}],
                        "max_tokens": 80,
                        "temperature": 0.75,
                    }
                )
                if resp.status_code == 200:
                    text = resp.json()["choices"][0]["message"]["content"].strip().strip('"\'')
                    if text and len(text) > 30:
                        return text if text.endswith('.') else text + '.'
        except Exception as e:
            logger.warning(f"Journalist paper hook error: {e}")

        return ""

    async def generate_report_hook(
        self,
        title: str,
        abstract: str,
        ai_summary: str = "",
        topic_label: str = "",
        hf_upvotes: int = 0,
        hn_points: int = 0,
        citation_count: int = 0,
        github_stars: int = 0,
        h_index: float = 0,
    ) -> str:
        """
        Generate a rich, journalist narrative for the /report/:id page headline.
        4-6 sentences in plain English — like a Wired or Atlantic feature opener.
        Never includes the paper title as a label. Never uses jargon.
        """
        if not self._api_key:
            return ""

        # Use whatever text is available — title alone is enough for a good hook
        source = ai_summary or abstract or title or ""
        if not source:
            return ""

        # Build social proof context
        signals = []
        if hf_upvotes > 0:
            signals.append(f"{hf_upvotes:,} AI engineers bookmarked it on HuggingFace")
        if hn_points > 0:
            signals.append(f"{hn_points} points on Hacker News")
        if citation_count > 0:
            signals.append(f"cited by {citation_count} other research papers")
        if github_stars > 0:
            signals.append(f"{github_stars:,} developers starred the code on GitHub")
        if h_index > 15:
            signals.append(f"lead author has an h-index of {int(h_index)} — among the most cited in the field")
        signal_str = ("; ".join(signals) + ".") if signals else ""

        prompt = f"""You are a senior features editor at Wired magazine. You are writing the opening of a feature article about an AI research discovery for a general audience — curious, intelligent adults who have no science background.

Topic area: {topic_label}
What the research says: {source[:800]}
{("Community proof: " + signal_str) if signal_str else ""}

Write 4 to 6 flowing sentences (150–250 words total) that:
1. Start immediately with the DISCOVERY or SHIFT — what changed, what is now possible, what we now know. Do not warm up with a background sentence.
2. Explain the real-world meaning: who does this affect and how does daily life or the world change because of this research?
3. Make the stakes feel real — what happens if this works at scale? What problem does it solve that normal people actually care about?
4. If there is community proof (engineers bookmarking it, developers starring code, other papers citing it), weave it in naturally in ONE sentence — not as a list.
5. End with why this particular moment matters — why now, not five years ago.

Absolute rules — breaking any of these means the response is rejected:
- DO NOT write the paper title anywhere. DO NOT start with the title, DO NOT include it mid-text.
- DO NOT begin with a label like "Hook:", "Title:", "Article:", "Report:", "Paper:" — jump straight into the narrative.
- DO NOT start with "Researchers", "Scientists", "A new study", "This paper", or "In this paper".
- NO bullet points, NO headers, NO markdown — flowing prose paragraphs only.
- NO technical jargon or acronyms without an immediate plain-English explanation in the same sentence.
- Write in second person or third person — make the reader feel personally affected.
- Each sentence must be understandable to someone who has never read an academic paper.

Good opening examples (notice: no title, no labels, immediate discovery):
"For the first time, a computer program can look at a medical scan and catch the early signs of a disease that trained doctors routinely miss — not because doctors are careless, but because the pattern is genuinely too subtle for the human eye."
"The moment that AI researchers have been quietly dreading arrived this month: a language model that can explain its own reasoning step by step, in plain English, and be right more than nine times out of ten."

Write ONLY the narrative sentences. No title. No labels. No quotes around the text."""

        try:
            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(
                    f"{self.base_url}/chat/completions",
                    headers={"Authorization": f"Bearer {self._api_key}", "Content-Type": "application/json"},
                    json={
                        "model": self.model,
                        "messages": [{"role": "user", "content": prompt}],
                        "max_tokens": 500,
                        "temperature": 0.72,
                    }
                )
                if resp.status_code == 200:
                    text = resp.json()["choices"][0]["message"]["content"].strip().strip('"\'')
                    # Strip any label prefix the model might sneak in
                    import re
                    text = re.sub(r'^(Hook|Title|Article|Report|Paper|Narrative|Opening)[:\-–]\s*', '', text, flags=re.IGNORECASE).strip()
                    # Strip lines that look like "Paper: ..." or "Title: ..." at start
                    text = re.sub(r'^\*?\*?[A-Za-z ]{1,12}:\*?\*?\s+(?=[A-Z])', '', text).strip()
                    if text and len(text) > 60:
                        return text if text.endswith('.') else text + '.'
        except Exception as e:
            logger.warning(f"Report hook generation error: {e}")

        return ""

    async def generate_topic_category(
        self, title: str, abstract: str, arxiv_categories: list
    ) -> str:
        """
        Map a paper to one of 10 human-readable topic buckets.
        Tries a fast heuristic first (arXiv prefix), falls back to AI classification.
        """
        # Fast heuristic: check arXiv category prefixes
        for cat in (arxiv_categories or []):
            for prefix, topic in self._TOPIC_MAP.items():
                if cat.startswith(prefix):
                    return topic

        # Keyword heuristics before hitting the API
        text = f"{title} {abstract}".lower()
        if any(w in text for w in ["climate", "carbon", "emission", "sustainability", "renewable"]):
            return "Climate"
        if any(w in text for w in ["drug", "clinical", "medical", "patient", "genomic", "protein", "disease"]):
            return "Health"
        if any(w in text for w in ["robot", "manipulation", "locomotion", "autonomous vehicle", "drone"]):
            return "Robots"
        if any(w in text for w in ["safety", "alignment", "hallucination", "bias", "fairness", "ethics"]):
            return "Safety"
        if any(w in text for w in ["quantization", "pruning", "distillation", "compression", "inference speed", "edge deploy"]):
            return "Efficiency"
        if any(w in text for w in ["finance", "stock", "market", "forecast", "recommendation", "e-commerce"]):
            return "Business"

        if not self._api_key:
            return "General"

        prompt = f"""Classify this AI research paper into exactly ONE of these topics:
Language, Vision, Robots, Health, Safety, Science, Efficiency, Business, Climate, General

Title: {title[:200]}
Abstract: {abstract[:400]}

Topic definitions:
- Language: NLP, LLMs, text generation, translation, chatbots, tokenization
- Vision: images, video, diffusion, object detection, segmentation, visual models
- Robots: robotics, manipulation, locomotion, autonomous systems, drones
- Health: medicine, drug discovery, genomics, clinical AI, protein folding
- Safety: alignment, AI safety, bias, fairness, interpretability, adversarial
- Science: physics, chemistry, climate, astronomy, materials science, math
- Efficiency: model compression, quantization, inference speed, edge AI, memory
- Business: finance, recommendation systems, forecasting, marketing AI
- Climate: climate change, carbon, energy, sustainability, weather
- General: anything that doesn't fit the above

Respond with ONLY the single topic word (e.g. "Language"). Nothing else."""

        try:
            async with httpx.AsyncClient(timeout=15) as client:
                resp = await client.post(
                    f"{self.base_url}/chat/completions",
                    headers={"Authorization": f"Bearer {self._api_key}", "Content-Type": "application/json"},
                    json={
                        "model": self.model,
                        "messages": [{"role": "user", "content": prompt}],
                        "max_tokens": 10,
                        "temperature": 0.0,
                    }
                )
                if resp.status_code == 200:
                    word = resp.json()["choices"][0]["message"]["content"].strip().strip('"\'').strip()
                    if word in self._TOPIC_LABELS:
                        return word
        except Exception as e:
            logger.warning(f"Topic category error: {e}")

        return "General"

    async def generate_lay_summary(
        self, title: str, abstract: str, ai_summary: str = ""
    ) -> str:
        """
        Generate a 3–4 sentence plain-English summary for non-technical readers.
        No jargon, no acronyms — written so any curious adult can understand.
        """
        if not self._api_key:
            # Simple fallback: return first 2 sentences of abstract
            sentences = (abstract or "").split(". ")
            return ". ".join(sentences[:2]).strip() + "." if sentences else ""

        source = ai_summary or abstract or title

        prompt = f"""You are explaining a research paper to a curious, intelligent adult who has no technical background — like a smart friend who reads The Atlantic, not Nature.

Paper title: {title[:220]}
Technical content: {source[:600]}

Write 3–4 SHORT sentences that explain:
1. What problem were they trying to solve? (Use an analogy if it helps)
2. What did they build or discover?
3. Why does this matter in the real world?

STRICT RULES:
- NO technical jargon, NO acronyms (spell out if needed)
- NO passive voice — say "researchers built" not "a system was developed"
- Use concrete analogies: "like a spell-checker for AI" not "a verification framework"
- Start with the problem or situation, not "Researchers at..."
- Each sentence max 25 words
- Make it feel like explaining to a friend, not writing a press release

Respond with ONLY the 3–4 sentences, no labels, no bullet points."""

        try:
            async with httpx.AsyncClient(timeout=20) as client:
                resp = await client.post(
                    f"{self.base_url}/chat/completions",
                    headers={"Authorization": f"Bearer {self._api_key}", "Content-Type": "application/json"},
                    json={
                        "model": self.model,
                        "messages": [{"role": "user", "content": prompt}],
                        "max_tokens": 200,
                        "temperature": 0.5,
                    }
                )
                if resp.status_code == 200:
                    text = resp.json()["choices"][0]["message"]["content"].strip()
                    if text and len(text) > 30:
                        return text[:600]
        except Exception as e:
            logger.warning(f"Lay summary error: {e}")

        sentences = (abstract or "").split(". ")
        return ". ".join(sentences[:2]).strip() + "." if sentences else ""

    async def generate_why_important(
        self,
        title: str,
        trend_label: str,
        hf_upvotes: int,
        hn_points: int,
        hn_comments: int,
        citation_count: int,
        github_stars: int,
        topic_category: str,
    ) -> str:
        """
        Generate a 1–2 sentence plain-English explanation of WHY this paper
        is featured — community proof + real-world significance.
        Written so a non-technical person understands why it's a big deal.
        """
        # Build community signal context
        signals = []
        if hf_upvotes > 0:
            signals.append(f"{hf_upvotes:,} AI practitioners bookmarked it on HuggingFace")
        if hn_points > 0:
            signals.append(f"{hn_points} points on Hacker News" + (f" with {hn_comments} comments" if hn_comments > 0 else ""))
        if github_stars > 0:
            signals.append(f"{github_stars:,} developers starred the code on GitHub")
        if citation_count > 0:
            signals.append(f"{citation_count} other research papers cite this work")

        trend_context = ""
        if trend_label:
            label_lower = trend_label.lower()
            if "trending" in label_lower or "🔥" in trend_label:
                trend_context = "It is currently the most-discussed AI paper online."
            elif "gem" in label_lower or "💎" in label_lower:
                trend_context = "It hasn't gone viral yet, but insiders are paying close attention."
            elif "rising" in label_lower or "📈" in label_lower:
                trend_context = "Its popularity is climbing fast — the community is waking up to it."
            elif "new" in label_lower or "✨" in label_lower:
                trend_context = "It was just published and is already attracting attention."

        signal_text = " and ".join(signals[:2]) if signals else "the research community is discussing it"

        if not self._api_key:
            base = f"This {topic_category.lower()} research is featured because {signal_text}."
            return f"{base} {trend_context}".strip()

        prompt = f"""Write 1–2 sentences explaining WHY this paper is being featured today, for a general audience.

Paper: {title[:200]}
Category: {topic_category}
Status: {trend_label or 'Featured'}
Community proof: {signal_text}
{f'Context: {trend_context}' if trend_context else ''}

RULES:
- Sound like a trusted friend explaining why this news matters
- Reference the actual community numbers if provided
- Explain WHY those numbers matter (e.g. "when thousands of engineers bookmark something, it usually means it's about to change how software gets built")
- No jargon, no hype words like "revolutionary" or "groundbreaking"
- 1–2 sentences max, each under 30 words
- Start with "This is featured because..." or a variation

Respond with ONLY the 1–2 sentences."""

        try:
            async with httpx.AsyncClient(timeout=15) as client:
                resp = await client.post(
                    f"{self.base_url}/chat/completions",
                    headers={"Authorization": f"Bearer {self._api_key}", "Content-Type": "application/json"},
                    json={
                        "model": self.model,
                        "messages": [{"role": "user", "content": prompt}],
                        "max_tokens": 100,
                        "temperature": 0.4,
                    }
                )
                if resp.status_code == 200:
                    text = resp.json()["choices"][0]["message"]["content"].strip()
                    if text and len(text) > 20:
                        return text[:300]
        except Exception as e:
            logger.warning(f"Why important error: {e}")

        base = f"This {topic_category.lower()} research is featured because {signal_text}."
        return f"{base} {trend_context}".strip()

    async def generate_key_findings(
        self, title: str, abstract: str, ai_summary: str = ""
    ) -> list:
        """
        Generate 3–4 plain-English bullet points — key findings non-technical readers can understand.
        Returns a list of strings.
        """
        if not self._api_key:
            return []

        source = ai_summary or abstract or ""
        if not source:
            return []

        prompt = f"""Extract 3–4 key findings from this research paper, written for a general audience.

Title: {title[:200]}
Content: {source[:600]}

Write 3–4 one-sentence findings. Each should:
- Start with a verb: "Achieves", "Reduces", "Proves", "Enables", "Outperforms", "Shows", "Cuts", "Builds"
- Include a specific number or comparison if the paper mentions one
- Be understandable without technical background
- Be under 20 words each

Examples of good findings:
- "Reduces the time to train an AI model from weeks to hours on a single laptop"
- "Outperforms Google's best model while using 10x less computing power"
- "Enables smartphones to run AI assistants without an internet connection"

Respond with ONLY a JSON array of strings: ["finding 1", "finding 2", "finding 3"]
No markdown, no extra text."""

        try:
            async with httpx.AsyncClient(timeout=20) as client:
                resp = await client.post(
                    f"{self.base_url}/chat/completions",
                    headers={"Authorization": f"Bearer {self._api_key}", "Content-Type": "application/json"},
                    json={
                        "model": self.model,
                        "messages": [{"role": "user", "content": prompt}],
                        "max_tokens": 250,
                        "temperature": 0.3,
                    }
                )
                if resp.status_code == 200:
                    raw = resp.json()["choices"][0]["message"]["content"].strip()
                    raw = re.sub(r'```json\s*', '', raw)
                    raw = re.sub(r'```\s*', '', raw).strip()
                    findings = json.loads(raw)
                    if isinstance(findings, list):
                        return [str(f)[:150] for f in findings[:4] if f]
        except Exception as e:
            logger.warning(f"Key findings error: {e}")

        return []

    def _make_fallback_hook(self, title: str, abstract: str) -> str:
        """Short fallback hook from title (truncated to feel punchy)."""
        # Trim title to ~70 chars at a word boundary
        t = title.strip()
        if len(t) <= 72:
            return t
        cut = t[:70].rsplit(' ', 1)[0]
        return cut + '…'

    def _tfidf_fallback(self, title: str, abstract: str, keywords: List[str]) -> Dict:
        """Fallback to TF-IDF when AI is unavailable."""
        all_kws = keywords if keywords else AI_KEYWORDS
        text = f"{title} {abstract}"

        kw_score = compute_tfidf_keyword_score(text, all_kws)

        # Short fallback hook: trimmed title
        hook = self._make_fallback_hook(title, abstract)

        # Extract topic tags from keywords found
        found_tags = []
        text_lower = text.lower()
        for kw in AI_KEYWORDS[:50]:
            if kw.lower() in text_lower and len(found_tags) < 5:
                found_tags.append(kw.replace(" ", "_").title())

        return {
            "ai_relevance_score": kw_score,
            "ai_impact_score": kw_score * 0.8,
            "ai_topic_tags": found_tags[:5],
            "ai_summary": abstract[:200] + "..." if abstract and len(abstract) > 200 else abstract or "",
            "hook": hook,
            "is_ai_relevant": kw_score > 0.1
        }
