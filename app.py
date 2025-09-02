from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
import json
import boto3
import threading
import time
import uuid
from datetime import datetime
import base64
import os
import random
from io import BytesIO
from PIL import Image

app = Flask(__name__)
CORS(app)

# 환경 변수 설정
AWS_ACCESS_KEY = "AKIAQXUIYAFFQ2RRHFNH"
AWS_SECRET_KEY = "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"
AWS_REGION = "us-east-1"
S3_BUCKET = "photo-to-video"

# Kling AI 설정
KLING_ACCESS_KEY = "AYMPN8EdHeatKff3Gt9gHd9GFpFdYAQ9"
KLING_SECRET_KEY = "TNFmRQRAg8YACYKJACNgf8etatNgfdnT"

# Akool AI 설정 (새로 추가)
AKOOL_ACCESS_KEY = "kdwRwzqnGf4zfAFvWCjFKQ=="
AKOOL_SECRET_KEY = "suEeE2dZWXsDTJ+mlOqYFhqeLDvJQ42g"

# 미리 준비된 얼굴 이미지 URL들 (S3에 업로드된 이미지들)
PRESET_FACES = {
    "male": [
        "https://photo-to-video.s3.amazonaws.com/preset-faces/male/face_m01.jpg",
        "https://photo-to-video.s3.amazonaws.com/preset-faces/male/face_m02.jpg", 
        "https://photo-to-video.s3.amazonaws.com/preset-faces/male/face_m03.jpg",
        "https://photo-to-video.s3.amazonaws.com/preset-faces/male/face_m04.jpg",
        "https://photo-to-video.s3.amazonaws.com/preset-faces/male/face_m05.jpg",
        "https://photo-to-video.s3.amazonaws.com/preset-faces/male/face_m06.jpg",
        "https://photo-to-video.s3.amazonaws.com/preset-faces/male/face_m07.jpg",
        "https://photo-to-video.s3.amazonaws.com/preset-faces/male/face_m08.jpg",
        "https://photo-to-video.s3.amazonaws.com/preset-faces/male/face_m09.jpg",
        "https://photo-to-video.s3.amazonaws.com/preset-faces/male/face_m10.jpg"
    ],
    "female": [
        "https://photo-to-video.s3.amazonaws.com/preset-faces/female/face_f01.jpg",
        "https://photo-to-video.s3.amazonaws.com/preset-faces/female/face_f02.jpg",
        "https://photo-to-video.s3.amazonaws.com/preset-faces/female/face_f03.jpg", 
        "https://photo-to-video.s3.amazonaws.com/preset-faces/female/face_f04.jpg",
        "https://photo-to-video.s3.amazonaws.com/preset-faces/female/face_f05.jpg",
        "https://photo-to-video.s3.amazonaws.com/preset-faces/female/face_f06.jpg",
        "https://photo-to-video.s3.amazonaws.com/preset-faces/female/face_f07.jpg",
        "https://photo-to-video.s3.amazonaws.com/preset-faces/female/face_f08.jpg",
        "https://photo-to-video.s3.amazonaws.com/preset-faces/female/face_f09.jpg",
        "https://photo-to-video.s3.amazonaws.com/preset-faces/female/face_f10.jpg"
    ]
}

# S3 클라이언트 설정
s3_client = boto3.client(
    's3',
    aws_access_key_id=AWS_ACCESS_KEY,
    aws_secret_access_key=AWS_SECRET_KEY,
    region_name=AWS_REGION
)

# 작업 상태 저장소 (메모리)
job_status = {}

def get_akool_token():
    """Akool API 토큰 가져오기"""
    try:
        url = "https://openapi.akool.com/api/open/v3/getToken"
        payload = {
            "clientId": AKOOL_ACCESS_KEY,
            "clientSecret": AKOOL_SECRET_KEY
        }
        headers = {
            "Content-Type": "application/json"
        }
        
        response = requests.post(url, json=payload, headers=headers)
        response.raise_for_status()
        
        data = response.json()
        if data.get("code") == 1000:
            return data["data"]["token"]
        else:
            print(f"Akool 토큰 가져오기 실패: {data.get('msg')}")
            return None
    except Exception as e:
        print(f"Akool 토큰 요청 오류: {str(e)}")
        return None

