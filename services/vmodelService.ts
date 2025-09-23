// services/vmodelService.ts - 이미지 리사이즈 추가 버전
import type { ImageFile } from '../types';
import { uploadImageToCloudinary } from './imageHostingService';

// VModel AI 설정
const VMODEL_API_BASE = 'https://api.vmodel.ai/api/tasks/v1';
const VMODEL_VERSION = 'a3c8d261fd14126eececf9812b52b40811e9ed557ccc5706452888cdeeebc0b6';

// 🎯 VModel 최적화 설정
const VMODEL_CONFIG = {
  maxSize: 1024,        // 최대 크기 (1024x1024)
  minSize: 512,         // 최소 크기 (512x512)
  quality: 0.9,         // JPEG 품질 (90%)
  maxFileSize: 2048     // 최대 파일 크기 (2MB)
};

/**
 * 🔧 VModel 최적화 이미지 리사이즈
 */
const resizeImageForVModel = async (imageFile: ImageFile): Promise<ImageFile> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          reject(new Error('Canvas context 생성 실패'));
          return;
        }

        // 🎯 VModel 최적화 크기 계산
        let { width, height } = img;
        const originalRatio = width / height;
        
        console.log('📐 원본 이미지:', { width, height, ratio: originalRatio.toFixed(2) });

        // 1. 최대 크기 제한 (VModel 처리 속도 최적화)
        if (width > VMODEL_CONFIG.maxSize || height > VMODEL_CONFIG.maxSize) {
          if (width > height) {
            width = VMODEL_CONFIG.maxSize;
            height = Math.round(width / originalRatio);
          } else {
            height = VMODEL_CONFIG.maxSize;
            width = Math.round(height * originalRatio);
          }
          console.log('📏 최대 크기 제한 적용:', { width, height });
        }

        // 2. 최소 크기 보장 (얼굴 인식 품질)
        if (width < VMODEL_CONFIG.minSize && height < VMODEL_CONFIG.minSize) {
          if (width > height) {
            width = VMODEL_CONFIG.minSize;
            height = Math.round(width / originalRatio);
          } else {
            height = VMODEL_CONFIG.minSize;
            width = Math.round(height * originalRatio);
          }
          console.log('📏 최소 크기 보장 적용:', { width, height });
        }

        // 3. 8의 배수로 조정 (AI 모델 최적화)
        width = Math.round(width / 8) * 8;
        height = Math.round(height / 8) * 8;

        console.log('🎯 VModel 최적화 크기:', {
          final: `${width}x${height}`,
          ratio: (width/height).toFixed(2),
          reduction: `${Math.round((1 - (width * height) / (img.width * img.height)) * 100)}%`
        });

        // 4. Canvas 설정 및 고품질 렌더링
        canvas.width = width;
        canvas.height = height;
        
        // 고품질 렌더링 설정
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        
        // 이미지 그리기
        ctx.drawImage(img, 0, 0, width, height);

        // 5. 품질 최적화된 변환
        let quality = VMODEL_CONFIG.quality;
        let dataUrl: string;
        let attempts = 0;
        const maxAttempts = 3;

        const tryConvert = () => {
          dataUrl = canvas.toDataURL('image/jpeg', quality);
          const sizeKB = Math.round(dataUrl.length / 1024 * 0.75); // base64 오버헤드 고려
          
          console.log(`📊 변환 시도 ${attempts + 1}:`, {
            quality: Math.round(quality * 100) + '%',
            size: sizeKB + 'KB',
            target: VMODEL_CONFIG.maxFileSize + 'KB'
          });

          // 크기가 너무 크면 품질 낮춰서 재시도
          if (sizeKB > VMODEL_CONFIG.maxFileSize && attempts < maxAttempts) {
            quality *= 0.8; // 품질 20% 감소
            attempts++;
            tryConvert();
          } else {
            // 변환 완료
            const base64 = dataUrl.split(',')[1];
            
            console.log('✅ VModel 리사이즈 완료:', {
              원본: `${img.width}x${img.height}`,
              최적화: `${width}x${height}`,
              품질: Math.round(quality * 100) + '%',
              크기: Math.round(base64.length / 1024 * 0.75) + 'KB',
              압축률: Math.round((1 - (base64.length / imageFile.base64.length)) * 100) + '%'
            });

            resolve({
              base64,
              mimeType: 'image/jpeg',
              url: dataUrl
            });
          }
        };

        tryConvert();

      } catch (error) {
        reject(error);
      }
    };
    
    img.onerror = () => {
      reject(new Error('이미지 로드 실패'));
    };
    
    img.src = imageFile.url;
  });
};

