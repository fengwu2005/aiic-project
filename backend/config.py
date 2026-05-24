from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
WEB_ROOT = ROOT / "web"
SKILLS_ROOT = ROOT / "skills"
PROMPTS_ROOT = ROOT / "prompts"
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


def config_get(section, key, default):
    return CONFIG.get(section, {}).get(key, default)


HOST = str(config_get("server", "host", "0.0.0.0"))
PORT = int(config_get("server", "port", 8000))
MAX_SAFETY_ROUNDS = int(config_get("app", "max_safety_rounds", 10))
SESSION_TTL_SECONDS = int(config_get("app", "session_ttl_seconds", 86400 * 14))
DASHSCOPE_URL = str(
    config_get(
        "dashscope",
        "url",
        "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
    )
)
DASHSCOPE_MODEL = str(config_get("dashscope", "model", "qwen-plus"))
DASHSCOPE_TEMPERATURE = float(config_get("dashscope", "temperature", 0.35))
DASHSCOPE_TIMEOUT = int(config_get("dashscope", "timeout_seconds", 45))