def upload_to_s3(file_content, file_name, content_type='image/jpeg'):
    """파일을 S3에 업로드"""
    try:
        s3_client.put_object(
            Bucket=S3_BUCKET,
            Key=file_name,
            Body=file_content,
            ContentType=content_type,
            ACL='public-read'
        )
        return f"https://{S3_BUCKET}.s3.amazonaws.com/{file_name}"
    except Exception as e:
        print(f"S3 업로드 오류: {str(e)}")
        return None

def download_image_from_url(url):
    """URL에서 이미지 다운로드"""
    try:
        response = requests.get(url)
        response.raise_for_status()
        return response.content
    except Exception as e:
        print(f"이미지 다운로드 오류: {str(e)}")
        return None

def detect_face_akool(image_url, token):
    """Akool Face Detection API 호출"""
    try:
        url = "https://sg3.akool.com/detect"
        payload = {
            "single_face": False,
            "image_url": image_url
        }
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
        
        response = requests.post(url, json=payload, headers=headers)
        response.raise_for_status()
        
        data = response.json()
        if data.get("error_code") == 0:
            return data.get("landmarks_str", [])
        else:
            print(f"얼굴 감지 실패: {data.get('error_msg')}")
            return None
    except Exception as e:
        print(f"얼굴 감지 API 오류: {str(e)}")
        return None

def process_face_swap_async(job_id, original_image_url, target_face_url, token):
    """비동기 Face Swap 처리"""
    try:
        job_status[job_id]["status"] = "processing"
        job_status[job_id]["message"] = "얼굴 감지 중..."
        
        # 1. 원본 이미지에서 얼굴 감지
        original_landmarks = detect_face_akool(original_image_url, token)
        if not original_landmarks:
            job_status[job_id]["status"] = "failed"
            job_status[job_id]["message"] = "원본 이미지에서 얼굴을 감지할 수 없습니다"
            return
        
        # 2. 타겟 얼굴에서 얼굴 감지
        target_landmarks = detect_face_akool(target_face_url, token)
        if not target_landmarks:
            job_status[job_id]["status"] = "failed"
            job_status[job_id]["message"] = "타겟 얼굴에서 얼굴을 감지할 수 없습니다"
            return
        
        job_status[job_id]["message"] = "얼굴 교체 처리 중..."
        
        # 3. Face Swap API 호출
        faceswap_url = "https://openapi.akool.com/api/open/v3/faceswap/highquality/specifyimage"
        payload = {
            "targetImage": [{
                "path": original_image_url,
                "opts": original_landmarks[0] if original_landmarks else ""
            }],
            "sourceImage": [{
                "path": target_face_url,
                "opts": target_landmarks[0] if target_landmarks else ""
            }],
            "face_enhance": 1,
            "modifyImage": original_image_url
        }
        
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
        
        response = requests.post(faceswap_url, json=payload, headers=headers)
        response.raise_for_status()
        
        swap_data = response.json()
        if swap_data.get("code") == 1000:
            akool_job_id = swap_data["data"]["job_id"]
            result_url = swap_data["data"]["url"]
            
            # 4. 결과 폴링 (최대 3분)
            job_status[job_id]["message"] = "결과 생성 대기 중..."
            
            for _ in range(36):  # 5초씩 36번 = 3분
                time.sleep(5)
                
                # 결과 확인
                check_url = f"https://openapi.akool.com/api/open/v3/faceswap/result/listbyids"
                check_response = requests.get(
                    check_url,
                    params={"_ids": swap_data["data"]["_id"]},
                    headers={"Authorization": f"Bearer {token}"}
                )
                
                if check_response.status_code == 200:
                    check_data = check_response.json()
                    if check_data.get("code") == 1000:
                        results = check_data["data"]["result"]
                        if results and len(results) > 0:
                            swap_status = results[0]["faceswap_status"]
                            if swap_status == 3:  # 성공
                                final_url = results[0]["url"]
                                
                                # 5. S3에 결과물 저장
                                job_status[job_id]["message"] = "결과물 저장 중..."
                                
                                image_content = download_image_from_url(final_url)
                                if image_content:
                                    s3_filename = f"faceswap/{job_id}_result.jpg"
                                    s3_url = upload_to_s3(image_content, s3_filename)
                                    
                                    if s3_url:
                                        job_status[job_id]["status"] = "completed"
                                        job_status[job_id]["result_url"] = s3_url
                                        job_status[job_id]["message"] = "완료"
                                        return
                            elif swap_status == 4:  # 실패
                                job_status[job_id]["status"] = "failed"
                                job_status[job_id]["message"] = "Face swap 처리 실패"
                                return
            
            # 타임아웃
            job_status[job_id]["status"] = "failed"
            job_status[job_id]["message"] = "처리 시간 초과"
        else:
            job_status[job_id]["status"] = "failed"
            job_status[job_id]["message"] = f"Face swap 요청 실패: {swap_data.get('msg')}"
            
    except Exception as e:
        job_status[job_id]["status"] = "failed"
        job_status[job_id]["message"] = f"처리 중 오류: {str(e)}"
        print(f"Face swap 처리 오류: {str(e)}")

