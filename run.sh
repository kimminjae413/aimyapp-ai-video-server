#!/bin/bash
echo "=== 오마이앱 AI Video 서버 시작 ==="
echo "Python 버전 확인..."
python3 --version

echo "패키지 설치..."
pip3 install -r requirements.txt

echo "서버 실행..."
python3 app.py