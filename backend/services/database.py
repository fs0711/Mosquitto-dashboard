"""
Database models and setup using SQLite.
"""
import sqlite3
from pathlib import Path
from contextlib import contextmanager
from typing import Optional, List, Dict
import json
from datetime import datetime

DB_PATH = Path(__file__).parent / "dashboard.db"


@contextmanager
def get_db():
    """Context manager for database connections."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_database():
    """Initialize the database with required tables."""
    with get_db() as conn:
        cursor = conn.cursor()
        
        # Users table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                email TEXT,
                role TEXT DEFAULT 'viewer',
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                last_login TEXT,
                is_active INTEGER DEFAULT 1
            )
        """)
        
        # Create default admin user if no users exist
        cursor.execute("SELECT COUNT(*) FROM users")
        if cursor.fetchone()[0] == 0:
            from .auth import get_password_hash
            admin_hash = get_password_hash("Alchohol@123")
            cursor.execute(
                "INSERT INTO users (username, password_hash, email, role) VALUES (?, ?, ?, ?)",
                ("admin@mail.com", admin_hash, "admin@mail.com", "admin")
            )
        
        conn.commit()


class User:
    """User model for database operations."""
    
    @staticmethod
    def get_by_username(username: str) -> Optional[Dict]:
        """Get user by username."""
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM users WHERE username = ?", (username,))
            row = cursor.fetchone()
            return dict(row) if row else None
    
    @staticmethod
    def get_by_id(user_id: int) -> Optional[Dict]:
        """Get user by ID."""
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))
            row = cursor.fetchone()
            return dict(row) if row else None
    
    @staticmethod
    def get_all() -> List[Dict]:
        """Get all users."""
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT id, username, email, role, created_at, last_login, is_active FROM users")
            return [dict(row) for row in cursor.fetchall()]
    
    @staticmethod
    def create(username: str, password_hash: str, email: Optional[str] = None, role: str = "viewer") -> int:
        """Create a new user."""
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "INSERT INTO users (username, password_hash, email, role) VALUES (?, ?, ?, ?)",
                (username, password_hash, email, role)
            )
            return cursor.lastrowid
    
    @staticmethod
    def update(user_id: int, **kwargs) -> bool:
        """Update user fields."""
        allowed_fields = ["email", "role", "is_active", "password_hash"]
        updates = {k: v for k, v in kwargs.items() if k in allowed_fields}
        
        if not updates:
            return False
        
        set_clause = ", ".join([f"{k} = ?" for k in updates.keys()])
        values = list(updates.values()) + [user_id]
        
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(f"UPDATE users SET {set_clause} WHERE id = ?", values)
            return cursor.rowcount > 0
    
    @staticmethod
    def update_last_login(user_id: int):
        """Update user's last login timestamp."""
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "UPDATE users SET last_login = ? WHERE id = ?",
                (datetime.utcnow().isoformat(), user_id)
            )
    
    @staticmethod
    def delete(user_id: int) -> bool:
        """Delete a user."""
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM users WHERE id = ?", (user_id,))
            return cursor.rowcount > 0