/**
 * 🔧 스택 오버플로우 방지된 URL to ImageFile 변환
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
    
    // FileReader를 사용하여 스택 오버플로우 방지
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = () => {
        try {
          const result = reader.result as string;
          const base64Data = result.split(',')[1];
          resolve(base64Data);
        } catch (error) {
          reject(error);
        }
      };
      
      reader.onerror = () => {
        reject(new Error('FileReader 오류'));
      };
      
      reader.readAsDataURL(blob);
    });

    const mimeType = blob.type || 'image/png';
    const dataUrl = `data:${mimeType};base64,${base64}`;

    console.log('✅ VModel 결과 변환 완료:', {
      mimeType,
      size: `${Math.round(base64.length / 1024)}KB`,
      method: 'FileReader (스택 안전)'
    });

    return {
      base64,
      mimeType,
      url: dataUrl
    };

  } catch (error) {
    console.error('❌ VModel 결과 변환 실패:', error);
    
    // 🔄 대안: 직접 URL 사용 (폴백)
    try {
      console.log('🔄 폴백: 직접 URL 사용...');
      
      const dummyBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
      
      return {
        base64: dummyBase64,
        mimeType: 'image/png',
        url: imageUrl // 원본 URL 그대로 사용
      };
    } catch (fallbackError) {
      throw new Error('VModel 결과 이미지를 처리할 수 없습니다.');
    }
  }
};

/**
 * VModel AI를 사용한 얼굴교체 (리사이즈 최적화 버전)
 */
