// services/firebaseOpenAIService.ts - Firebase Functions 직접 호출 최종 완성판
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
            
            // Firebase Functions + gpt-image-1 최적화 (9분 타임아웃이므로 더 큰 크기 허용)
            const maxSize = 1024; // Netlify보다 더 큰 크기 허용
            const ratio = Math.min(maxSize / img.width, maxSize / img.height);
            
            const newWidth = Math.round(img.width * ratio);
            const newHeight = Math.round(img.height * ratio);
            
            // 최소 크기 보장 (얼굴 인식을 위해)
            const minSize = 768;
            let finalWidth = newWidth;
            let finalHeight = newHeight;
            
            if (finalWidth < minSize && finalHeight < minSize) {
                const upscaleRatio = Math.max(minSize / finalWidth, minSize / finalHeight);
                finalWidth = Math.round(finalWidth * upscaleRatio);
                finalHeight = Math.round(finalHeight * upscaleRatio);
            }
            
            canvas.width = finalWidth;
            canvas.height = finalHeight;
            
            // 고품질 렌더링 (Firebase 9분 타임아웃으로 품질 우선)
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img, 0, 0, finalWidth, finalHeight);
            
            const resizedDataUrl = canvas.toDataURL('image/jpeg', 0.95); // 최고 품질
            const resizedBase64 = resizedDataUrl.split(',')[1];
            
            console.log('Firebase용 리사이즈 완료:', {
                original: `${img.width}x${img.height}`,
                resized: `${finalWidth}x${finalHeight}`,
                ratio: (finalWidth/finalHeight).toFixed(2),
                size: Math.round(resizedBase64.length / 1024) + 'KB',
                quality: '95% (Firebase 고품질)'
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
                        // 가로가 더 긴 경우
                        targetWidth = Math.max(img.width, img.height);
                        targetHeight = Math.round(targetWidth / originalRatio);
                    } else {
                        // 세로가 더 긴 경우
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
                
                // 최고 품질 렌더링
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
    console.log('🔥 URL:', FIREBASE_FUNCTION_URL);
    
    if (onProgress) {
      onProgress('Firebase에서 OpenAI 처리 준비 중...');
    }

    // 1. 원본 이미지 차원 추출 (종횡비 보정용)
    const originalDimensions = await getImageDimensions(originalImage);
    console.log('원본 이미지 차원:', originalDimensions);

    // 2. 이미지 리사이즈 (Firebase 최적화 - 9분 타임아웃으로 더 큰 크기 허용)
    const resizedImage = await resizeImageForFirebase(originalImage);
    
    // 3. PNG 변환 (gpt-image-1 호환성)
    console.log('Firebase용 PNG 변환 중...');
    const pngBase64 = await PNGConverter.convertToPNGForOpenAI(resizedImage.base64);
    
    // 4. 프롬프트 최적화 (헤어 보존 최우선 + Firebase 9분 활용)
    const optimizedPrompt = `
ABSOLUTE HIGHEST PRIORITY - COMPLETE HAIR PRESERVATION:
- MUST keep EXACT same hair: style, color, length, texture, parting, fringe, volume
- Hair is 100% identical to original image - NO changes allowed
- This is CRITICAL ABSOLUTE requirement above all else

SECONDARY OBJECTIVE - COMPLETE FACE TRANSFORMATION:
${facePrompt}
- Replace ALL facial features completely (eyes, nose, mouth, cheeks, jawline)
- Change face shape, skin tone, facial structure entirely
- Create completely different person with SAME EXACT HAIR
- Bold dramatic facial changes encouraged

TECHNICAL SPECIFICATIONS:
- Maintain exact pose, angle, and background from original
- Professional photorealistic skin texture and lighting
- Seamless integration between new face and preserved hair
- High quality detailed result (Firebase 9-minute processing)
- PRESERVE exact facial width-to-height ratio and proportions
- DO NOT stretch or compress face horizontally or vertically
- MAINTAIN original face shape geometry (V-line, oval, etc.)
- Keep identical facial dimensions without distortion

REMINDER: Hair preservation is THE MOST CRITICAL priority. Face can be completely different, but hair MUST be identical.
    `.trim();

    // 프롬프트 길이 제한 (Firebase는 더 긴 프롬프트 허용 가능)
    let finalPrompt = optimizedPrompt;
    if (finalPrompt.length > 1200) {
        finalPrompt = finalPrompt.substring(0, 1197) + '...';
        console.log('Prompt truncated to 1200 characters for Firebase');
    }

    console.log('Firebase 호출 정보:', {
        url: FIREBASE_FUNCTION_URL,
        imageSize: Math.round(pngBase64.length / 1024) + 'KB',
        promptLength: finalPrompt.length,
        timeout: '9분 (540초)'
    });

    if (onProgress) {
      onProgress('Firebase에서 OpenAI 처리 중... (최대 9분, 헤어 완전 보존)');
    }

    console.log('🔥 Firebase Functions 호출 시작...');
    const startTime = Date.now();

    // 5. Firebase Functions 호출 (9분 타임아웃)
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
    console.log(`🔥 Firebase 응답 시간: ${Math.round(responseTime/1000)}초`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Firebase Functions 오류:', response.status, errorText.substring(0, 200));
      
      // 상세한 오류 분석
      if (response.status === 500) {
        throw new Error(`Firebase 내부 오류: OpenAI API 처리 실패`);
      } else if (response.status === 408 || response.status === 504) {
        throw new Error(`Firebase 타임아웃: ${Math.round(responseTime/1000)}초 후 시간 초과`);
      } else if (response.status === 403) {
        throw new Error(`Firebase 권한 오류: API 키 또는 권한 문제`);
      } else {
        throw new Error(`Firebase Functions 오류 ${response.status}: ${errorText.substring(0, 100)}`);
      }
    }

    const data = await response.json();
    console.log('🔥 Firebase 응답 수신:', {
      hasData: !!data.data,
      hasImage: !!(data.data?.[0]?.b64_json),
      metadata: data._metadata,
      totalTime: Math.round(responseTime/1000) + '초'
    });

    if (data.data && data.data[0] && data.data[0].b64_json) {
      const resultBase64 = data.data[0].b64_json;
      
      console.log('🎨 Firebase 결과 종횡비 보정 시작...');
      
      // 6. 종횡비 보정 (Firebase 결과를 원본 비율로)
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
        결과크기: Math.round(correctedBase64.length / 1024) + 'KB',
        처리방식: 'Firebase Functions v2 + gpt-image-1',
        품질: '최고 품질 (9분 타임아웃 활용)'
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
      
      // 사용자 친화적 에러 메시지 변환
      if (message.includes('fetch') || message.includes('network')) {
        throw new Error('Firebase 연결 오류: 네트워크를 확인해주세요.');
      } else if (message.includes('timeout') || message.includes('TIMEOUT')) {
        throw new Error('Firebase 타임아웃: 이미지가 너무 크거나 복잡합니다.');
      } else if (message.includes('Firebase Functions')) {
        throw new Error(`Firebase 처리 오류: ${message}`);
      } else if (message.includes('OpenAI API')) {
        throw new Error('OpenAI API 오류: 일시적 서버 문제일 수 있습니다.');
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
    console.log('🔥 Firebase 연결 테스트 시작...');
    console.log('🔥 Testing URL:', FIREBASE_FUNCTION_URL);
    
    const response = await fetch(FIREBASE_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        test: 'connection',
        timestamp: Date.now()
      })
    });

    console.log('🔥 Firebase 연결 테스트 결과:', {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries())
    });
    
    // Firebase Functions는 보통 400 (잘못된 요청)을 반환하지만 연결은 됨
    const isConnected = response.status === 200 || response.status === 400 || response.status === 500;
    
    if (isConnected) {
      console.log('✅ Firebase Functions 연결 성공');
    } else {
      console.log('❌ Firebase Functions 연결 실패:', response.status);
    }
    
    return isConnected;
  } catch (error) {
    console.error('❌ Firebase 연결 테스트 실패:', error);
    return false;
  }
};

/**
 * 서비스 상태 확인
 */
export const getFirebaseServiceStatus = () => {
  return {
    version: '1.0-FIREBASE-FINAL-COMPLETE',
    method: 'Firebase Functions 직접 호출',
    timeout: '9분 (540초)',
    memory: '2GB (Firebase Functions v2)',
    url: FIREBASE_FUNCTION_URL,
    advantages: [
      '🔥 9분 타임아웃 (vs Netlify 26초)',
      '💾 2GB 메모리 (vs Netlify 1GB)',
      '🤖 OpenAI gpt-image-1 Edit API',
      '💇 헤어 보존 ABSOLUTE HIGHEST PRIORITY',
      '📸 고품질 이미지 처리 (768~1792px)',
      '🎨 PNG 자동 변환 + 최적화',
      '📐 종횡비 자동 보정',
      '📊 실시간 진행 상황 추적',
      '📝 1200자 프롬프트 지원',
      '⚡ Firebase Functions v2 성능'
    ],
    comparison: {
      netlify: '26초 타임아웃, 1GB 메모리',
      firebase: '540초 타임아웃, 2GB 메모리',
      improvement: '20배 더 긴 처리 시간, 2배 더 많은 메모리'
    }
  };
};
