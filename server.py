#!/usr/bin/env python3
"""Static server plus DashScope proxy for 项目拷问官.

Set DASHSCOPE_API_KEY before running. The browser never sees the key.
"""

import base64
import hashlib
import hmac
import json
import mimetypes
import os
import secrets
import sqlite3
import time
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


ROOT = Path(__file__).resolve().parent
WEB_ROOT = ROOT / "web"
SKILLS_ROOT = ROOT / "skills"
CONFIG_FILE = ROOT / "config.yaml"
DATA_DIR = ROOT / "data"
DB_FILE = DATA_DIR / "interrogator.sqlite3"


def parse_scalar(value):
    value = value.strip()
    if not value:
        return ""
    if (value.startswith('"') and value.endswith('"')) or (value.startswith("'") and value.endswith("'")):
        return value[1:-1]
    if value.lower() in {"true", "false"}:
        return value.lower() == "true"
    try:
        if "." in value:
            return float(value)
        return int(value)
    except ValueError:
        return value


def load_yaml_like(path):
    if not path.exists():
        return {}
    root = {}
    stack = [(-1, root)]
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.split("#", 1)[0].rstrip()
        if not line.strip():
            continue
        indent = len(line) - len(line.lstrip(" "))
        key, _, value = line.strip().partition(":")
        while stack and indent <= stack[-1][0]:
            stack.pop()
        parent = stack[-1][1]
        if value.strip():
            parent[key] = parse_scalar(value)
        else:
            parent[key] = {}
            stack.append((indent, parent[key]))
    return root


CONFIG = load_yaml_like(CONFIG_FILE)


def config_get(section, key, env_name, default):
    env_value = os.environ.get(env_name)
    if env_value not in {None, ""}:
        return env_value
    return CONFIG.get(section, {}).get(key, default)


HOST = str(config_get("server", "host", "HOST", "0.0.0.0"))
PORT = int(config_get("server", "port", "PORT", 8000))
MAX_SAFETY_ROUNDS = int(config_get("app", "max_safety_rounds", "MAX_SAFETY_ROUNDS", 10))
SESSION_TTL_SECONDS = int(config_get("app", "session_ttl_seconds", "SESSION_TTL_SECONDS", 86400 * 14))
DASHSCOPE_URL = str(
    config_get(
        "dashscope",
        "url",
        "DASHSCOPE_URL",
        "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
    )
)
DASHSCOPE_MODEL = str(config_get("dashscope", "model", "DASHSCOPE_MODEL", "qwen-plus"))
DASHSCOPE_TEMPERATURE = float(config_get("dashscope", "temperature", "DASHSCOPE_TEMPERATURE", 0.35))
DASHSCOPE_TIMEOUT = int(config_get("dashscope", "timeout_seconds", "DASHSCOPE_TIMEOUT", 45))


SYSTEM_PROMPT = """你是“项目拷问官”，一个面向技术岗项目深挖训练的面试官。
你的任务不是泛泛陪练，而是根据用户的简历项目找出最可能被技术面试官追问的漏洞。
必须保持通用技术岗视角，不要对准某个具体公司，不要提具体公司名。
重点考察：真实性、代码实现、方法选择、技术细节、指标评估、工程落地、失败案例、伪代码能力、AI/模型理解。
同时考察用户对行业、企业落地场景、技术发展脉络和趋势的理解。
提问要模仿真人技术面试官：自然、克制、逐步深入。每轮抓一个核心问题，可以有一句必要的上下文或追问铺垫，但不要把多个考点堆在一起。
真人技术面试官的关键特征：根据候选人刚刚说的话追证据；追问个人贡献边界；要求解释方法选择和替代方案；要求用指标、失败样本、伪代码、工程约束证明项目真实做过；在 10 轮内主动收束，不做无意义拉长。
反馈要短而尖：指出一个最关键问题，不要每轮重复套话。示例回答必须像候选人真的在面试中完整回答，不要写模板占位符。
你必须敢于否定和质疑：如果回答没答到问题、明显绕开问题、照抄示例、用术语堆砌但没有证据，要直接指出“这段不成立”“这没有回答问题”“我不接受这个假设”，但不要羞辱用户。
输出必须是严格 JSON，不要 Markdown，不要解释 JSON 外的内容。"""


