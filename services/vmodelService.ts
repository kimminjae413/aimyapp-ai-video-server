// services/vmodelService.ts - VModel AI 얼굴교체 완전 수정 버전 (Cloudinary 연동)
import type { ImageFile } from '../types';
import { uploadImageToCloudinary } from './imageHostingService';

// VModel AI 설정 (공식 문서 기준)
const VMODEL_API_BASE = 'https://api.vmodel.ai/api/tasks/v1';
const VMODEL_VERSION = 'd4f292d1ea72ac4e501e6ac7be938ce2a5c50c6852387b1b64dedee01e623029'; // 공식 문서 version

interface VModelCreateResponse {
  code: number;
  result: {
    task_id: string;
    task_cost: number;
  };
  message: {
    en: string;
  };
}

interface VModelTaskResponse {
  code: number;
  result: {
    task_id: string;
    status: 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled';
    output?: string[];
    error?: string | null;
    total_time?: number;
    predict_time?: number;
    completed_at?: number | null;
  };
  message: any;
}

/**
 * VModel AI를 사용한 얼굴교체 (Cloudinary 연동)
 */
export const swapFaceWithVModel = async (
  referenceImage: ImageFile, // 참고할 얼굴 (swap_image)
  targetImage: ImageFile,    // 원본 이미지 (target_image)  
  onProgress?: (status: string) => void
): Promise<ImageFile | null> => {
  try {
    const apiToken = process.env.VMODEL_API_TOKEN;
    
    if (!apiToken) {
      console.error('❌ VModel API 토큰이 설정되지 않았습니다.');
      throw new Error('VModel API 토큰이 설정되지 않았습니다.');
    }

    console.log('🔄 VModel AI 얼굴교체 시작...');
    console.log('📋 VModel 요청 정보:', {
      model: 'photo-face-swap-pro',
      version: VMODEL_VERSION.substring(0, 12) + '...',
      apiTokenExists: !!apiToken,
      cloudinaryConfigured: !!(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY)
    });
    
    if (onProgress) {
      onProgress('이미지를 Cloudinary에 업로드 중...');
    }

    // 1. 이미지들을 Cloudinary에 업로드하여 HTTP URL 생성
    console.log('📤 Cloudinary 이미지 업로드 시작...');
    
    const [referenceImageUrl, targetImageUrl] = await Promise.all([
      uploadImageToCloudinary(referenceImage, 'vmodel_reference'),
      uploadImageToCloudinary(targetImage, 'vmodel_target')
    ]);

    console.log('✅ Cloudinary 업로드 완료:', {
      referenceUrl: referenceImageUrl.substring(0, 50) + '...',
      targetUrl: targetImageUrl.substring(0, 50) + '...'
    });

    if (onProgress) {
      onProgress('VModel AI 작업 생성 중...');
    }

    // 2. VModel AI 작업 생성 (올바른 파라미터 순서)
    const requestBody = {
      version: VMODEL_VERSION,
      input: {
        swap_image: referenceImageUrl,    // 참고할 얼굴
        target_image: targetImageUrl,     // 원본 이미지
        disable_safety_checker: false
      }
    };

    console.log('🚀 VModel API 호출:', {
      url: `${VMODEL_API_BASE}/create`,
      bodyKeys: Object.keys(requestBody),
      inputKeys: Object.keys(requestBody.input)
    });

    const createResponse = await fetch(`${VMODEL_API_BASE}/create`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    });

    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      console.error('❌ VModel 작업 생성 실패:', {
        status: createResponse.status,
        statusText: createResponse.statusText,
        error: errorText.substring(0, 200)
      });
      
      if (createResponse.status === 401) {
        throw new Error('VModel API 토큰이 유효하지 않습니다.');
      } else if (createResponse.status === 400) {
        throw new Error('이미지 형식이 올바르지 않습니다.');
      } else {
        throw new Error(`VModel API 오류: ${createResponse.status}`);
      }
    }

    const createData: VModelCreateResponse = await createResponse.json();
    
    if (createData.code !== 200) {
      console.error('❌ VModel 응답 오류:', createData);
      throw new Error(`VModel 작업 생성 실패: ${createData.message?.en || 'Unknown error'}`);
    }

    const taskId = createData.result.task_id;
    const taskCost = createData.result.task_cost;
    
    console.log('✅ VModel 작업 생성 완료:', {
      taskId,
      cost: `${taskCost} credits ($${(taskCost * 0.02).toFixed(2)})`,
      message: createData.message.en
    });

    if (onProgress) {
      onProgress(`VModel AI 처리 중... (약 5-15초 소요)`);
    }

    // 3. 작업 완료까지 폴링
    return await pollVModelTask(taskId, apiToken, onProgress);

  } catch (error) {
    console.error('❌ VModel AI 얼굴교체 실패:', error);
    throw error;
  }
};

