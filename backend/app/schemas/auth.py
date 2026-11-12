from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, EmailStr

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"

class TokenPayload(BaseModel):
    sub: Optional[str] = None
    role: Optional[str] = None

class UserRegister(BaseModel):
    email: EmailStr
    password: str
    full_name: Optional[str] = ""
    role: Optional[str] = "worker"  # 'worker', 'reviewer', 'admin'

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: str
    email: str
    full_name: str
    role: str
    account_status: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