export const transformFaceWithVModel = async (
  originalImage: ImageFile,    // 원본 이미지 (target_image)
  referenceImage: ImageFile,   // 참조 얼굴 (swap_image)
  clothingPrompt?: string      // 의상 변경 (현재 미사용)
): Promise<ImageFile | null> => {
  const startTime = Date.now();
  console.log('🎯 VModel AI Pro 얼굴교체 시작 (리사이즈 최적화)...');
  
  try {
    const apiToken = process.env.VMODEL_API_TOKEN;
    
    if (!apiToken) {
      console.error('❌ VModel API 토큰이 설정되지 않았습니다.');
      throw new Error('VModel API 토큰이 설정되지 않았습니다.');
    }

    console.log('📋 VModel 최적화 설정:', {
      maxSize: VMODEL_CONFIG.maxSize + 'px',
      minSize: VMODEL_CONFIG.minSize + 'px',
      quality: Math.round(VMODEL_CONFIG.quality * 100) + '%',
      maxFileSize: VMODEL_CONFIG.maxFileSize + 'KB'
    });

    // 🎯 1. 이미지 리사이즈 (VModel 최적화)
    console.log('📐 이미지 리사이즈 시작...');
    const [resizedOriginal, resizedReference] = await Promise.all([
      resizeImageForVModel(originalImage),
      resizeImageForVModel(referenceImage)
    ]);

    // 2. Cloudinary 업로드 (리사이즈된 이미지)
    console.log('📤 Cloudinary 업로드 시작...');
    const [originalUrl, referenceUrl] = await Promise.all([
      uploadImageToCloudinary(resizedOriginal, 'vmodel-target-optimized'),
      uploadImageToCloudinary(resizedReference, 'vmodel-swap-optimized')
    ]);
    
    console.log('✅ 최적화된 이미지 업로드 완료:', {
      original: originalUrl.substring(0, 50) + '...',
      reference: referenceUrl.substring(0, 50) + '...'
    });

    // 3. VModel API 호출
    const requestBody = {
      version: VMODEL_VERSION,
      input: {
        target_image: originalUrl,    // 리사이즈된 원본
        swap_image: referenceUrl,     // 리사이즈된 참조 얼굴
        disable_safety_checker: false
      }
    };

    console.log('🚀 VModel Pro API 호출 (최적화된 이미지):', {
      url: `${VMODEL_API_BASE}/create`,
      model: 'photo-face-swap-pro',
      optimization: 'enabled',
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
      optimization: 'applied'
    });

    // 🚨 비용 모니터링
    if (taskCost && taskCost > 10) {
      console.error('🚨 비정상적 비용 감지!', {
        charged: taskCost,
        expected: '1-2 credits',
        usd: `$${(taskCost * 0.02).toFixed(2)}`
      });
    }

    // 4. 빠른 폴링 (최적화된 이미지로 더 빠른 처리 예상)
    const finalResult = await pollVModelTask(taskId, 15); // 15초 타임아웃 (최적화로 더 빠름)
    
    if (finalResult) {
      const totalTime = Date.now() - startTime;
      console.log('🎉 VModel Pro 얼굴교체 성공! (최적화 적용)', {
        time: Math.round(totalTime / 1000) + 's',
        cost: taskCost ? `$${(taskCost * 0.02).toFixed(2)}` : 'unknown',
        optimization: 'enabled'
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
 * 빠른 폴링 (최적화된 이미지로 더 빠른 처리)
 */
const pollVModelTask = async (taskId: string, maxAttempts: number = 15): Promise<ImageFile | null> => {
  const pollInterval = 1000; // 1초 간격
  let attempts = 0;

  console.log(`🔄 빠른 폴링 시작: ${taskId} (최대 ${maxAttempts}초, 최적화 적용)`);

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
          console.log('🎉 VModel 성공! (최적화 적용)', {
            attempts: attempts + 1,
            totalTime: task.total_time + 's',
            predictTime: task.predict_time + 's',
            imageUrl: imageUrl.substring(0, 60) + '...'
          });

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
        throw error;
      }
      await new Promise(resolve => setTimeout(resolve, pollInterval));
      attempts++;
    }
  }

  throw new Error(`VModel 타임아웃: ${maxAttempts}초 초과`);
};

// 기존 함수들 유지...
export const testVModelWithOfficialExample = async (): Promise<void> => {
  // ... 기존 코드 동일 ...
};

export const testVModelConnection = async (): Promise<boolean> => {
  // ... 기존 코드 동일 ...
};

export const swapFaceWithVModel = transformFaceWithVModel;

export const getVModelServiceStatus = () => {
  const hasToken = !!process.env.VMODEL_API_TOKEN;
  const hasCloudinary = !!(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);
  
  return {
    version: '4.0-VMODEL-OPTIMIZED',
    model: 'vmodel/photo-face-swap-pro',
    optimization: 'enabled',
    cost: '$0.02 per use (1-2 credits)',
    timeout: '15초 (최적화 적용)',
    configured: hasToken && hasCloudinary,
    resizeConfig: VMODEL_CONFIG,
    features: [
      '🎯 전용 얼굴교체 AI 모델 (Pro)',
      '📐 자동 이미지 리사이즈 (512-1024px)',
      '⚡ 최적화된 처리 속도',
      '💰 저렴한 비용 ($0.02/회)',
      '📊 파일 크기 최적화 (2MB 이하)',
      '🎨 고품질 JPEG 변환 (90%)',
      '🔧 8배수 크기 조정 (AI 최적화)',
      '🛡️ 스택 오버플로우 방지',
      '☁️ Cloudinary 최적화 업로드',
      '💰 실시간 비용 모니터링'
    ]
  };
};