/**
 * VModel 작업 상태 폴링 (개선된 버전)
 */
const pollVModelTask = async (
  taskId: string,
  apiToken: string,
  onProgress?: (status: string) => void,
  maxAttempts: number = 45 // 45초 (1초 간격)
): Promise<ImageFile | null> => {
  const pollInterval = 1000; // 1초 (더 빠른 응답을 위해)
  let attempts = 0;

  console.log(`🔄 VModel 작업 폴링 시작: ${taskId}`);

  while (attempts < maxAttempts) {
    try {
      const response = await fetch(`${VMODEL_API_BASE}/get/${taskId}`, {
        headers: {
          'Authorization': `Bearer ${apiToken}`,
        }
      });

      if (!response.ok) {
        console.warn(`⚠️ 상태 확인 HTTP 오류: ${response.status}, 재시도 중...`);
        await new Promise(resolve => setTimeout(resolve, pollInterval));
        attempts++;
        continue;
      }

      const data: VModelTaskResponse = await response.json();
      
      if (data.code !== 200) {
        console.warn(`⚠️ VModel 응답 코드 오류: ${data.code}, 재시도 중...`);
        await new Promise(resolve => setTimeout(resolve, pollInterval));
        attempts++;
        continue;
      }

      const task = data.result;
      const status = task.status;
      const totalTime = Math.round(task.total_time || 0);
      
      console.log(`🔄 VModel 상태: ${status} (${attempts + 1}초 경과)`);

      if (onProgress) {
        const messages = {
          starting: 'VModel AI 시작 중...',
          processing: `VModel AI 처리 중... (${totalTime}초 경과)`,
          succeeded: 'VModel AI 완료!',
          failed: 'VModel AI 실패',
          canceled: 'VModel AI 취소됨'
        };
        onProgress(messages[status] || `상태: ${status}`);
      }

      if (status === 'succeeded') {
        if (task.output && task.output.length > 0) {
          const resultUrl = task.output[0];
          console.log('✅ VModel AI 얼굴교체 성공:', {
            taskId,
            totalTime: `${task.total_time}초`,
            predictTime: `${task.predict_time}초`,
            resultUrl: resultUrl.substring(0, 60) + '...'
          });

          // 결과 이미지를 Base64로 변환
          return await convertUrlToImageFile(resultUrl);
        } else {
          throw new Error('VModel 결과에 이미지가 없습니다.');
        }
      }

      if (status === 'failed') {
        const errorMsg = task.error || '알 수 없는 오류';
        console.error('❌ VModel 작업 실패:', errorMsg);
        throw new Error(`VModel AI 작업 실패: ${errorMsg}`);
      }

      if (status === 'canceled') {
        throw new Error('VModel AI 작업이 취소되었습니다.');
      }

      // 다음 폴링까지 대기
      await new Promise(resolve => setTimeout(resolve, pollInterval));
      attempts++;

    } catch (error) {
      console.error('❌ VModel 폴링 중 오류:', error);
      if (attempts >= maxAttempts - 5) {
        // 마지막 5회 시도에서는 오류를 throw
        throw error;
      }
      // 그 외에는 재시도
      await new Promise(resolve => setTimeout(resolve, pollInterval));
      attempts++;
    }
  }

  throw new Error('VModel AI 작업 시간 초과 (45초). 이미지가 너무 크거나 복잡할 수 있습니다.');
};

