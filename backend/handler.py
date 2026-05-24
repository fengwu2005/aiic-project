import json
import mimetypes
import urllib.error
from http.server import BaseHTTPRequestHandler

from .ai import call_dashscope
from .auth import IntegrityError, login_user, logout_token, register_user, require_user
from .config import DASHSCOPE_TEMPERATURE, WEB_ROOT
from .http_utils import get_bearer_token, json_response, read_json_body
from .prompts import SYSTEM_PROMPT, build_prompt
from .storage import db, log_ai_call, now_ts, row_to_session, safe_json


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        path = self.path.split("?", 1)[0]
        if path == "/api/me":
            return self.handle_me()
        if path == "/api/sessions":
            return self.handle_session_list()
        if path.startswith("/api/sessions/"):
            return self.handle_session_detail(path)
        return self.handle_static(path)

    def do_POST(self):
        path = self.path.split("?", 1)[0]
        if path == "/api/register":
            return self.handle_register()
        if path == "/api/login":
            return self.handle_login()
        if path == "/api/logout":
            logout_token(get_bearer_token(self))
            return json_response(self, 200, {"ok": True})
        if path == "/api/sessions":
            return self.handle_session_create()
        if path.startswith("/api/sessions/") and path.endswith("/message"):
            return self.handle_session_message(path)
        if path.startswith("/api/sessions/") and path.endswith("/state"):
            return self.handle_session_state(path)
        if path == "/api/ai":
            return self.handle_ai()
        self.send_error(404)

    def handle_me(self):
        user = require_user(self)
        if not user:
            return json_response(self, 401, {"ok": False, "error": "not authenticated"})
        return json_response(self, 200, {"ok": True, "user": user})

    def handle_session_list(self):
        user = require_user(self)
        if not user:
            return json_response(self, 401, {"ok": False, "error": "not authenticated"})
        with db() as conn:
            rows = conn.execute(
                """
                select *
                from interview_sessions
                where user_id = ?
                order by updated_at desc
                limit 30
                """,
                (user["id"],),
            ).fetchall()
        return json_response(self, 200, {"ok": True, "sessions": [row_to_session(row) for row in rows]})

    def handle_session_detail(self, path):
        user = require_user(self)
        if not user:
            return json_response(self, 401, {"ok": False, "error": "not authenticated"})
        try:
            session_id = int(path.rsplit("/", 1)[-1])
        except ValueError:
            return json_response(self, 400, {"ok": False, "error": "invalid session id"})
        with db() as conn:
            row = conn.execute(
                "select * from interview_sessions where id = ? and user_id = ?",
                (session_id, user["id"]),
            ).fetchone()
        if not row:
            return json_response(self, 404, {"ok": False, "error": "session not found"})
        return json_response(self, 200, {"ok": True, "session": row_to_session(row, include_messages=True)})

    def handle_static(self, path):
        if path == "/":
            path = "/index.html"
        target = (WEB_ROOT / path.lstrip("/")).resolve()
        if not str(target).startswith(str(WEB_ROOT)) or not target.exists() or target.is_dir():
            self.send_error(404)
            return
        content_type = mimetypes.guess_type(target.name)[0] or "application/octet-stream"
        data = target.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def handle_register(self):
        try:
            payload = read_json_body(self)
            username = str(payload.get("username", "")).strip()
            password = str(payload.get("password", ""))
            if len(username) < 3 or len(username) > 32:
                return json_response(self, 400, {"ok": False, "error": "用户名长度需要在 3-32 之间"})
            if len(password) < 6:
                return json_response(self, 400, {"ok": False, "error": "密码至少 6 位"})
            token, user = register_user(username, password)
            return json_response(self, 200, {"ok": True, "token": token, "user": user})
        except IntegrityError:
            return json_response(self, 409, {"ok": False, "error": "用户名已存在"})
        except Exception as exc:
            return json_response(self, 500, {"ok": False, "error": str(exc)})

    def handle_login(self):
        try:
            payload = read_json_body(self)
            auth = login_user(str(payload.get("username", "")).strip(), str(payload.get("password", "")))
            if not auth:
                return json_response(self, 401, {"ok": False, "error": "用户名或密码不正确"})
            token, user = auth
            return json_response(self, 200, {"ok": True, "token": token, "user": user})
        except Exception as exc:
            return json_response(self, 500, {"ok": False, "error": str(exc)})

    def handle_session_create(self):
        user = require_user(self)
        if not user:
            return json_response(self, 401, {"ok": False, "error": "not authenticated"})
        try:
            payload = read_json_body(self)
            current = now_ts()
            title = str(payload.get("title", "")).strip()[:80] or "新的项目拷问"
            with db() as conn:
                cur = conn.execute(
                    """
                    insert into interview_sessions(
                        user_id, title, status, track, intensity, feedback_mode,
                        project_text, jd_keywords, focus_text, facts_json, scores_json, risks_json,
                        report_json, created_at, updated_at
                    ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        user["id"],
                        title,
                        "active",
                        payload.get("track", ""),
                        payload.get("intensity", ""),
                        payload.get("feedbackMode", ""),
                        payload.get("projectText", ""),
                        payload.get("jdKeywords", ""),
                        payload.get("focusText", ""),
                        safe_json(payload.get("facts")),
                        safe_json(payload.get("scores")),
                        safe_json(payload.get("risks", [])),
                        safe_json({}),
                        current,
                        current,
                    ),
                )
                row = conn.execute("select * from interview_sessions where id = ?", (cur.lastrowid,)).fetchone()
            return json_response(self, 200, {"ok": True, "session": row_to_session(row)})
        except Exception as exc:
            return json_response(self, 500, {"ok": False, "error": str(exc)})

    def handle_session_message(self, path):
        user = require_user(self)
        if not user:
            return json_response(self, 401, {"ok": False, "error": "not authenticated"})
        try:
            session_id = int(path.split("/")[3])
            payload = read_json_body(self)
            with db() as conn:
                exists = conn.execute(
                    "select id from interview_sessions where id = ? and user_id = ?",
                    (session_id, user["id"]),
                ).fetchone()
                if not exists:
                    return json_response(self, 404, {"ok": False, "error": "session not found"})
                current = now_ts()
                conn.execute(
                    """
                    insert into interview_messages(session_id, user_id, round, role, content, meta_json, created_at)
                    values (?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        session_id,
                        user["id"],
                        int(payload.get("round", 0)),
                        str(payload.get("role", ""))[:20],
                        str(payload.get("content", "")),
                        safe_json(payload.get("meta")),
                        current,
                    ),
                )
                conn.execute("update interview_sessions set updated_at = ? where id = ?", (current, session_id))
            return json_response(self, 200, {"ok": True})
        except Exception as exc:
            return json_response(self, 500, {"ok": False, "error": str(exc)})

    def handle_session_state(self, path):
        user = require_user(self)
        if not user:
            return json_response(self, 401, {"ok": False, "error": "not authenticated"})
        try:
            session_id = int(path.split("/")[3])
            payload = read_json_body(self)
            current = now_ts()
            status = str(payload.get("status", "active"))[:20]
            ended_at = current if status in {"ended", "stopped"} else None
            with db() as conn:
                conn.execute(
                    """
                    update interview_sessions
                    set status = ?, facts_json = ?, scores_json = ?, risks_json = ?,
                        report_json = ?, updated_at = ?, ended_at = coalesce(?, ended_at)
                    where id = ? and user_id = ?
                    """,
                    (
                        status,
                        safe_json(payload.get("facts")),
                        safe_json(payload.get("scores")),
                        safe_json(payload.get("risks", [])),
                        safe_json(payload.get("report", {})),
                        current,
                        ended_at,
                        session_id,
                        user["id"],
                    ),
                )
            return json_response(self, 200, {"ok": True})
        except Exception as exc:
            return json_response(self, 500, {"ok": False, "error": str(exc)})

    def handle_ai(self):
        user = require_user(self)
        if not user:
            return json_response(self, 401, {"ok": False, "error": "not authenticated"})
        payload = None
        prompt = None
        session_id = None
        try:
            payload = read_json_body(self)
            prompt = build_prompt(payload)
            session_id = payload.get("context", {}).get("sessionId")
            result = call_dashscope(
                [
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": json.dumps(prompt, ensure_ascii=False)},
                ],
                temperature=DASHSCOPE_TEMPERATURE,
            )
            log_ai_call(user["id"], session_id, payload.get("task"), prompt, result=result)
            return json_response(self, 200, {"ok": True, "result": result})
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="replace")
            log_ai_call(user["id"], session_id, payload.get("task") if payload else "", prompt, error=detail)
            return json_response(self, exc.code, {"ok": False, "error": detail})
        except Exception as exc:
            log_ai_call(user["id"], session_id, payload.get("task") if payload else "", prompt, error=str(exc))
            return json_response(self, 500, {"ok": False, "error": str(exc)})

    def log_message(self, fmt, *args):
        message = fmt % args
        if "Bad request version" in message or "Bad request syntax" in message:
            print(f"[server] {self.address_string()} - ignored malformed HTTP request")
            return
        print(f"[server] {self.address_string()} - {message}")
