// services/vmodelService.ts - VModel AI 얼굴교체 전용 서비스
import type { ImageFile } from '../types';

// VModel AI 설정
const VMODEL_API_BASE = 'https://api.vmodel.ai/api/tasks/v1';
const VMODEL_VERSION = 'a3c8d261fd14126eececf9812b52b40811e9ed557ccc5706452888cdeeebc0b6'; // photo-face-swap-pro
const VMODEL_API_TOKEN = process.env.VMODEL_API_TOKEN;

if (!VMODEL_API_TOKEN) {
  console.warn('⚠️ VMODEL_API_TOKEN 환경변수가 설정되지 않았습니다.');
}

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
    user_id: number;
    version: string;
    error: string | null;
    total_time: number;
    predict_time: number;
    logs: string | null;
    output: string[] | null;
    status: 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled';
    create_at: number;
    completed_at: number | null;
  };
  message: any;
}

/**
 * 이미지를 업로드 가능한 URL로 변환
 * VModel AI는 HTTP URL만 허용하므로 Base64를 URL로 변환해야 함
 */
const uploadImageToTempUrl = async (imageFile: ImageFile): Promise<string> => {
  try {
    // 임시 방법: data URL 사용 (실제로는 외부 이미지 호스팅 서비스 사용 권장)
    // 하지만 VModel이 data URL을 지원하지 않을 수 있으므로 
    // 실제 구현에서는 Firebase Storage, AWS S3, 또는 Cloudinary 등을 사용해야 함
    
    console.log('⚠️ VModel AI는 HTTP URL이 필요합니다. 임시 구현을 사용 중입니다.');
    
    // 임시: Base64를 Blob URL로 변환 (로컬에서만 작동)
    const response = await fetch(imageFile.url);
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    
    // 실제로는 아래와 같은 외부 서비스를 사용해야 함:
    // return await uploadToCloudinary(imageFile.base64);
    // return await uploadToFirebaseStorage(imageFile);
    // return await uploadToS3(imageFile);
    
    return blobUrl; // 임시 방법
  } catch (error) {
    console.error('이미지 URL 변환 실패:', error);
    throw new Error('이미지를 업로드할 수 없습니다.');
  }
};

/**
 * VModel AI를 사용한 얼굴교체
 */
export const swapFaceWithVModel = async (
  originalImage: ImageFile,
  swapImage: ImageFile,
  onProgress?: (status: string) => void
): Promise<ImageFile | null> => {
  try {
    if (!VMODEL_API_TOKEN) {
      throw new Error('VModel API 토큰이 설정되지 않았습니다.');
    }

    console.log('🔄 VModel AI 얼굴교체 시작...');
    
    if (onProgress) {
      onProgress('이미지 업로드 중...');
    }

    // 1. 이미지들을 HTTP URL로 변환
    console.log('📤 이미지 URL 변환 중...');
    const targetImageUrl = await uploadImageToTempUrl(originalImage);
    const swapImageUrl = await uploadImageToTempUrl(swapImage);

    console.log('VModel 요청 준비:', {
      version: VMODEL_VERSION,
      target_image: targetImageUrl.substring(0, 50) + '...',
      swap_image: swapImageUrl.substring(0, 50) + '...'
    });

    if (onProgress) {
      onProgress('VModel AI 작업 생성 중...');
    }

    // 2. VModel AI 작업 생성
    const createResponse = await fetch(`${VMODEL_API_BASE}/create`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${VMODEL_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        version: VMODEL_VERSION,
        input: {
          target_image: targetImageUrl,
          swap_image: swapImageUrl,
          disable_safety_checker: false
        }
      })
    });

    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      console.error('VModel 작업 생성 실패:', createResponse.status, errorText);
      throw new Error(`VModel API 오류: ${createResponse.status}`);
    }

    const createData: VModelCreateResponse = await createResponse.json();
    
    if (createData.code !== 200) {
      throw new Error(`VModel 작업 생성 실패: ${createData.message?.en || 'Unknown error'}`);
    }

    const taskId = createData.result.task_id;
    const taskCost = createData.result.task_cost;
    
    console.log('✅ VModel 작업 생성 완료:', {
      taskId,
      cost: taskCost,
      message: createData.message.en
    });

    if (onProgress) {
      onProgress(`VModel AI 처리 중... (비용: $${(taskCost / 100).toFixed(2)})`);
    }

    // 3. 작업 완료까지 폴링
    return await pollVModelTask(taskId, onProgress);

  } catch (error) {
    console.error('❌ VModel AI 얼굴교체 실패:', error);
    throw error;
  }
};

/**
 * VModel 작업 상태 폴링
 */
