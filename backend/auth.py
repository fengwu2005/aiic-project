import sqlite3

from .http_utils import get_bearer_token
from .storage import create_token, db, now_ts, password_hash, verify_password


def require_user(handler):
    token = get_bearer_token(handler)
    if not token:
        return None
    current = now_ts()
    with db() as conn:
        row = conn.execute(
            """
            select users.id, users.username
            from auth_sessions
            join users on users.id = auth_sessions.user_id
            where auth_sessions.token = ? and auth_sessions.expires_at > ?
            """,
            (token, current),
        ).fetchone()
    return dict(row) if row else None


def register_user(username, password):
    current = now_ts()
    with db() as conn:
        cur = conn.execute(
            "insert into users(username, password_hash, created_at) values (?, ?, ?)",
            (username, password_hash(password), current),
        )
        user_id = cur.lastrowid
    token = create_token(user_id)
    return token, {"id": user_id, "username": username}


def login_user(username, password):
    with db() as conn:
        user = conn.execute("select * from users where username = ?", (username,)).fetchone()
    if not user or not verify_password(password, user["password_hash"]):
        return None
    token = create_token(user["id"])
    return token, {"id": user["id"], "username": user["username"]}


def logout_token(token):
    if token:
        with db() as conn:
            conn.execute("delete from auth_sessions where token = ?", (token,))


IntegrityError = sqlite3.IntegrityError