INTERVIEWER_STYLES = {
    "professional": {
        "name": "专业型",
        "behavior": "追实现、证据、指标和取舍；语气克制但要求明确。",
        "language": "可以使用必要技术词，但每个问题都要可回答。",
    },
    "pressure": {
        "name": "压力型",
        "behavior": "敢于质疑真实性和方案漏洞；直接指出不合理假设。",
        "language": "语气更尖锐，但不做人身攻击。",
    },
    "friendly": {
        "name": "随和型",
        "behavior": "语气温和，先帮候选人澄清，再追关键证据。",
        "language": "少用压迫感表达，但仍然指出问题。",
    },
    "business": {
        "name": "业务落地型",
        "behavior": "追业务价值、用户场景、企业约束、成本和趋势。",
        "language": "少堆技术术语，多问真实落地和取舍。",
    },
    "fundamental": {
        "name": "基础盘型",
        "behavior": "少术语，追用户是否真的理解项目基本链路和自己的贡献。",
        "language": "用普通技术面试官能听懂的话问，不炫技。",
    },
    "mixed": {
        "name": "混合型",
        "behavior": "根据轮次和回答质量动态切换专业、压力、随和、业务落地视角。",
        "language": "自然变化，不要每轮都一个腔调。",
    },
}


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
        algo, salt, digest = encoded.split("$", 2)
    except ValueError:
        return False
    if algo != "pbkdf2_sha256":
        return False
    return hmac.compare_digest(password_hash(password, salt), encoded)


def read_json_body(handler):
    length = int(handler.headers.get("Content-Length", "0"))
    if length <= 0:
        return {}
    return json.loads(handler.rfile.read(length).decode("utf-8"))


def get_bearer_token(handler):
    header = handler.headers.get("Authorization", "")
    if header.startswith("Bearer "):
        return header[7:].strip()
    return ""


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


def load_skills():
    skills = {}
    for path in sorted(SKILLS_ROOT.rglob("*.json")):
        rel = str(path.relative_to(SKILLS_ROOT))
        skills[rel] = json.loads(path.read_text(encoding="utf-8"))
    return skills


def json_response(handler, status, payload):
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Content-Length", str(len(body)))
    handler.end_headers()
    handler.wfile.write(body)


def dashscope_body(messages, temperature=0.35, stream=False):
    body = {
        "model": DASHSCOPE_MODEL,
        "messages": messages,
        "temperature": temperature,
        "response_format": {"type": "json_object"},
    }
    if stream:
        body["stream"] = True
    return json.dumps(body, ensure_ascii=False).encode("utf-8")


def dashscope_request(body):
    api_key = str(config_get("dashscope", "api_key", "DASHSCOPE_API_KEY", "")).strip()
    if not api_key:
        raise RuntimeError("DASHSCOPE_API_KEY is not set")

    return urllib.request.Request(
        DASHSCOPE_URL,
        data=body,
        method="POST",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
    )


def call_dashscope(messages, temperature=0.35):
    request = dashscope_request(dashscope_body(messages, temperature=temperature, stream=False))
    with urllib.request.urlopen(request, timeout=DASHSCOPE_TIMEOUT) as response:
        data = json.loads(response.read().decode("utf-8"))

    content = data["choices"][0]["message"]["content"]
    return json.loads(content)


def extract_stream_delta(data):
    try:
        choice = data.get("choices", [{}])[0]
        delta = choice.get("delta") or {}
        if "content" in delta:
            return delta.get("content") or ""
        message = choice.get("message") or {}
        return message.get("content") or ""
    except (AttributeError, IndexError):
        return ""


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


