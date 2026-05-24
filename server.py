#!/usr/bin/env python3
"""项目拷问官启动入口."""

from http.server import ThreadingHTTPServer

from backend.config import DASHSCOPE_MODEL, HOST, PORT
from backend.handler import Handler
from backend.storage import init_db


if __name__ == "__main__":
    init_db()
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    print(f"项目拷问官 running at http://{HOST}:{PORT}")
    print(f"DashScope model: {DASHSCOPE_MODEL}")
    server.serve_forever()
