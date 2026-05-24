import base64
import hashlib
import hmac
import json
import secrets
import sqlite3
import time

from .config import DATA_DIR, DB_FILE, SESSION_TTL_SECONDS


def db():
    DATA_DIR.mkdir(exist_ok=True)
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    with db() as conn:
        conn.executescript(
            """
            create table if not exists users (
                id integer primary key autoincrement,
                username text not null unique,
                password_hash text not null,
                created_at integer not null
            );

            create table if not exists auth_sessions (
                token text primary key,
                user_id integer not null,
                created_at integer not null,
                expires_at integer not null,
                foreign key(user_id) references users(id)
            );

            create table if not exists interview_sessions (
                id integer primary key autoincrement,
                user_id integer not null,
                title text not null,
                status text not null,
                track text,
                intensity text,
                feedback_mode text,
                project_text text,
                jd_keywords text,
                focus_text text,
                facts_json text,
                scores_json text,
                risks_json text,
                report_json text,
                created_at integer not null,
                updated_at integer not null,
                ended_at integer,
                foreign key(user_id) references users(id)
            );

            create table if not exists interview_messages (
                id integer primary key autoincrement,
                session_id integer not null,
                user_id integer not null,
                round integer not null,
                role text not null,
                content text not null,
                meta_json text,
                created_at integer not null,
                foreign key(session_id) references interview_sessions(id),
                foreign key(user_id) references users(id)
            );

            create table if not exists ai_logs (
                id integer primary key autoincrement,
                user_id integer,
                session_id integer,
                task text not null,
                prompt_json text,
                result_json text,
                error text,
                created_at integer not null
            );
            """
        )


def now_ts():
    return int(time.time())


def password_hash(password, salt=None):
    salt = salt or secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 120_000)
    return f"pbkdf2_sha256${salt}${base64.b64encode(digest).decode('ascii')}"


def verify_password(password, encoded):
    try:
        algo, salt, _ = encoded.split("$", 2)
    except ValueError:
        return False
    if algo != "pbkdf2_sha256":
        return False
    return hmac.compare_digest(password_hash(password, salt), encoded)


def create_token(user_id):
    current = now_ts()
    token = secrets.token_urlsafe(32)
    with db() as conn:
        conn.execute(
            "insert into auth_sessions(token, user_id, created_at, expires_at) values (?, ?, ?, ?)",
            (token, user_id, current, current + SESSION_TTL_SECONDS),
        )
    return token


def safe_json(value):
    return json.dumps(value if value is not None else {}, ensure_ascii=False)


def parse_json(value, fallback):
    if not value:
        return fallback
    try:
        return json.loads(value)
    except json.JSONDecodeError:
        return fallback


def row_to_session(row, include_messages=False):
    data = {
        "id": row["id"],
        "title": row["title"],
        "status": row["status"],
        "track": row["track"],
        "intensity": row["intensity"],
        "feedbackMode": row["feedback_mode"],
        "projectText": row["project_text"],
        "jdKeywords": row["jd_keywords"],
        "focusText": row["focus_text"],
        "facts": parse_json(row["facts_json"], None),
        "scores": parse_json(row["scores_json"], {}),
        "risks": parse_json(row["risks_json"], []),
        "report": parse_json(row["report_json"], {}),
        "createdAt": row["created_at"],
        "updatedAt": row["updated_at"],
        "endedAt": row["ended_at"],
    }
    if include_messages:
        with db() as conn:
            messages = conn.execute(
                """
                select round, role, content, meta_json, created_at
                from interview_messages
                where session_id = ?
                order by id asc
                """,
                (row["id"],),
            ).fetchall()
        data["messages"] = [
            {
                "round": item["round"],
                "role": item["role"],
                "content": item["content"],
                "meta": parse_json(item["meta_json"], {}),
                "createdAt": item["created_at"],
            }
            for item in messages
        ]
    return data


def log_ai_call(user_id, session_id, task, prompt, result=None, error=None):
    with db() as conn:
        conn.execute(
            """
            insert into ai_logs(user_id, session_id, task, prompt_json, result_json, error, created_at)
            values (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                user_id,
                session_id if isinstance(session_id, int) else None,
                str(task or ""),
                safe_json(prompt) if prompt is not None else None,
                safe_json(result) if result is not None else None,
                error,
                now_ts(),
            ),
        )
