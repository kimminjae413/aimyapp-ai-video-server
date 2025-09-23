// services/vmodelService.ts - VModel AI 얼굴교체 최종 완성 버전
import type { ImageFile } from '../types';
import { uploadImageToCloudinary } from './imageHostingService';

// VModel AI 설정 (올바른 Pro 모델 사용)
const VMODEL_API_BASE = 'https://api.vmodel.ai/api/tasks/v1';
const VMODEL_VERSION = 'a3c8d261fd14126eececf9812b52b40811e9ed557ccc5706452888cdeeebc0b6'; // Pro 모델 버전

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
 * 🧪 VModel 공식 예시 테스트 - 4000 크레딧 문제 진단
 */
export const testVModelWithOfficialExample = async (): Promise<void> => {
  console.log('🧪 VModel 공식 예시 테스트 시작...');
  
  // 공식 문서와 100% 동일한 요청
  const officialRequest = {
    version: "a3c8d261fd14126eececf9812b52b40811e9ed557ccc5706452888cdeeebc0b6",
    input: {
      swap_image: "https://data.vmodel.ai/data/model-example/vmodel/photo-face-swap-pro/swap_image.png",
      target_image: "https://vmodel.ai/data/model/vmodel/photo-face-swap-pro/target_image.png",
      disable_safety_checker: false
    }
  };

  console.log('📋 공식 예시 요청:', {
    version: officialRequest.version.substring(0, 10) + '...',
    model: 'vmodel/photo-face-swap-pro',
    expectedCost: '$0.02 (1-2 credits)',
    swapImage: officialRequest.input.swap_image.substring(0, 50) + '...',
    targetImage: officialRequest.input.target_image.substring(0, 50) + '...'
  });

  try {
    const startTime = Date.now();
    
    const response = await fetch('https://api.vmodel.ai/api/tasks/v1/create', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.VMODEL_API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(officialRequest)
    });

    const responseTime = Date.now() - startTime;
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ 공식 예시 API 오류:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText.substring(0, 200),
        tokenValid: !!process.env.VMODEL_API_TOKEN
      });
      return;
    }

    const result = await response.json();
    
    console.log('🔍 공식 예시 응답 분석:', {
      responseTime: responseTime + 'ms',
      taskId: result.task_id || result.result?.task_id,
      userId: result.user_id,
      version: result.version,
      status: result.status,
      cost: result.task_cost || result.result?.task_cost,
      costUSD: (result.task_cost || result.result?.task_cost) ? `$${((result.task_cost || result.result?.task_cost) * 0.02).toFixed(4)}` : 'unknown',
      error: result.error,
      hasOutput: !!result.output,
      fullResponse: result
    });

    // 🚨 비용 분석
    const actualCost = result.task_cost || result.result?.task_cost;
    if (actualCost) {
      const costAnalysis = {
        credits: actualCost,
        usd: (actualCost * 0.02).toFixed(4),
        expected: '1-2 credits ($0.02-$0.04)',
        isNormal: actualCost <= 2,
        severity: actualCost > 100 ? '🚨 CRITICAL' : actualCost > 10 ? '⚠️ HIGH' : '✅ NORMAL'
      };
      
      console.log('💰 공식 예시 비용 분석:', costAnalysis);
      
      if (actualCost > 10) {
        console.error('🚨 공식 예시도 비정상 비용 발생!', {
          charged: actualCost,
          expected: '1-2 credits',
          possibleIssues: [
            '잘못된 API 키 (다른 모델용)',
            '계정 설정 문제',
            'API 버전 불일치',
            'VModel 서버 이슈'
          ]
        });
      }
    } else {
      console.warn('⚠️ 공식 예시 응답에 비용 정보 없음');
    }

    // 작업 ID가 있으면 빠른 상태 확인 (3초만)
    const taskId = result.task_id || result.result?.task_id;
    if (taskId) {
      console.log('🔄 공식 예시 작업 상태 빠른 확인...');
      setTimeout(async () => {
        try {
          const statusResponse = await fetch(`https://api.vmodel.ai/api/tasks/v1/get/${taskId}`, {
            headers: {
              'Authorization': `Bearer ${process.env.VMODEL_API_TOKEN}`
            }
          });
          
          if (statusResponse.ok) {
            const statusData = await statusResponse.json();
            console.log('📊 공식 예시 3초 후 상태:', {
              status: statusData.result?.status,
              totalTime: statusData.result?.total_time,
              hasOutput: !!statusData.result?.output
            });
          }
        } catch (error) {
          console.log('⚠️ 상태 확인 건너뜀:', error);
        }
      }, 3000);
    }

  } catch (error) {
    console.error('❌ 공식 예시 테스트 실패:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      tokenConfigured: !!process.env.VMODEL_API_TOKEN
    });
  }
};