const pollVModelTask = async (
  taskId: string,
  onProgress?: (status: string) => void,
  maxAttempts: number = 60 // 5분 (5초 간격)
): Promise<ImageFile | null> => {
  const pollInterval = 5000; // 5초
  let attempts = 0;

  while (attempts < maxAttempts) {
    try {
      const response = await fetch(`${VMODEL_API_BASE}/get/${taskId}`, {
        headers: {
          'Authorization': `Bearer ${VMODEL_API_TOKEN}`,
        }
      });

      if (!response.ok) {
        throw new Error(`작업 상태 확인 실패: ${response.status}`);
      }

      const data: VModelTaskResponse = await response.json();
      
      if (data.code !== 200) {
        throw new Error(`VModel API 오류: ${data.code}`);
      }

      const task = data.result;
      const status = task.status;
      
      console.log(`🔄 VModel 작업 상태: ${status} (${attempts + 1}/${maxAttempts})`);

      if (onProgress) {
        const messages = {
          starting: 'VModel AI 시작 중...',
          processing: `VModel AI 처리 중... (${Math.round(task.total_time || 0)}초 경과)`,
          succeeded: 'VModel AI 완료!',
          failed: 'VModel AI 실패',
          canceled: 'VModel AI 취소됨'
        };
        onProgress(messages[status] || `상태: ${status}`);
      }

      if (status === 'succeeded') {
        if (task.output && task.output.length > 0) {
          const resultUrl = task.output[0];
          console.log('✅ VModel AI 얼굴교체 완료:', {
            taskId,
            totalTime: task.total_time,
            predictTime: task.predict_time,
            resultUrl: resultUrl.substring(0, 50) + '...'
          });

          // 결과 이미지를 Base64로 변환
          return await convertUrlToImageFile(resultUrl);
        } else {
          throw new Error('결과 이미지가 없습니다.');
        }
      }

      if (status === 'failed') {
        const errorMsg = task.error || '알 수 없는 오류';
        throw new Error(`VModel AI 작업 실패: ${errorMsg}`);
      }

      if (status === 'canceled') {
        throw new Error('VModel AI 작업이 취소되었습니다.');
      }

      // 다음 폴링까지 대기
      await new Promise(resolve => setTimeout(resolve, pollInterval));
      attempts++;

    } catch (error) {
      console.error('❌ VModel 작업 상태 확인 중 오류:', error);
      throw error;
    }
  }

  throw new Error('VModel AI 작업 시간 초과 (5분)');
};

/**
 * URL을 ImageFile로 변환
 */
const convertUrlToImageFile = async (imageUrl: string): Promise<ImageFile> => {
  try {
    console.log('📥 결과 이미지 다운로드 중...');
    
    const response = await fetch(imageUrl, {
      headers: {
        'Authorization': `Bearer ${VMODEL_API_TOKEN}`, // VModel 결과에 인증이 필요할 수 있음
      }
    });

    if (!response.ok) {
      throw new Error(`이미지 다운로드 실패: ${response.status}`);
    }

    const blob = await response.blob();
    const arrayBuffer = await blob.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

    const mimeType = blob.type || 'image/png';
    const dataUrl = `data:${mimeType};base64,${base64}`;

    console.log('✅ 결과 이미지 변환 완료:', {
      mimeType,
      size: Math.round(base64.length / 1024) + 'KB'
    });

    return {
      base64,
      mimeType,
      url: dataUrl
    };

  } catch (error) {
    console.error('결과 이미지 변환 실패:', error);
    throw new Error('결과 이미지를 처리할 수 없습니다.');
  }
};

/**
 * VModel 서비스 상태 확인
 */
export const getVModelServiceStatus = () => {
  return {
    version: '1.0-VMODEL-FACESWAP',
    model: 'vmodel/photo-face-swap-pro',
    modelVersion: VMODEL_VERSION,
    cost: '$0.02 per use',
    timeout: '5분',
    hasApiToken: !!VMODEL_API_TOKEN,
    features: [
      '🎯 전용 얼굴교체 AI 모델',
      '💰 저렴한 비용 ($0.02/회)',
      '⚡ 빠른 처리 속도',
      '🛡️ 안전성 검사 내장',
      '📸 고품질 결과물',
      '🔧 간단한 API 구조'
    ],
    limitations: [
      '📤 HTTP URL 필요 (Base64 미지원)',
      '🌐 외부 이미지 호스팅 서비스 필요',
      '💳 사용량 기반 과금',
      '⏱️ 비동기 처리 (폴링 필요)'
    ],
    improvements: [
      '🔄 Firebase/Gemini 하이브리드 시스템 대체',
      '📉 복잡성 대폭 감소',
      '💵 예측 가능한 비용 구조',
      '🎯 얼굴교체 전용 최적화',
      '⚡ 더 빠른 응답 시간'
    ]
  };
};

/**
 * 연결 테스트
 */
export const testVModelConnection = async (): Promise<boolean> => {
  try {
    if (!VMODEL_API_TOKEN) {
      console.warn('VModel API 토큰이 없습니다.');
      return false;
    }

    // 간단한 API 호출로 연결 테스트 (실제 작업 생성하지 않음)
    const response = await fetch(`${VMODEL_API_BASE}/get/test-connection`, {
      headers: {
        'Authorization': `Bearer ${VMODEL_API_TOKEN}`,
      }
    });

    // 404나 403은 연결은 되지만 잘못된 요청임을 의미
    const isConnected = response.status === 404 || response.status === 403 || response.status === 200;
    
    console.log('VModel 연결 테스트:', {
      status: response.status,
      connected: isConnected
    });

    return isConnected;
  } catch (error) {
    console.error('VModel 연결 테스트 실패:', error);
    return false;
  }
};