/**
 * URL을 ImageFile로 변환 (개선된 버전)
 */
const convertUrlToImageFile = async (imageUrl: string): Promise<ImageFile> => {
  try {
    console.log('📥 VModel 결과 이미지 다운로드 중...');
    
    const response = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (!response.ok) {
      throw new Error(`결과 이미지 다운로드 실패: ${response.status} ${response.statusText}`);
    }

    const blob = await response.blob();
    const arrayBuffer = await blob.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

    const mimeType = blob.type || 'image/png';
    const dataUrl = `data:${mimeType};base64,${base64}`;

    console.log('✅ VModel 결과 이미지 변환 완료:', {
      mimeType,
      size: `${Math.round(base64.length / 1024)}KB`,
      dimensions: '확인 중...'
    });

    return {
      base64,
      mimeType,
      url: dataUrl
    };

  } catch (error) {
    console.error('❌ VModel 결과 이미지 변환 실패:', error);
    throw new Error('VModel 결과 이미지를 처리할 수 없습니다.');
  }
};

/**
 * VModel 서비스 연결 테스트
 */
export const testVModelConnection = async (): Promise<boolean> => {
  try {
    const apiToken = process.env.VMODEL_API_TOKEN;
    
    if (!apiToken) {
      console.warn('⚠️ VModel API 토큰이 설정되지 않았습니다.');
      return false;
    }

    // 간단한 헬스체크 (존재하지 않는 task_id로 상태 확인)
    const response = await fetch(`${VMODEL_API_BASE}/get/health-check-test`, {
      headers: {
        'Authorization': `Bearer ${apiToken}`,
      }
    });

    // 404는 정상 (API는 작동하지만 task가 없음)
    // 401은 토큰 문제
    // 200은 이상적
    const isConnected = response.status === 404 || response.status === 200;
    
    console.log('🔍 VModel 연결 테스트:', {
      status: response.status,
      statusText: response.statusText,
      connected: isConnected,
      hasToken: !!apiToken,
      hasCloudinary: !!(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY)
    });

    return isConnected;
  } catch (error) {
    console.error('❌ VModel 연결 테스트 실패:', error);
    return false;
  }
};

/**
 * VModel 서비스 상태 확인
 */
export const getVModelServiceStatus = () => {
  const hasToken = !!process.env.VMODEL_API_TOKEN;
  const hasCloudinary = !!(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);
  
  return {
    version: '2.0-VMODEL-CLOUDINARY',
    model: 'vmodel/photo-face-swap-pro',
    modelVersion: VMODEL_VERSION,
    cost: '$0.02 per use (2 credits)',
    timeout: '45초',
    configured: hasToken && hasCloudinary,
    hasApiToken: hasToken,
    hasCloudinary: hasCloudinary,
    features: [
      '🎯 전용 얼굴교체 AI 모델',
      '💰 저렴한 비용 ($0.02/회)',
      '⚡ 빠른 처리 속도 (5-15초)',
      '🛡️ 안전성 검사 내장',
      '📸 고품질 결과물',
      '☁️ Cloudinary 이미지 호스팅',
      '🔄 개선된 폴링 시스템 (1초 간격)',
      '🎨 자동 이미지 형식 변환'
    ],
    requirements: [
      '🔑 VModel API 토큰',
      '☁️ Cloudinary 계정 (이미지 호스팅)',
      '🌐 인터넷 연결',
      '📤 HTTP URL 접근 가능'
    ],
    advantages: [
      '🚀 Gemini 대비 2-3배 빠른 처리',
      '🎯 얼굴교체 전용 최적화',
      '💵 예측 가능한 비용',
      '🔧 간단한 API 구조',
      '🛡️ 품질 보장'
    ]
  };
};