/**
 * VModel AI를 사용한 얼굴교체 (개선된 메인 함수)
 */
export const transformFaceWithVModel = async (
  originalImage: ImageFile,    // 원본 이미지 (target_image)
  referenceImage: ImageFile,   // 참조 얼굴 (swap_image)
  clothingPrompt?: string      // 의상 변경 (현재 미사용)
): Promise<ImageFile | null> => {
  const startTime = Date.now();
  console.log('🎯 VModel AI Pro 얼굴교체 시작...');
  
  try {
    const apiToken = process.env.VMODEL_API_TOKEN;
    
    if (!apiToken) {
      console.error('❌ VModel API 토큰이 설정되지 않았습니다.');
      throw new Error('VModel API 토큰이 설정되지 않았습니다.');
    }

    console.log('📋 VModel 요청 정보:', {
      model: 'vmodel/photo-face-swap-pro',
      version: VMODEL_VERSION.substring(0, 12) + '...',
      expectedCost: '$0.02 (1-2 credits)',
      expectedTime: '3-5초',
      hasToken: !!apiToken,
      hasCloudinary: !!(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY)
    });

    // 1. Cloudinary 업로드
    console.log('📤 Cloudinary 업로드 시작...');
    const [originalUrl, referenceUrl] = await Promise.all([
      uploadImageToCloudinary(originalImage, 'vmodel-target'),
      uploadImageToCloudinary(referenceImage, 'vmodel-swap')
    ]);
    
    console.log('✅ Cloudinary 업로드 완료:', {
      original: originalUrl.substring(0, 50) + '...',
      reference: referenceUrl.substring(0, 50) + '...'
    });

    // 2. VModel API 호출 (올바른 Pro 모델)
    const requestBody = {
      version: VMODEL_VERSION,
      input: {
        target_image: originalUrl,    // 원본 이미지
        swap_image: referenceUrl,     // 참조 얼굴
        disable_safety_checker: false
      }
    };

    console.log('🚀 VModel Pro API 호출:', {
      url: `${VMODEL_API_BASE}/create`,
      model: 'photo-face-swap-pro',
      version: VMODEL_VERSION.substring(0, 10) + '...',
      expectedCost: '$0.02'
    });

    const response = await fetch(`${VMODEL_API_BASE}/create`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ VModel API 오류:', response.status, errorText);
      
      if (response.status === 401) {
        throw new Error('VModel API 토큰이 유효하지 않습니다.');
      } else if (response.status === 400) {
        throw new Error('이미지 형식이 올바르지 않습니다.');
      } else {
        throw new Error(`VModel API 오류: ${response.status}`);
      }
    }

    const result = await response.json();
    const taskId = result.task_id || result.result?.task_id;
    const taskCost = result.task_cost || result.result?.task_cost;

    if (!taskId) {
      console.error('❌ Task ID 없음:', result);
      throw new Error('VModel task 생성 실패');
    }

    console.log('✅ VModel Pro 작업 생성:', {
      taskId: taskId,
      cost: taskCost ? `${taskCost} credits ($${(taskCost * 0.02).toFixed(2)})` : 'unknown',
      model: 'photo-face-swap-pro'
    });

    // 🚨 비용 모니터링
    if (taskCost && taskCost > 10) {
      console.error('🚨 비정상적 비용 감지!', {
        charged: taskCost,
        expected: '1-2 credits',
        usd: `$${(taskCost * 0.02).toFixed(2)}`
      });
    }

    // 3. 빠른 폴링 (정상은 3-5초면 완료)
    const finalResult = await pollVModelTask(taskId, 20); // 20초 타임아웃
    
    if (finalResult) {
      const totalTime = Date.now() - startTime;
      console.log('🎉 VModel Pro 얼굴교체 성공!', {
        time: Math.round(totalTime / 1000) + 's',
        cost: taskCost ? `$${(taskCost * 0.02).toFixed(2)}` : 'unknown',
        model: 'photo-face-swap-pro'
      });
      
      return finalResult;
    }

    throw new Error('VModel 결과를 받지 못했습니다');

  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error('❌ VModel Pro 얼굴교체 실패:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      time: Math.round(totalTime / 1000) + 's'
    });
    throw error;
  }
};

/**
 * 빠른 폴링 (정상은 3-5초면 완료)
 */
