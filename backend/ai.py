import json
import urllib.request

from .config import DASHSCOPE_MODEL, DASHSCOPE_TEMPERATURE, DASHSCOPE_TIMEOUT, DASHSCOPE_URL, config_get


def dashscope_body(messages, temperature=None):
    body = {
        "model": DASHSCOPE_MODEL,
        "messages": messages,
        "temperature": DASHSCOPE_TEMPERATURE if temperature is None else temperature,
        "response_format": {"type": "json_object"},
    }
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


def call_dashscope(messages, temperature=None):
    request = dashscope_request(dashscope_body(messages, temperature=temperature))
    with urllib.request.urlopen(request, timeout=DASHSCOPE_TIMEOUT) as response:
        data = json.loads(response.read().decode("utf-8"))
    content = data["choices"][0]["message"]["content"]
    return json.loads(content)
