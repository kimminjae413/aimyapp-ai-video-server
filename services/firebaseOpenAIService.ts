// services/firebaseOpenAIService.ts - Firebase Functions 직접 호출 (완성 버전)
import { PNGConverter } from '../utils/pngConverter';
import type { ImageFile } from '../types';

const FIREBASE_FUNCTION_URL = 'https://us-central1-hgfaceswap-functions.cloudfunctions.net/openaiProxy';

/**
 * 이미지 차원 추출
 */
const getImageDimensions = (imageFile: ImageFile): Promise<{width: number, height: number}> => {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            resolve({ width: img.width, height: img.height });
        };
        img.src = imageFile.url;
    });
};

/**
 * Firebase gpt-image-1용 리사이즈 최적화
 */
const resizeImageForFirebase = (originalImage: ImageFile): Promise<ImageFile> => {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d')!;
            
            // Firebase Functions + gpt-image-1 최적화
            const maxSize = 1536; // 더 큰 크기 허용 (9분 타임아웃)
            const ratio = Math.min(maxSize / img.width, maxSize / img.height);
            
            const newWidth = Math.round(img.width * ratio);
            const newHeight = Math.round(img.height * ratio);
            
            // 최소 크기 보장
            const minSize = 512;
            let finalWidth = newWidth;
            let finalHeight = newHeight;
            
            if (finalWidth < minSize && finalHeight < minSize) {
                const upscaleRatio = Math.max(minSize / finalWidth, minSize / finalHeight);
                finalWidth = Math.round(finalWidth * upscaleRatio);
                finalHeight = Math.round(finalHeight * upscaleRatio);
            }
            
            canvas.width = finalWidth;
            canvas.height = finalHeight;
            
            // 고품질 렌더링
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img, 0, 0, finalWidth, finalHeight);
            
            const resizedDataUrl = canvas.toDataURL('image/jpeg', 0.95);
            const resizedBase64 = resizedDataUrl.split(',')[1];
            
            console.log('Firebase용 리사이즈 완료:', {
                original: `${img.width}x${img.height}`,
                resized: `${finalWidth}x${finalHeight}`,
                ratio: (finalWidth/finalHeight).toFixed(2),
                size: Math.round(resizedBase64.length / 1024) + 'KB'
            });
            
            resolve({
                base64: resizedBase64,
                mimeType: 'image/jpeg',
                url: resizedDataUrl
            });
        };
        img.src = originalImage.url;
    });
};

/**
 * 종횡비 보정 (Firebase 결과물을 원본 비율로 복원)
 */
const correctAspectRatio = (
    resultImageBase64: string, 
    originalWidth: number, 
    originalHeight: number
): Promise<string> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            try {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d')!;
                
                const originalRatio = originalWidth / originalHeight;
                const currentRatio = img.width / img.height;
                
                console.log('Firebase 결과 종횡비 분석:', {
                    원본: `${originalWidth}x${originalHeight} (${originalRatio.toFixed(2)})`,
                    Firebase결과: `${img.width}x${img.height} (${currentRatio.toFixed(2)})`,
                    보정필요: Math.abs(originalRatio - currentRatio) > 0.1
                });
                
                // 종횡비가 다르면 보정
                if (Math.abs(originalRatio - currentRatio) > 0.1) {
                    let targetWidth, targetHeight;
                    
                    if (originalRatio > 1) {
                        targetWidth = Math.max(img.width, img.height);
                        targetHeight = Math.round(targetWidth / originalRatio);
                    } else {
                        targetHeight = Math.max(img.width, img.height);
                        targetWidth = Math.round(targetHeight * originalRatio);
                    }
                    
                    canvas.width = targetWidth;
                    canvas.height = targetHeight;
                    console.log('🔧 Firebase 종횡비 보정:', `${targetWidth}x${targetHeight}`);
                } else {
                    canvas.width = img.width;
                    canvas.height = img.height;
                    console.log('✅ Firebase 종횡비 보정 불필요');
                }
                
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                
                const correctedDataUrl = canvas.toDataURL('image/png', 1.0);
                const correctedBase64 = correctedDataUrl.split(',')[1];
                
                resolve(correctedBase64);
            } catch (error) {
                reject(error);
            }
        };
        
        img.onerror = () => reject(new Error('Firebase 결과 이미지 로드 실패'));
        img.src = `data:image/png;base64,${resultImageBase64}`;
    });
};

/**
 * Firebase Functions를 통한 OpenAI gpt-image-1 호출 (9분 타임아웃)
 */
