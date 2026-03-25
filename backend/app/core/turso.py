"""
Turso database client using the Turso HTTP API.
Handles libsql://, wss://, and https:// URL formats.
"""
import httpx
import asyncio
import logging
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)


def _to_turso_value(v: Any) -> Dict:
    if v is None:
        return {"type": "null", "value": None}
    if isinstance(v, bool):
        return {"type": "integer", "value": "1" if v else "0"}
    if isinstance(v, int):
        return {"type": "integer", "value": str(v)}
    if isinstance(v, float):
        # Turso Hrana protocol: float value must be a JSON number, not a string
        return {"type": "float", "value": v}
    return {"type": "text", "value": str(v)}


def _normalize_url(url: str) -> str:
    """Convert any Turso URL format to https://"""
    for prefix in ("libsql://", "wss://", "ws://"):
        if url.startswith(prefix):
            return "https://" + url[len(prefix):]
    return url  # already https://


def _parse_rows(result: Dict) -> List[Dict]:
    if not result:
        return []
    cols = [c["name"] for c in result.get("cols", [])]
    rows = result.get("rows", [])
    parsed = []
    for row in rows:
        row_dict = {}
        for i, col in enumerate(cols):
            cell = row[i] if i < len(row) else None
            if isinstance(cell, dict):
                val = cell.get("value")
                typ = cell.get("type", "text")
                if typ == "null" or val is None:
                    row_dict[col] = None
                elif typ == "integer":
                    try:
                        row_dict[col] = int(val)
                    except (ValueError, TypeError):
                        row_dict[col] = val
                elif typ == "float":
                    try:
                        row_dict[col] = float(val)
                    except (ValueError, TypeError):
                        row_dict[col] = val
                else:
                    row_dict[col] = val
            else:
                row_dict[col] = cell
        parsed.append(row_dict)
    return parsed


class TursoClient:
    def __init__(self):
        self._http_url = ""
        self._token = ""
        self._client: Optional[httpx.AsyncClient] = None

    def configure(self, database_url: str, auth_token: str):
        self._http_url = _normalize_url(database_url)
        self._token = auth_token
        self._client = httpx.AsyncClient(
            base_url=self._http_url,
            headers={
                "Authorization": f"Bearer {self._token}",
                "Content-Type": "application/json",
            },
            timeout=60.0,
        )
        logger.info(f"Turso configured → {self._http_url}")

    async def close(self):
        if self._client:
            await self._client.aclose()

    async def _pipeline(self, requests: List[Dict]) -> List[Dict]:
        if not self._client:
            raise RuntimeError("TursoClient not configured")
        try:
            resp = await self._client.post("/v2/pipeline", json={"requests": requests})
            resp.raise_for_status()
            return resp.json().get("results", [])
        except httpx.HTTPStatusError as e:
            logger.error(f"Turso HTTP {e.response.status_code}: {e.response.text[:200]}")
            raise
        except Exception as e:
            logger.error(f"Turso error: {e}")
            raise

    async def execute(self, sql: str, params: Optional[List] = None) -> Dict:
        stmt: Dict = {"sql": sql}
        if params:
            stmt["args"] = [_to_turso_value(p) for p in params]
        results = await self._pipeline([{"type": "execute", "stmt": stmt}])
        if results and results[0].get("type") == "ok":
            return results[0]["response"].get("result", {})
        elif results and results[0].get("type") == "error":
            err = results[0].get("error", {})
            raise Exception(f"Turso SQL error: {err.get('message', 'Unknown')}")
        return {}

    async def fetchall(self, sql: str, params: Optional[List] = None) -> List[Dict]:
        result = await self.execute(sql, params)
        return _parse_rows(result)

    async def fetchone(self, sql: str, params: Optional[List] = None) -> Optional[Dict]:
        rows = await self.fetchall(sql, params)
        return rows[0] if rows else None

    async def execute_many(self, statements: List[Tuple[str, List]]) -> None:
        requests = [{"type": "execute", "stmt": {"sql": "BEGIN"}}]
        for sql, params in statements:
            stmt: Dict = {"sql": sql}
            if params:
                stmt["args"] = [_to_turso_value(p) for p in params]
            requests.append({"type": "execute", "stmt": stmt})
        requests.append({"type": "execute", "stmt": {"sql": "COMMIT"}})
        results = await self._pipeline(requests)
        for r in results:
            if r.get("type") == "error":
                raise Exception(f"Batch error: {r.get('error', {}).get('message')}")

    async def table_exists(self, name: str) -> bool:
        row = await self.fetchone(
            "SELECT name FROM sqlite_master WHERE type='table' AND name=?", [name]
        )
        return row is not None

    async def column_exists(self, table: str, column: str) -> bool:
        rows = await self.fetchall(f"PRAGMA table_info({table})")
        return any(r.get("name") == column for r in rows)

    async def add_column_if_missing(self, table: str, column: str, col_type: str, default: str = "NULL"):
        if not await self.column_exists(table, column):
            try:
                await self.execute(f"ALTER TABLE {table} ADD COLUMN {column} {col_type} DEFAULT {default}")
                logger.info(f"  + Added column {table}.{column}")
            except Exception as e:
                logger.warning(f"  ! Could not add {table}.{column}: {e}")

    async def count(self, table: str, where: str = "", params: Optional[List] = None) -> int:
        sql = f"SELECT COUNT(*) as cnt FROM {table}"
        if where:
            sql += f" WHERE {where}"
        row = await self.fetchone(sql, params)
        return int(row["cnt"]) if row and row.get("cnt") is not None else 0

    async def get_tables(self) -> List[str]:
        rows = await self.fetchall("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
        return [r["name"] for r in rows]

    async def get_columns(self, table: str) -> List[str]:
        rows = await self.fetchall(f"PRAGMA table_info({table})")
        return [r["name"] for r in rows]


# Global singleton
db = TursoClient()


async def get_db() -> TursoClient:
    return db