# ================================
# 기존 Kling 영상변환 API (유지)
# ================================

@app.route('/convert-to-video', methods=['POST'])
def convert_to_video():
    """기존 Kling 영상변환 API"""
    try:
        data = request.json
        image_base64 = data.get('image')
        prompt = data.get('prompt', '')
        
        if not image_base64:
            return jsonify({"error": "이미지가 필요합니다"}), 400
        
        # 고유 작업 ID 생성
        job_id = str(uuid.uuid4())
        
        # 상태 초기화
        job_status[job_id] = {
            "status": "processing",
            "message": "영상 변환 시작",
            "created_at": datetime.now().isoformat()
        }
        
        # S3 URL 즉시 반환
        s3_video_url = f"https://{S3_BUCKET}.s3.amazonaws.com/videos/{job_id}_result.mp4"
        
        # 백그라운드에서 Kling API 처리 (기존 로직)
        # threading.Thread(target=process_kling_video_async, args=(job_id, image_base64, prompt)).start()
        
        return jsonify({
            "job_id": job_id,
            "video_url": s3_video_url,
            "status": "processing"
        })
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ================================
# 새로운 Akool Face Swap API
# ================================

@app.route('/face-swap-image', methods=['POST'])
def face_swap_image():
    """이미지 Face Swap API - 성별 선택으로 랜덤 얼굴 적용"""
    try:
        data = request.json
        original_image = data.get('original_image')  # base64 또는 URL - 헤어스타일 유지할 원본
        gender = data.get('gender', 'male')  # 'male' 또는 'female'
        
        if not original_image:
            return jsonify({"error": "원본 이미지가 필요합니다"}), 400
        
        if gender not in ['male', 'female']:
            return jsonify({"error": "성별은 'male' 또는 'female'이어야 합니다"}), 400
        
        # Akool 토큰 가져오기
        token = get_akool_token()
        if not token:
            return jsonify({"error": "Akool 인증 실패"}), 500
        
        # 고유 작업 ID 생성
        job_id = str(uuid.uuid4())
        
        # 랜덤으로 얼굴 선택
        selected_face_url = random.choice(PRESET_FACES[gender])
        
        # 상태 초기화
        job_status[job_id] = {
            "status": "processing",
            "message": "이미지 업로드 중...",
            "selected_gender": gender,
            "selected_face": selected_face_url,
            "created_at": datetime.now().isoformat()
        }
        
        # 원본 이미지를 S3에 업로드 (필요시)
        original_s3_url = None
        
        if original_image.startswith('data:image'):
            # base64 이미지인 경우 S3에 업로드
            header, encoded = original_image.split(',', 1)
            image_data = base64.b64decode(encoded)
            original_filename = f"temp/{job_id}_original.jpg"
            original_s3_url = upload_to_s3(image_data, original_filename)
        else:
            # 이미 URL인 경우 그대로 사용
            original_s3_url = original_image
        
        if not original_s3_url:
            return jsonify({"error": "원본 이미지 업로드 실패"}), 500
        
        # 결과물 S3 URL 미리 생성
        result_s3_url = f"https://{S3_BUCKET}.s3.amazonaws.com/faceswap/{job_id}_result.jpg"
        
        # 백그라운드에서 Face Swap 처리
        threading.Thread(
            target=process_face_swap_async, 
            args=(job_id, original_s3_url, selected_face_url, token)
        ).start()
        
        return jsonify({
            "job_id": job_id,
            "result_url": result_s3_url,
            "status": "processing",
            "selected_gender": gender,
            "message": f"{gender} 얼굴로 변환 중..."
        })
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/get-preset-faces', methods=['GET'])
def get_preset_faces():
    """미리 준비된 얼굴 목록 조회 API (관리용)"""
    return jsonify({
        "male_faces": len(PRESET_FACES["male"]),
        "female_faces": len(PRESET_FACES["female"]), 
        "faces": PRESET_FACES
    })