const pollVModelTask = async (taskId: string, maxAttempts: number = 20): Promise<ImageFile | null> => {
  const pollInterval = 1000; // 1초 간격
  let attempts = 0;

  console.log(`🔄 빠른 폴링 시작: ${taskId} (최대 ${maxAttempts}초)`);

  while (attempts < maxAttempts) {
    try {
      console.log(`📍 폴링 ${attempts + 1}/${maxAttempts}...`);
      
      const response = await fetch(`${VMODEL_API_BASE}/get/${taskId}`, {
        headers: {
          'Authorization': `Bearer ${process.env.VMODEL_API_TOKEN}`
        }
      });

      if (!response.ok) {
        console.warn(`⚠️ 폴링 HTTP 오류: ${response.status}, 재시도...`);
        await new Promise(resolve => setTimeout(resolve, pollInterval));
        attempts++;
        continue;
      }

      const result = await response.json();
      const task = result.result || result;
      const status = task.status;

      console.log(`📊 폴링 ${attempts + 1}:`, {
        status: status,
        totalTime: task.total_time,
        predictTime: task.predict_time,
        hasOutput: !!task.output,
        error: task.error
      });

      if (status === 'succeeded') {
        if (task.output && task.output.length > 0) {
          const imageUrl = task.output[0];
          console.log('🎉 VModel 성공!', {
            attempts: attempts + 1,
            totalTime: task.total_time + 's',
            predictTime: task.predict_time + 's',
            imageUrl: imageUrl.substring(0, 60) + '...'
          });

          // URL을 ImageFile로 변환
          return await convertUrlToImageFile(imageUrl);
        }
      }

      if (status === 'failed') {
        throw new Error(`VModel 작업 실패: ${task.error || 'Unknown error'}`);
      }

      await new Promise(resolve => setTimeout(resolve, pollInterval));
      attempts++;
    } catch (error) {
      console.error(`❌ 폴링 중 오류 (시도 ${attempts + 1}):`, error);
      if (attempts >= maxAttempts - 3) {
        // 마지막 3회 시도에서는 오류를 throw
        throw error;
      }
      await new Promise(resolve => setTimeout(resolve, pollInterval));
      attempts++;
    }
  }

  throw new Error(`VModel 타임아웃: ${maxAttempts}초 초과`);
};

/**
 * URL을 ImageFile로 변환
 */
const convertUrlToImageFile = async (imageUrl: string): Promise<ImageFile> => {
  try {
    console.log('📥 VModel 결과 이미지 다운로드...');
    
    const response = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (!response.ok) {
      throw new Error(`결과 이미지 다운로드 실패: ${response.status}`);
    }

    const blob = await response.blob();
    const arrayBuffer = await blob.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

    const mimeType = blob.type || 'image/png';
    const dataUrl = `data:${mimeType};base64,${base64}`;

    console.log('✅ VModel 결과 변환 완료:', {
      mimeType,
      size: `${Math.round(base64.length / 1024)}KB`
    });

    return {
      base64,
      mimeType,
      url: dataUrl
    };

  } catch (error) {
    console.error('❌ VModel 결과 변환 실패:', error);
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

    // 간단한 헬스체크
    const response = await fetch(`${VMODEL_API_BASE}/get/health-check-test`, {
      headers: {
        'Authorization': `Bearer ${apiToken}`,
      }
    });

    // 404는 정상 (API는 작동하지만 task가 없음)
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
 * 호환성 유지를 위한 별칭
 */
export const swapFaceWithVModel = transformFaceWithVModel;

/**
 * VModel 서비스 상태 확인
 */
export const getVModelServiceStatus = () => {
  const hasToken = !!process.env.VMODEL_API_TOKEN;
  const hasCloudinary = !!(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);
  
  return {
    version: '3.0-VMODEL-PRO-FINAL',
    model: 'vmodel/photo-face-swap-pro',
    modelVersion: VMODEL_VERSION,
    cost: '$0.02 per use (1-2 credits)',
    timeout: '20초 (정상 3-5초)',
    configured: hasToken && hasCloudinary,
    hasApiToken: hasToken,
    hasCloudinary: hasCloudinary,
    features: [
      '🎯 전용 얼굴교체 AI 모델 (Pro)',
      '💰 저렴한 비용 ($0.02/회)',
      '⚡ 초고속 처리 (3-5초)',
      '🛡️ 안전성 검사 내장',
      '📸 최고품질 결과물',
      '☁️ Cloudinary 이미지 호스팅',
      '🔄 최적화된 폴링 (1초 간격)',
      '🎨 자동 이미지 형식 변환',
      '🧪 공식 예시 테스트 내장',
      '💰 비용 모니터링 시스템'
    ],
    diagnostics: [
      '🔍 API 연결 상태 확인',
      '🧪 공식 예시 자동 테스트',
      '💰 실시간 비용 모니터링',
      '⏱️ 처리 시간 추적',
      '🚨 비정상 비용 경고 시스템'
    ]
  };
};
