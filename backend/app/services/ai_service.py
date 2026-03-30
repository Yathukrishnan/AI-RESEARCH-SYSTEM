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
