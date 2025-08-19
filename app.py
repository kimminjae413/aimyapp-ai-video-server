#!/usr/bin/env python3
"""
오마이앱 호환 AI Video 생성 서버 - Cling 공식 API + S3 비동기 처리
유저 플로우: 앱 → 즉시 S3 링크 반환 → 백그라운드 영상 생성 → S3 업로드
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
import time
import hashlib
import hmac
import base64
import json
import logging
import os
import threading
import uuid
from datetime import datetime
import boto3
from botocore.exceptions import ClientError

# 로깅 설정
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

# 환경변수에서 설정 로드 (보안상 안전)
CLING_ACCESS_KEY = os.getenv('CLING_ACCESS_KEY', 'AYMPN8EdHeatKff3Gt9gHd9GFpFdYAQ9')
CLING_SECRET_KEY = os.getenv('CLING_SECRET_KEY', 'TNFmRQRAg8YACYKJACNgf8etatNgfdnT')
CLING_BASE_URL = "https://api.kuaishou.com"
CLING_API_URL = f"{CLING_BASE_URL}/v1/videos/multi-image2video"

# AWS S3 설정
AWS_ACCESS_KEY_ID = os.getenv('AWS_ACCESS_KEY_ID', 'AKIAQXUIYAFFQ2RRHFNH')
AWS_SECRET_ACCESS_KEY = os.getenv('AWS_SECRET_ACCESS_KEY', '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')
S3_BUCKET_NAME = os.getenv('S3_BUCKET_NAME', 'photo-to-video')
S3_REGION = os.getenv('S3_REGION', 'ap-northeast-2')

# S3 클라이언트 초기화
s3_client = boto3.client(
    's3',
    aws_access_key_id=AWS_ACCESS_KEY_ID,
    aws_secret_access_key=AWS_SECRET_ACCESS_KEY,
    region_name=S3_REGION
)

def generate_s3_video_url(user_id):
    """
    S3에 저장될 영상 URL 미리 생성
    """
    timestamp = int(time.time())
    video_filename = f"ai-videos/{user_id}_{timestamp}_{uuid.uuid4().hex[:8]}.mp4"
    s3_url = f"https://{S3_BUCKET_NAME}.s3.{S3_REGION}.amazonaws.com/{video_filename}"
    return s3_url, video_filename

def generate_cling_auth_header(method, path, body=""):
    """
    Cling API 인증 헤더 생성
    """
    timestamp = str(int(time.time()))
    nonce = str(uuid.uuid4())
    
    # 서명할 문자열 생성
    string_to_sign = f"{method}\n{path}\n{timestamp}\n{nonce}\n{body}"
    
    # HMAC-SHA256 서명 생성
    signature = hmac.new(
        CLING_SECRET_KEY.encode('utf-8'),
        string_to_sign.encode('utf-8'),
        hashlib.sha256
    ).digest()
    
    # Base64 인코딩
    signature_b64 = base64.b64encode(signature).decode('utf-8')
    
    # Authorization 헤더 생성
    auth_header = f"HMAC-SHA256 AccessKey={CLING_ACCESS_KEY}, Timestamp={timestamp}, Nonce={nonce}, Signature={signature_b64}"
    
    return auth_header

def call_cling_api_sync(image_url, prompt, gender=""):
    """
    Cling API 동기 호출 (태스크 생성)
    """
    try:
        logger.info(f"Cling API 태스크 생성: image_url={image_url}, prompt={prompt}")
        
        # 성별에 따른 프롬프트 보강
        enhanced_prompt = prompt
        if gender:
            enhanced_prompt = f"{prompt}, {gender} character"
        
        # Cling API 요청 데이터
        payload = {
            "model_name": "kling-v1-6",
            "image_list": [
                {
                    "image": image_url
                }
            ],
            "prompt": enhanced_prompt,
            "mode": "std",
            "duration": "5",
            "aspect_ratio": "16:9"
        }
        
        # 요청 본문을 JSON 문자열로 변환
        body = json.dumps(payload, separators=(',', ':'))
        
        # 인증 헤더 생성
        auth_header = generate_cling_auth_header("POST", "/v1/videos/multi-image2video", body)
        
        headers = {
            "Content-Type": "application/json",
            "Authorization": auth_header
        }
        
        # Cling API 호출
        response = requests.post(
            CLING_API_URL,
            headers=headers,
            json=payload,
            timeout=60
        )
        
        logger.info(f"Cling API 응답 상태: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            task_id = result.get('data', {}).get('task_id')
            
            if task_id:
                return {
                    "success": True,
                    "task_id": task_id
                }
            else:
                return {
                    "success": False,
                    "error": "태스크 ID를 받지 못했습니다",
                    "details": result
                }
        else:
            return {
                "success": False,
                "error": f"Cling API 호출 실패: {response.status_code}",
                "details": response.text
            }
            
    except Exception as e:
        logger.error(f"Cling API 호출 중 오류: {str(e)}")
        return {
            "success": False,
            "error": f"API 호출 오류: {str(e)}"
        }

def wait_and_upload_to_s3(task_id, s3_filename, user_id):
    """
    백그라운드에서 태스크 완료 대기 후 S3 업로드
    """
    try:
        logger.info(f"백그라운드 처리 시작: task_id={task_id}, s3_filename={s3_filename}")
        
        # 태스크 완료까지 대기 (최대 10분)
        max_wait_time = 600
        start_time = time.time()
        
        while time.time() - start_time < max_wait_time:
            try:
                # 태스크 상태 확인
                status_url = f"{CLING_BASE_URL}/v1/videos/multi-image2video/{task_id}"
                
                # 인증 헤더 생성
                auth_header = generate_cling_auth_header("GET", f"/v1/videos/multi-image2video/{task_id}")
                
                headers = {
                    "Authorization": auth_header
                }
                
                response = requests.get(status_url, headers=headers, timeout=30)
                
                if response.status_code == 200:
                    result = response.json()
                    task_status = result.get('data', {}).get('task_status')
                    
                    logger.info(f"태스크 상태 확인: {task_id} -> {task_status}")
                    
                    if task_status == "succeed":
                        # 완료된 경우 비디오 URL 획득
                        videos = result.get('data', {}).get('task_result', {}).get('videos', [])
                        if videos:
                            video_url = videos[0].get('url')
                            
                            # Cling에서 영상 다운로드
                            logger.info(f"Cling 영상 다운로드 시작: {video_url}")
                            video_response = requests.get(video_url, timeout=300)
                            
                            if video_response.status_code == 200:
                                # S3에 업로드
                                logger.info(f"S3 업로드 시작: {s3_filename}")
                                s3_client.put_object(
                                    Bucket=S3_BUCKET_NAME,
                                    Key=s3_filename,
                                    Body=video_response.content,
                                    ContentType='video/mp4'
                                )
                                
                                logger.info(f"=== 영상 생성 및 S3 업로드 완료 ===")
                                logger.info(f"사용자: {user_id}, 파일: {s3_filename}")
                                return True
                            else:
                                logger.error(f"Cling 영상 다운로드 실패: {video_response.status_code}")
                                return False
                        else:
                            logger.error(f"영상 URL을 찾을 수 없음: {task_id}")
                            return False
                            
                    elif task_status == "failed":
                        logger.error(f"태스크 실패: {task_id}")
                        return False
                    
                    # 아직 처리 중인 경우 15초 대기
                    time.sleep(15)
                else:
                    logger.error(f"태스크 상태 확인 실패: {response.status_code}")
                    time.sleep(15)
                    
            except Exception as e:
                logger.error(f"태스크 상태 확인 중 오류: {str(e)}")
                time.sleep(15)
        
        logger.error(f"태스크 완료 대기 시간 초과: {task_id}")
        return False
        
    except Exception as e:
        logger.error(f"백그라운드 처리 중 오류: {str(e)}")
        return False

@app.route('/upload_image', methods=['POST'])
def upload_image():
    """
    오마이앱 호환 엔드포인트 - 비동기 처리
    1. 즉시 S3 URL 반환
    2. 백그라운드에서 영상 생성 후 S3 업로드
    """
    try:
        logger.info("=== AI Video 생성 요청 시작 (비동기 모드) ===")
        
        # 요청 데이터 파싱
        data = request.get_json()
        logger.info(f"수신된 데이터: {data}")
        
        # 필수 파라미터 확인
        if not data:
            return jsonify({
                "@returnException": {
                    "#message": {
                        "message": "요청 데이터가 없습니다.",
                        "code": -1
                    }
                }
            }), 400
        
        # 오마이앱 구조에서 데이터 추출
        tmp_document = data.get('tmpDocument', {})
        new_document = data.get('newDocument', {})
        
        image_url = tmp_document.get('source_url')
        if not image_url:
            return jsonify({
                "@returnException": {
                    "#message": {
                        "message": "이미지 URL이 없습니다.",
                        "code": -1
                    }
                }
            }), 400
        
        # 사용자 정보 추출
        create_user = new_document.get('_createUser', {})
        user_id = create_user.get('userId', 'unknown')
        
        # 프롬프트 추출
        prompt = new_document.get('Prompt', '')
        if not prompt:
            prompt = "Create a dynamic video from this image"
        
        # 성별 정보
        gender = new_document.get('gender', '')
        
        logger.info(f"처리 정보 - 사용자: {user_id}, 이미지: {image_url}, 프롬프트: {prompt}")
        
        # 1단계: S3 URL 미리 생성
        s3_url, s3_filename = generate_s3_video_url(user_id)
        video_name = s3_filename.split('/')[-1]  # 파일명만 추출
        
        # 2단계: Cling API 태스크 생성 (동기)
        task_result = call_cling_api_sync(image_url, prompt, gender)
        
        if not task_result['success']:
            # Cling API 호출 실패
            error_message = task_result.get('error', 'AI 이미지를 받지 못했습니다.')
            
            logger.error(f"=== Cling API 호출 실패 ===")
            logger.error(f"오류: {error_message}")
            
            return jsonify({
                "@returnException": {
                    "#message": {
                        "message": error_message,
                        "code": -1
                    }
                }
            }), 500
        
        # 3단계: 백그라운드에서 영상 생성 및 S3 업로드 시작
        task_id = task_result['task_id']
        logger.info(f"태스크 생성 성공: {task_id}")
        
        # 백그라운드 스레드 시작
        background_thread = threading.Thread(
            target=wait_and_upload_to_s3,
            args=(task_id, s3_filename, user_id)
        )
        background_thread.daemon = True
        background_thread.start()
        
        # 4단계: 즉시 S3 URL 반환 (오마이앱 형식)
        response_data = {
            "tmpDocument": {
                "aiVideoName": video_name,
                "response": {
                    "video_url": s3_url
                }
            }
        }
        
        logger.info(f"=== 즉시 응답 전송 ===")
        logger.info(f"S3 URL: {s3_url}")
        logger.info(f"백그라운드 처리 시작됨: {task_id}")
        
        return jsonify(response_data)
        
    except Exception as e:
        logger.error(f"서버 오류: {str(e)}")
        return jsonify({
            "@returnException": {
                "#message": {
                    "message": f"서버 내부 오류: {str(e)}",
                    "code": -1
                }
            }
        }), 500

@app.route('/health', methods=['GET'])
def health_check():
    """
    서버 상태 확인 엔드포인트
    """
    return jsonify({
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "service": "AI Video Generation (Async)",
        "version": "3.0.0",
        "cling_api": CLING_API_URL,
        "s3_bucket": S3_BUCKET_NAME
    })

@app.route('/', methods=['GET'])
def root():
    """
    루트 엔드포인트
    """
    return jsonify({
        "message": "오마이앱 AI Video 생성 서버 (비동기)",
        "status": "running",
        "flow": {
            "1": "앱 → 서버 (이미지 + 프롬프트)",
            "2": "서버 → 앱 (즉시 S3 URL 반환)", 
            "3": "서버 → Cling API (백그라운드 영상 생성)",
            "4": "서버 → S3 (완성된 영상 업로드)",
            "5": "앱 → S3 (영상 스트리밍 재생)"
        },
        "endpoints": {
            "video_generation": "/upload_image",
            "health_check": "/health"
        }
    })

if __name__ == '__main__':
    logger.info("=== 오마이앱 AI Video 서버 시작 (비동기 모드) ===")
    logger.info(f"Cling API: {CLING_API_URL}")
    logger.info(f"S3 버킷: {S3_BUCKET_NAME}")
    logger.info(f"서버 플로우: 앱 → 즉시 응답 → 백그라운드 처리 → S3 업로드")
    logger.info("서버가 포트 5002에서 실행됩니다...")
    
    # 포트 5002에서 실행 (기존 오마이앱 설정과 동일)
    app.run(
        host='0.0.0.0',
        port=5002,
        debug=False  # 운영환경에서는 False
    )