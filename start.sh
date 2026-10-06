#!/bin/sh
# 게임 실행: 로컬 서버를 띄우고 http://localhost:8000 으로 접속하세요.
cd "$(dirname "$0")" && echo "▶ http://localhost:8000" && python3 -m http.server 8000
