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
  "hook": "<1 punchy scroll-stopping sentence that makes a researcher want to read this — focus on the key finding or breakthrough, mention the technology or method used, reference notable institutions/authors if apparent from the title; write like a tech journalist, not an academic>",
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

        prompt = f"""Write ONE punchy, scroll-stopping sentence about this AI/ML research paper.

Title: {title[:300]}
Abstract: {abstract[:600]}

Rules:
- Write like a viral tech tweet or YouTube title, NOT like an academic
- Focus on the KEY finding, breakthrough, or surprising result
- Mention the technology/method used
- Make researchers want to click immediately
- Max 120 characters
- No quotes around the text
- NO "Researchers found that..." or "This paper presents..."
- Good examples:
  "New model beats GPT-4 on reasoning using 10x less compute"
  "MIT's trick makes LLMs forget specific knowledge on demand"
  "Tiny 7B model just matched Claude 3.5 on coding benchmarks"

Respond with ONLY the hook sentence, nothing else."""

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
                        "max_tokens": 150,
                        "temperature": 0.7,
                    }
                )
                if resp.status_code == 200:
                    content = resp.json()["choices"][0]["message"]["content"].strip()
                    content = content.strip('"\'').strip()
                    if content:
                        return content[:200]
        except Exception as e:
            logger.warning(f"Hook generation error: {e}")

        return self._make_fallback_hook(title, abstract)

    def _make_fallback_hook(self, title: str, abstract: str) -> str:
        """Extract first compelling sentence from abstract as fallback hook."""
        if abstract:
            sentences = [s.strip() for s in abstract.replace('\n', ' ').split('.') if len(s.strip()) > 40]
            if sentences:
                return sentences[0][:160]
        return title[:160]

    def _tfidf_fallback(self, title: str, abstract: str, keywords: List[str]) -> Dict:
        """Fallback to TF-IDF when AI is unavailable."""
        all_kws = keywords if keywords else AI_KEYWORDS
        text = f"{title} {abstract}"

        kw_score = compute_tfidf_keyword_score(text, all_kws)

        # Simple hook: first non-trivial sentence of abstract
        hook = ""
        if abstract:
            sentences = [s.strip() for s in abstract.replace('\n', ' ').split('.') if len(s.strip()) > 40]
            if sentences:
                hook = sentences[0][:160]
            else:
                hook = abstract[:160]

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