def sse_send(handler, event, payload):
    data = json.dumps(payload, ensure_ascii=False)
    handler.wfile.write(f"event: {event}\n".encode("utf-8"))
    handler.wfile.write(f"data: {data}\n\n".encode("utf-8"))
    handler.wfile.flush()


def build_prompt(payload):
    task = payload.get("task")
    context = payload.get("context", {})
    skills = load_skills()
    style_key = str(context.get("interviewerStyle") or "mixed")
    interviewer_style = INTERVIEWER_STYLES.get(style_key, INTERVIEWER_STYLES["mixed"])

    if task == "questions":
        return {
            "instruction": "根据项目材料生成首轮追问和少量候选追问计划。问题要像真人技术面试官逐步深入地问：先用一个核心问题建立事实，再根据回答追证据。不要一次性列很多问题，不要题库腔。整场必须在 10 轮内结束。",
            "interviewer_style": interviewer_style,
            "interviewer_skills": skills,
            "time_limit_policy": {
                "45-75": "事实确认、角色边界、简单澄清",
                "90-120": "项目介绍、方法选择、行业趋势、失败反思",
                "150-180": "指标评估、系统链路、工程落地、复杂 trade-off",
                "180-240": "伪代码、架构推演、复杂故障定位"
            },
            "schema": {
                "first_question": {
                    "question": "第一个自然追问",
                    "time_limit_seconds": 90,
                    "axis": "主要考察轴"
                },
                "questions": [
                    {
                        "question": "后续可能追问",
                        "time_limit_seconds": 90,
                        "axis": "主要考察轴"
                    }
                ]
            },
            "context": context,
        }

    if task == "agent_step":
        return {
            "instruction": "你是面试 agent 的决策器。根据项目材料、事实卡、历史问答、当前回答和评分，决定下一步继续追问还是结束训练。必须在 10 轮内主动收束；第 7 轮后除非仍有关键证据缺口，否则倾向结束。问题要像真人面试官：紧贴候选人刚刚回答中的一个点追证据、追代码、追指标、追取舍或追落地。不要机械换题。无论前端选择实时反馈还是结束后反馈，你都必须为本轮生成结构化反馈。",
            "interviewer_style": interviewer_style,
            "human_interviewer_traits": [
                "先复述或点出候选人回答中的一个具体说法，再追一个核心问题。",
                "优先追证据，不泛泛问概念。",
                "会要求候选人解释为什么不用更简单方案、替代方案代价是什么。",
                "会追问失败样本、边界条件、工程约束和指标定义。",
                "当信息已经足够或继续追问收益不高，会自然结束。"
            ],
            "feedback_policy": [
                "实时反馈必须短而尖，避免每轮重复同一句泛化建议。",
                "必须判断回答是否真正回应了本轮问题；如果没对应，要直接说没有回答到点上。",
                "必须判断回答是否疑似复用了上一轮 sample_answer 或模型建议；如果疑似照抄，不能高分，下一问要追真实证据。",
                "question_analysis 用 1 句话说明本题真实考点。",
                "answer_analysis 用 1-2 句话点出本轮回答的具体优点和具体缺口。",
                "pain_point 只写一个最核心痛点。",
                "improvement 给一个下一轮能直接照做的改法。",
                "sample_answer 必须是一段完整面试回答，结合本项目材料和本轮问题，不要出现“某个模块/某个指标/……”这类模板占位。"
            ],
            "interviewer_skills": skills,
            "stress_design": {
                "goal": "营造真实技术面试的轻微紧张感，但不要攻击用户。",
                "methods": [
                    "用建议回答时长制造节奏感。",
                    "在压力面中可以轻度质疑方案证据，例如“我先质疑一下这里”。",
                    "问题仍然必须具体、专业、可回答。",
                    "不要使用羞辱、嘲讽或人格评价。"
                ]
            },
            "max_safety_rounds": MAX_SAFETY_ROUNDS,
            "schema": {
                "should_end": False,
                "end_reason": "如果结束，说明原因；否则为空",
                "next_probe": {
                    "question": "继续追问时的问题",
                    "time_limit_seconds": 120,
                    "axis": "主要考察轴",
                    "pressure_level": "normal/senior/pressure"
                },
                "diagnosis": ["本轮具体诊断"],
                "answer_relevance": {
                    "score": 0,
                    "verdict": "回答是否对应问题",
                    "missed_point": "如果不对应，具体漏掉了问题里的哪个点"
                },
                "feedback": {
                    "question_analysis": "分析这道问题到底在考什么",
                    "answer_analysis": "分析用户回答哪里好、哪里不够",
                    "pain_point": "指出本轮暴露的核心痛点",
                    "improvement": "给出具体改进方法",
                    "sample_answer": "给出一段更强的示例回答"
                },
                "scores": {
                    "authenticity": 0,
                    "depth": 0,
                    "metrics": 0,
                    "engineering": 0,
                    "industry": 0
                },
                "report_brief": {
                    "danger_points": ["如果结束，列出危险点"],
                    "practice_plan": ["如果结束，列出训练计划"]
                }
            },
            "context": context,
        }

    if task == "diagnosis":
        return {
            "instruction": "诊断用户这一轮回答。指出 3-5 个具体漏洞，并按 5 个维度给 0-10 分。",
            "interviewer_skills": skills,
            "scoring_rubric": {
                "authenticity": "是否证明自己亲手做过，有明确个人贡献和实现证据",
                "depth": "是否讲清技术选择、替代方案、取舍、边界和失败原因",
                "metrics": "是否讲清指标、采集方式、实验/线上评估和失败样本分析",
                "engineering": "是否讲清部署、性能、稳定性、异常、监控、成本和回退",
                "industry": "是否理解行业/企业场景、技术发展脉络、落地约束和趋势变化",
            },
            "schema": {
                "diagnosis": ["具体问题"],
                "scores": {
                    "authenticity": 0,
                    "depth": 0,
                    "metrics": 0,
                    "engineering": 0,
                    "industry": 0,
                },
                "next_probe": {
                    "question": "一个自然、单核心的下一轮追问问题",
                    "time_limit_seconds": 120,
                    "axis": "主要考察轴"
                },
            },
            "context": context,
        }

    if task == "report":
        return {
            "instruction": "基于整场问答生成抗拷问报告，突出最危险追问点和下一轮训练重点。报告要短而有重点，避免重复实时反馈。示例回答必须是真实可说出口的完整回答，不要模板。",
            "interviewer_style": interviewer_style,
            "interviewer_skills": skills,
            "schema": {
                "summary": "一句话总结",
                "danger_points": ["危险点"],
                "practice_plan": ["训练建议"],
                "stronger_pitch": "更强项目表达",
                "round_feedback": [
                    {
                        "round": 1,
                        "question_analysis": "问题分析",
                        "answer_analysis": "回答分析",
                        "pain_point": "痛点",
                        "improvement": "改进方法",
                        "sample_answer": "示例回答"
                    }
                ]
            },
            "context": context,
        }

    raise ValueError("unsupported task")


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        path = self.path.split("?", 1)[0]
        if path == "/api/me":
            user = require_user(self)
            if not user:
                json_response(self, 401, {"ok": False, "error": "not authenticated"})
                return
            json_response(self, 200, {"ok": True, "user": user})
            return

        if path == "/api/sessions":
            user = require_user(self)
            if not user:
                json_response(self, 401, {"ok": False, "error": "not authenticated"})
                return
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
            json_response(self, 200, {"ok": True, "sessions": [row_to_session(row) for row in rows]})
            return

        if path.startswith("/api/sessions/"):
            user = require_user(self)
            if not user:
                json_response(self, 401, {"ok": False, "error": "not authenticated"})
                return
            try:
                session_id = int(path.rsplit("/", 1)[-1])
            except ValueError:
                json_response(self, 400, {"ok": False, "error": "invalid session id"})
                return
            with db() as conn:
                row = conn.execute(
                    "select * from interview_sessions where id = ? and user_id = ?",
                    (session_id, user["id"]),
                ).fetchone()
            if not row:
                json_response(self, 404, {"ok": False, "error": "session not found"})
                return
            json_response(self, 200, {"ok": True, "session": row_to_session(row, include_messages=True)})
            return

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

    def do_POST(self):
        path = self.path.split("?", 1)[0]

        if path == "/api/register":
            try:
                payload = read_json_body(self)
                username = str(payload.get("username", "")).strip()
                password = str(payload.get("password", ""))
                if len(username) < 3 or len(username) > 32:
                    json_response(self, 400, {"ok": False, "error": "用户名长度需要在 3-32 之间"})
                    return
                if len(password) < 6:
                    json_response(self, 400, {"ok": False, "error": "密码至少 6 位"})
                    return
                current = now_ts()
                token = secrets.token_urlsafe(32)
                with db() as conn:
                    cur = conn.execute(
                        "insert into users(username, password_hash, created_at) values (?, ?, ?)",
                        (username, password_hash(password), current),
                    )
                    user_id = cur.lastrowid
                    conn.execute(
                        "insert into auth_sessions(token, user_id, created_at, expires_at) values (?, ?, ?, ?)",
                        (token, user_id, current, current + SESSION_TTL_SECONDS),
                    )
                json_response(self, 200, {"ok": True, "token": token, "user": {"id": user_id, "username": username}})
            except sqlite3.IntegrityError:
                json_response(self, 409, {"ok": False, "error": "用户名已存在"})
            except Exception as exc:
                json_response(self, 500, {"ok": False, "error": str(exc)})
            return

        if path == "/api/login":
            try:
                payload = read_json_body(self)
                username = str(payload.get("username", "")).strip()
                password = str(payload.get("password", ""))
                with db() as conn:
                    user = conn.execute("select * from users where username = ?", (username,)).fetchone()
                    if not user or not verify_password(password, user["password_hash"]):
                        json_response(self, 401, {"ok": False, "error": "用户名或密码不正确"})
                        return
                    current = now_ts()
                    token = secrets.token_urlsafe(32)
                    conn.execute(
                        "insert into auth_sessions(token, user_id, created_at, expires_at) values (?, ?, ?, ?)",
                        (token, user["id"], current, current + SESSION_TTL_SECONDS),
                    )
                json_response(self, 200, {"ok": True, "token": token, "user": {"id": user["id"], "username": user["username"]}})
            except Exception as exc:
                json_response(self, 500, {"ok": False, "error": str(exc)})
            return

        if path == "/api/logout":
            token = get_bearer_token(self)
            if token:
                with db() as conn:
                    conn.execute("delete from auth_sessions where token = ?", (token,))
            json_response(self, 200, {"ok": True})
            return

        if path == "/api/sessions":
            user = require_user(self)
            if not user:
                json_response(self, 401, {"ok": False, "error": "not authenticated"})
                return
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
                    session_id = cur.lastrowid
                    row = conn.execute("select * from interview_sessions where id = ?", (session_id,)).fetchone()
                json_response(self, 200, {"ok": True, "session": row_to_session(row)})
            except Exception as exc:
                json_response(self, 500, {"ok": False, "error": str(exc)})
            return

        if path.startswith("/api/sessions/") and path.endswith("/message"):
            user = require_user(self)
            if not user:
                json_response(self, 401, {"ok": False, "error": "not authenticated"})
                return
            try:
                session_id = int(path.split("/")[3])
                payload = read_json_body(self)
                with db() as conn:
                    exists = conn.execute(
                        "select id from interview_sessions where id = ? and user_id = ?",
                        (session_id, user["id"]),
                    ).fetchone()
                    if not exists:
                        json_response(self, 404, {"ok": False, "error": "session not found"})
                        return
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
                    conn.execute(
                        "update interview_sessions set updated_at = ? where id = ?",
                        (current, session_id),
                    )
                json_response(self, 200, {"ok": True})
            except Exception as exc:
                json_response(self, 500, {"ok": False, "error": str(exc)})
            return

        if path.startswith("/api/sessions/") and path.endswith("/state"):
            user = require_user(self)
            if not user:
                json_response(self, 401, {"ok": False, "error": "not authenticated"})
                return
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
                json_response(self, 200, {"ok": True})
            except Exception as exc:
                json_response(self, 500, {"ok": False, "error": str(exc)})
            return

        if path == "/api/ai/stream":
            self.handle_ai_stream()
            return

        if path != "/api/ai":
            self.send_error(404)
            return

        user = require_user(self)
        if not user:
            json_response(self, 401, {"ok": False, "error": "not authenticated"})
            return

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
            json_response(self, 200, {"ok": True, "result": result})
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="replace")
            log_ai_call(user["id"], None, payload.get("task") if "payload" in locals() else "", prompt if "prompt" in locals() else None, error=detail)
            json_response(self, exc.code, {"ok": False, "error": detail})
        except Exception as exc:
            log_ai_call(user["id"], None, payload.get("task") if "payload" in locals() else "", prompt if "prompt" in locals() else None, error=str(exc))
            json_response(self, 500, {"ok": False, "error": str(exc)})

    def handle_ai_stream(self):
        user = require_user(self)
        if not user:
            json_response(self, 401, {"ok": False, "error": "not authenticated"})
            return

        payload = None
        prompt = None
        session_id = None
        full_content = ""
        try:
            payload = read_json_body(self)
            prompt = build_prompt(payload)
            session_id = payload.get("context", {}).get("sessionId")
            messages = [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": json.dumps(prompt, ensure_ascii=False)},
            ]
            request = dashscope_request(dashscope_body(messages, temperature=DASHSCOPE_TEMPERATURE, stream=True))

            self.send_response(200)
            self.send_header("Content-Type", "text/event-stream; charset=utf-8")
            self.send_header("Cache-Control", "no-cache")
            self.send_header("Connection", "keep-alive")
            self.end_headers()
            sse_send(self, "meta", {"ok": True, "task": payload.get("task")})

            with urllib.request.urlopen(request, timeout=DASHSCOPE_TIMEOUT) as response:
                for raw in response:
                    line = raw.decode("utf-8", errors="replace").strip()
                    if not line:
                        continue
                    if line.startswith("data:"):
                        line = line[5:].strip()
                    if line == "[DONE]":
                        break
                    try:
                        chunk = json.loads(line)
                    except json.JSONDecodeError:
                        continue
                    delta = extract_stream_delta(chunk)
                    if delta:
                        full_content += delta
                        sse_send(self, "delta", {"text": delta})

            result = json.loads(full_content)
            log_ai_call(user["id"], session_id, payload.get("task"), prompt, result=result)
            sse_send(self, "result", {"ok": True, "result": result})
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="replace")
            log_ai_call(user["id"], session_id, payload.get("task") if payload else "", prompt, error=detail)
            try:
                sse_send(self, "error", {"ok": False, "error": detail})
            except Exception:
                json_response(self, exc.code, {"ok": False, "error": detail})
        except Exception as exc:
            log_ai_call(user["id"], session_id, payload.get("task") if payload else "", prompt, error=str(exc))
            try:
                sse_send(self, "error", {"ok": False, "error": str(exc)})
            except Exception:
                json_response(self, 500, {"ok": False, "error": str(exc)})

    def log_message(self, fmt, *args):
        print(f"[server] {self.address_string()} - {fmt % args}")


if __name__ == "__main__":
    init_db()
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    print(f"项目拷问官 running at http://{HOST}:{PORT}")
    print(f"DashScope model: {DASHSCOPE_MODEL}")
    server.serve_forever()
