import redis.asyncio as aioredis
import json
import logging
from typing import Optional, Any
from app.core.config import settings

logger = logging.getLogger(__name__)
_client: Optional[aioredis.Redis] = None

async def get_redis() -> Optional[aioredis.Redis]:
    global _client
    if _client is None:
        try:
            _client = aioredis.from_url(settings.REDIS_URL, encoding="utf-8", decode_responses=True, socket_connect_timeout=3)
            await _client.ping()
            logger.info("Redis connected")
        except Exception as e:
            logger.warning(f"Redis unavailable ({e}) – caching disabled")
            _client = None
    return _client

async def cache_get(key: str) -> Optional[Any]:
    try:
        r = await get_redis()
        if r:
            v = await r.get(key)
            return json.loads(v) if v else None
    except Exception: pass
    return None

async def cache_set(key: str, value: Any, ttl: int = 300):
    try:
        r = await get_redis()
        if r:
            await r.setex(key, ttl, json.dumps(value, default=str))
    except Exception: pass

async def cache_delete(key: str):
    try:
        r = await get_redis()
        if r: await r.delete(key)
    except Exception: pass

async def cache_invalidate_pattern(pattern: str):
    try:
        r = await get_redis()
        if r:
            keys = await r.keys(pattern)
            if keys: await r.delete(*keys)
    except Exception: pass