@app.route('/preview-face', methods=['POST'])
def preview_face():
    """특정 성별의 랜덤 얼굴 미리보기 API"""
    try:
        data = request.json
        gender = data.get('gender', 'male')
        
        if gender not in ['male', 'female']:
            return jsonify({"error": "성별은 'male' 또는 'female'이어야 합니다"}), 400
        
        # 랜덤 얼굴 선택
        selected_face = random.choice(PRESET_FACES[gender])
        
        return jsonify({
            "gender": gender,
            "face_url": selected_face,
            "total_faces": len(PRESET_FACES[gender])
        })
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/detect-face', methods=['POST'])
def detect_face():
    """얼굴 감지 API"""
    try:
        data = request.json
        image_url = data.get('image_url')
        
        if not image_url:
            return jsonify({"error": "이미지 URL이 필요합니다"}), 400
        
        # Akool 토큰 가져오기
        token = get_akool_token()
        if not token:
            return jsonify({"error": "Akool 인증 실패"}), 500
        
        # 얼굴 감지
        landmarks = detect_face_akool(image_url, token)
        
        if landmarks:
            return jsonify({
                "success": True,
                "face_count": len(landmarks),
                "landmarks": landmarks
            })
        else:
            return jsonify({
                "success": False,
                "message": "얼굴을 감지할 수 없습니다"
            })
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/check-status/<job_id>', methods=['GET'])
def check_status(job_id):
    """작업 상태 확인 API (공통)"""
    if job_id in job_status:
        return jsonify(job_status[job_id])
    else:
        return jsonify({"error": "작업을 찾을 수 없습니다"}), 404

@app.route('/health', methods=['GET'])
def health_check():
    """헬스체크 API"""
    return jsonify({
        "status": "healthy",
        "services": ["kling_video", "akool_faceswap"],
        "timestamp": datetime.now().isoformat()
    })

if __name__ == '__main__':
    print("🚀 통합 AI 서버 시작")
    print("📹 Kling 영상변환: POST /convert-to-video")
    print("👤 Akool 얼굴교체: POST /face-swap-image")
    print("🔍 얼굴감지: POST /detect-face")
    print("📊 상태확인: GET /check-status/<job_id>")
    app.run(host='0.0.0.0', port=5002, debug=False)