export const transformFaceWithFirebase = async (
  originalImage: ImageFile,
  facePrompt: string,
  onProgress?: (status: string) => void
): Promise<ImageFile | null> => {
  try {
    console.log('🔥 Firebase Functions OpenAI 변환 시작...');
    
    if (onProgress) {
      onProgress('Firebase에서 OpenAI 처리 준비 중...');
    }

    // 1. 원본 이미지 차원 추출
    const originalDimensions = await getImageDimensions(originalImage);
    console.log('원본 이미지 차원:', originalDimensions);

    // 2. 이미지 리사이즈 (Firebase 최적화)
    const resizedImage = await resizeImageForFirebase(originalImage);
    
    // 3. PNG 변환 (gpt-image-1 호환성)
    console.log('Firebase용 PNG 변환 중...');
    const pngBase64 = await PNGConverter.convertToPNGForOpenAI(resizedImage.base64);
    
    // 4. 프롬프트 최적화 (헤어 보존 최우선)
    const optimizedPrompt = `
HIGHEST PRIORITY - HAIR PRESERVATION:
- Keep EXACT same hair: style, color, length, texture, parting, fringe
- Hair must remain 100% identical to original image
- This is ABSOLUTE CRITICAL requirement

SECONDARY - FACE TRANSFORMATION:
${facePrompt}
- Replace facial features completely
- Change face shape, eyes, nose, mouth, jawline, skin tone
- Create entirely different person with SAME EXACT HAIR

TECHNICAL REQUIREMENTS:
- Keep pose, angle, and background identical
- Photorealistic skin texture and lighting
- Bold facial changes only, preserve everything else
- Professional photo quality

Hair preservation is the MOST CRITICAL priority above all else.
    `.trim();

    // 프롬프트 길이 제한
    let finalPrompt = optimizedPrompt;
    if (finalPrompt.length > 1000) {
        finalPrompt = finalPrompt.substring(0, 997) + '...';
        console.log('Prompt truncated to 1000 characters');
    }

    console.log('Firebase 호출 정보:', {
        url: FIREBASE_FUNCTION_URL,
        imageSize: Math.round(pngBase64.length / 1024) + 'KB',
        promptLength: finalPrompt.length
    });

    if (onProgress) {
      onProgress('Firebase에서 OpenAI 처리 중... (최대 9분, 헤어 완전 보존)');
    }

    console.log('📤 Firebase Functions 호출 중...');
    const startTime = Date.now();

    // 5. Firebase Functions 호출
    const response = await fetch(FIREBASE_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        imageBase64: pngBase64,
        prompt: finalPrompt
      })
    });

    const responseTime = Date.now() - startTime;
    console.log(`⚡ Firebase 응답 시간: ${Math.round(responseTime/1000)}초`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Firebase Functions 오류:', response.status, errorText);
      throw new Error(`Firebase Functions 오류: ${response.status} - ${errorText.substring(0, 100)}`);
    }

    const data = await response.json();
    console.log('📥 Firebase 응답 수신:', {
      hasData: !!data.data,
      hasImage: !!(data.data?.[0]?.b64_json),
      metadata: data._metadata
    });

    if (data.data && data.data[0] && data.data[0].b64_json) {
      const resultBase64 = data.data[0].b64_json;
      
      console.log('🎨 Firebase 결과 종횡비 보정 중...');
      
      // 6. 종횡비 보정
      const correctedBase64 = await correctAspectRatio(
        resultBase64,
        originalDimensions.width,
        originalDimensions.height
      );
      
      if (onProgress) {
        onProgress('Firebase 변환 완료!');
      }

      console.log('✅ Firebase OpenAI 변환 완료:', {
        총소요시간: Math.round(responseTime/1000) + '초',
        결과크기: Math.round(correctedBase64.length / 1024) + 'KB'
      });

      return {
        base64: correctedBase64,
        mimeType: 'image/png',
        url: `data:image/png;base64,${correctedBase64}`
      };
    } else {
      throw new Error('Firebase 응답에 이미지 데이터가 없습니다.');
    }

  } catch (error) {
    console.error('❌ Firebase OpenAI 변환 실패:', error);
    
    if (error instanceof Error) {
      const message = error.message;
      
      if (message.includes('timeout') || message.includes('TIMEOUT')) {
        throw new Error('Firebase 타임아웃: 이미지가 너무 크거나 복잡합니다.');
      } else if (message.includes('Firebase Functions')) {
        throw new Error(`Firebase 오류: ${message}`);
      } else if (message.includes('fetch')) {
        throw new Error('Firebase 연결 오류: 네트워크를 확인해주세요.');
      }
    }
    
    throw error;
  }
};

/**
 * Firebase 서비스 연결 테스트
 */
export const testFirebaseConnection = async (): Promise<boolean> => {
  try {
    console.log('🔥 Firebase 연결 테스트...');
    
    const response = await fetch(FIREBASE_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ test: 'connection' })
    });

    console.log('Firebase 연결 테스트 결과:', response.status);
    return response.status === 200 || response.status === 400; // 400도 연결됨을 의미
  } catch (error) {
    console.error('Firebase 연결 테스트 실패:', error);
    return false;
  }
};

/**
 * 서비스 상태 확인
 */
export const getFirebaseServiceStatus = () => {
  return {
    version: '1.0-FIREBASE-COMPLETE',
    method: 'Firebase Functions 직접 호출',
    timeout: '9분 (540초)',
    memory: '2GB',
    url: FIREBASE_FUNCTION_URL,
    features: [
      'Firebase Functions v2',
      '9분 타임아웃 (vs Netlify 26초)',
      '2GB 메모리 할당',
      'OpenAI gpt-image-1 Edit API',
      '헤어 보존 HIGHEST PRIORITY',
      '자동 이미지 리사이즈 (512~1536px)',
      'PNG 자동 변환',
      '종횡비 자동 보정',
      '실시간 진행 상황 추적',
      '1000자 프롬프트 최적화'
    ]
  };
};
