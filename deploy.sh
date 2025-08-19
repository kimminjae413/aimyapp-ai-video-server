#!/bin/bash
echo "=== 네이버 클라우드 배포 스크립트 ==="

# 시스템 업데이트
sudo apt update
sudo apt upgrade -y

# Python 3.8+ 설치
sudo apt install python3 python3-pip python3-venv -y

# 가상환경 생성
python3 -m venv venv
source venv/bin/activate

# 패키지 설치
pip install -r requirements.txt

# 방화벽 설정 (5002 포트 열기)
sudo ufw allow 5002

# 서비스 등록 (systemd)
sudo cp aimyapp-video.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable aimyapp-video
sudo systemctl start aimyapp-video

echo "배포 완료! 서버가 5002 포트에서 실행 중입니다."