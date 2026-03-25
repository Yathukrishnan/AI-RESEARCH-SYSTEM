import json
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from app.core.turso import TursoClient, get_db
from app.core.security import verify_password, hash_password, create_access_token
from pydantic import BaseModel

router = APIRouter(prefix="/auth", tags=["auth"])

class LoginRequest(BaseModel):
    email: str
    password: str

class RegisterRequest(BaseModel):
    email: str
    username: str
    password: str

@router.post("/login")
async def login(req: LoginRequest, db: TursoClient = Depends(get_db)):
    user = await db.fetchone("SELECT * FROM users WHERE email = ?", [req.email])
    if not user or not verify_password(req.password, user["hashed_password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not user.get("is_active", 1):
        raise HTTPException(status_code=403, detail="Account disabled")
    await db.execute("UPDATE users SET last_login = ? WHERE id = ?", [datetime.utcnow().isoformat(), user["id"]])
    token = create_access_token({"sub": str(user["id"]), "role": user["role"], "email": user["email"]})
    return {"access_token": token, "token_type": "bearer", "role": user["role"]}

@router.post("/register")
async def register(req: RegisterRequest, db: TursoClient = Depends(get_db)):
    existing = await db.fetchone("SELECT id FROM users WHERE email = ?", [req.email])
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    await db.execute(
        "INSERT INTO users (email, username, hashed_password, role) VALUES (?, ?, ?, 'user')",
        [req.email, req.username, hash_password(req.password)]
    )
    user = await db.fetchone("SELECT * FROM users WHERE email = ?", [req.email])
    token = create_access_token({"sub": str(user["id"]), "role": "user", "email": req.email})
    return {"access_token": token, "token_type": "bearer", "role": "user"}
