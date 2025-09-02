#!/bin/bash

echo "🚀 통합 AI 서버 시작 중..."

# Python 가상환경 생성 (없을 경우)
if [ ! -d "venv" ]; then
    echo "📦 가상환경 생성 중..."
    python3 -m venv venv
fi

# 가상환경 활성화
echo "🔧 가상환경 활성화..."
source venv/bin/activate

# 패키지 설치
echo "📥 패키지 설치 중..."
pip install --upgrade pip
pip install -r requirements.txt

# 서버 실행
echo "🎯 서버 실행 중..."
echo "📹 Kling 영상변환: POST /convert-to-video"
echo "👤 Akool 얼굴교체: POST /face-swap-image"  
echo "🔍 얼굴감지: POST /detect-face"
echo "📊 상태확인: GET /check-status/<job_id>"
echo "🏥 헬스체크: GET /health"
echo ""
echo "🌐 서버 주소: http://0.0.0.0:5002"
echo ""

# Production 환경에서는 gunicorn 사용
if [ "$NODE_ENV" = "production" ]; then
    echo "🚀 Production 모드로 실행..."
    gunicorn -w 4 -b 0.0.0.0:5002 --timeout 300 app:app
else
    echo "🔧 Development 모드로 실행..."
    python app.py
fi