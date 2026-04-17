"""
Authentication utilities for password hashing and JWT tokens.
"""
from datetime import datetime, timedelta
from typing import Optional, Dict
import jwt
from passlib.context import CryptContext
import os

# Password hashing - disable wrap bug check to avoid Python 3.13 issues
pwd_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto",
    bcrypt__default_rounds=12,
    bcrypt__default_ident="2b"
)

# JWT settings
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "your-secret-key-change-this-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 24 hours


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash."""
    # Truncate to 72 bytes (bcrypt limitation)
    password_bytes = plain_password.encode('utf-8')[:72]
    return pwd_context.verify(password_bytes, hashed_password)


def get_password_hash(password: str) -> str:
    """Hash a password. Truncates to 72 bytes due to bcrypt limitation."""
    # Truncate to 72 bytes (bcrypt limitation)
    password_bytes = password.encode('utf-8')[:72]
    return pwd_context.hash(password_bytes)


def create_access_token(data: Dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create a JWT access token."""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def decode_token(token: str) -> Optional[Dict]:
    """Decode and verify a JWT token."""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None
