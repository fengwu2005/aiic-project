#!/usr/bin/env python3
"""Static server plus DashScope proxy for 项目拷问官.

Set DASHSCOPE_API_KEY before running. The browser never sees the key.
"""

import json
import mimetypes
import os
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


ROOT = Path(__file__).resolve().parent
WEB_ROOT = ROOT / "web"
SKILLS_ROOT = ROOT / "skills"
CONFIG_FILE = ROOT / "config.yaml"


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
提问要模仿真人技术面试官：自然、克制、逐步深入。每轮只问一个核心问题，不要在一句话里连续抛出多个问题。
输出必须是严格 JSON，不要 Markdown，不要解释 JSON 外的内容。"""


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


def call_dashscope(messages, temperature=0.35):
    api_key = str(config_get("dashscope", "api_key", "DASHSCOPE_API_KEY", "")).strip()
    if not api_key:
        raise RuntimeError("DASHSCOPE_API_KEY is not set")

    body = json.dumps(
        {
            "model": DASHSCOPE_MODEL,
            "messages": messages,
            "temperature": temperature,
            "response_format": {"type": "json_object"},
        },
        ensure_ascii=False,
    ).encode("utf-8")

    request = urllib.request.Request(
        DASHSCOPE_URL,
        data=body,
        method="POST",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
    )

    with urllib.request.urlopen(request, timeout=DASHSCOPE_TIMEOUT) as response:
        data = json.loads(response.read().decode("utf-8"))

    content = data["choices"][0]["message"]["content"]
    return json.loads(content)


def build_prompt(payload):
    task = payload.get("task")
    context = payload.get("context", {})
    skills = load_skills()

    if task == "questions":
        return {
            "instruction": "根据项目材料生成首轮追问和可选追问计划。问题要像真人技术面试官逐步深入地问：每轮有核心点，语气自然，不要一口气列多个问题。每个问题必须根据复杂度设置建议回答时长。",
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
            "instruction": "你是面试 agent 的决策器。根据项目材料、事实卡、历史问答、当前回答和评分，决定下一步继续追问还是结束训练。不要固定轮数，像真人面试官一样逐步深入。如果继续，返回一个自然、有核心点的问题和建议答题时长；如果结束，说明结束原因并给报告要点。无论前端选择实时反馈还是结束后反馈，你都必须为本轮生成结构化反馈。",
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
            "instruction": "基于整场问答生成抗拷问报告，突出最危险追问点和下一轮训练重点。报告需要覆盖：问题分析、用户回答分析、痛点、如何改进、示例回答。",
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
        if self.path != "/api/ai":
            self.send_error(404)
            return

        try:
            length = int(self.headers.get("Content-Length", "0"))
            payload = json.loads(self.rfile.read(length).decode("utf-8"))
            prompt = build_prompt(payload)
            result = call_dashscope(
                [
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": json.dumps(prompt, ensure_ascii=False)},
                ],
                temperature=DASHSCOPE_TEMPERATURE,
            )
            json_response(self, 200, {"ok": True, "result": result})
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="replace")
            json_response(self, exc.code, {"ok": False, "error": detail})
        except Exception as exc:
            json_response(self, 500, {"ok": False, "error": str(exc)})

    def log_message(self, fmt, *args):
        print(f"[server] {self.address_string()} - {fmt % args}")


if __name__ == "__main__":
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    print(f"项目拷问官 running at http://{HOST}:{PORT}")
    print(f"DashScope model: {DASHSCOPE_MODEL}")
    server.serve_forever()
