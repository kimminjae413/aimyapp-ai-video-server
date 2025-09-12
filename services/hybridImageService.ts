// services/hybridImageService.ts - 캐시 버스트 추가 + 비동기 통합 최종판
console.log('🚀 HYBRID SERVICE VERSION: 4.0 - 비동기 gpt-image-1 + Gemini Image');
console.log('📅 BUILD: 2025-09-12-18:40 - FINAL COMPLETE VERSION');
console.log('🔥 FORCE CACHE BUST: 2025-09-12-18:40');

// services/hybridImageService.ts - 최종 완성 버전 (비동기 gpt-image-1 + 기존 기능 통합)
import { changeClothingOnly, changeFaceInImage } from './geminiService';
import { generateImageAsync, createProgressTracker } from './asyncOpenAIService';
import { PNGConverter } from '../utils/pngConverter';
import type { ImageFile } from '../types';

/**
 * 이미지 차원 추출 함수
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
 * gpt-image-1 전용 리사이즈 (기존 방식 개선)
 */
const resizeImageForGPTImage1 = (originalImage: ImageFile): Promise<ImageFile> => {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d')!;
            
            // gpt-image-1 최적화: 더 큰 크기 허용하지만 4MB 제한 고려
            const maxSize = 1536; // 기존 1024에서 증가
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
            
            // 고품질 렌더링 (gpt-image-1용)
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img, 0, 0, finalWidth, finalHeight);
            
            const resizedDataUrl = canvas.toDataURL('image/jpeg', 0.9); // 고품질 유지
            const resizedBase64 = resizedDataUrl.split(',')[1];
            
            console.log('gpt-image-1용 리사이즈 완료:', {
                original: `${img.width}x${img.height}`,
                resized: `${finalWidth}x${finalHeight}`,
                ratio: (finalWidth/finalHeight).toFixed(2),
                originalSize: Math.round(originalImage.base64.length / 1024) + 'KB',
                resizedSize: Math.round(resizedBase64.length / 1024) + 'KB'
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
 * 종횡비 보정 함수 - gpt-image-1 결과물을 원본 비율로 복원
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
                
                // 원본 종횡비 계산
                const originalRatio = originalWidth / originalHeight;
                const currentRatio = img.width / img.height;
                
                console.log('종횡비 분석:', {
                    원본: `${originalWidth}x${originalHeight} (${originalRatio.toFixed(2)})`,
                    gpt결과: `${img.width}x${img.height} (${currentRatio.toFixed(2)})`,
                    보정필요: Math.abs(originalRatio - currentRatio) > 0.15
                });
                
                // 종횡비가 크게 다르면 보정, 비슷하면 그대로
                if (Math.abs(originalRatio - currentRatio) > 0.15) {
                    // 원본 비율로 보정
                    let targetWidth, targetHeight;
                    
                    if (originalRatio > 1) {
                        // 가로가 더 긴 경우
                        targetWidth = Math.max(img.width, img.height);
                        targetHeight = Math.round(targetWidth / originalRatio);
                    } else {
                        // 세로가 더 긴 경우 (현재 케이스)
                        targetHeight = Math.max(img.width, img.height);
                        targetWidth = Math.round(targetHeight * originalRatio);
                    }
                    
                    canvas.width = targetWidth;
                    canvas.height = targetHeight;
                    
                    console.log('🔧 종횡비 보정 실행:', `${targetWidth}x${targetHeight}`);
                } else {
                    // 비율이 비슷하면 원본 크기 유지
                    canvas.width = img.width;
                    canvas.height = img.height;
                    
                    console.log('✅ 종횡비 보정 불필요 - 원본 유지');
                }
                
                // 고품질 렌더링
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
        
        img.onerror = () => reject(new Error('이미지 로드 실패'));
        img.src = `data:image/png;base64,${resultImageBase64}`;
    });
};

/**
 * 비동기 OpenAI를 사용한 얼굴 변환 (1분+ 대기 가능) - 전처리 통합
 */
const transformFaceWithAsyncOpenAI = async (
  originalImage: ImageFile,
  facePrompt: string,
  onProgress?: (status: string) => void
): Promise<ImageFile | null> => {
  try {
    console.log('🎯 비동기 OpenAI 얼굴 변환 시작...');
    
    // 1. 원본 이미지 차원 추출 (종횡비 보정용)
    const originalDimensions = await getImageDimensions(originalImage);
    console.log('원본 이미지 차원:', originalDimensions);
    
    // 2. 이미지 리사이즈 (gpt-image-1 최적화)
    const resizedImage = await resizeImageForGPTImage1(originalImage);
    
    // 3. PNG 형식으로 변환 (gpt-image-1 호환성)
    console.log('gpt-image-1용 PNG 변환 중...');
    const pngBase64 = await PNGConverter.convertToPNGForOpenAI(resizedImage.base64);
    
    // 4. 프롬프트 최적화 (헤어 보존 최우선 + 1000자 제한)
    let optimizedPrompt = `
HIGHEST PRIORITY - HAIR PRESERVATION:
- Keep EXACT same hair: style, color, length, texture, parting
- Hair must remain 100% identical to original
- This is ABSOLUTE requirement

SECONDARY - FACE TRANSFORMATION:
${facePrompt}
- Replace facial features completely
- Change face shape, eyes, nose, mouth, skin
- Create different person with same hair

TECHNICAL:
- Keep pose and background
- Photorealistic skin texture
- Bold facial changes only

Hair preservation is CRITICAL priority.
    `.trim();

    // 프롬프트 길이 제한 (1000자)
    if (optimizedPrompt.length > 1000) {
        optimizedPrompt = optimizedPrompt.substring(0, 997) + '...';
        console.log('Prompt truncated to 1000 characters');
    }

    console.log('Final prompt length:', optimizedPrompt.length, 'characters');
    console.log('📤 Starting async OpenAI generation with preprocessed image...');
    
    if (onProgress) {
      onProgress('OpenAI 서버에서 이미지 생성 중... (최대 2분)');
    }

    // 5. 전처리된 이미지로 비동기 생성 (최대 2분 대기)
    const processedImageFile: ImageFile = {
      base64: pngBase64,
      mimeType: 'image/png',
      url: `data:image/png;base64,${pngBase64}`
    };
    
    const result = await generateImageAsync(processedImageFile, optimizedPrompt, 120000);
    
    if (!result) {
      throw new Error('비동기 OpenAI 변환 결과 없음');
    }
    
    console.log('✅ 비동기 OpenAI 변환 완료, 종횡비 보정 시작...');
    
    // 6. 종횡비 보정 (gpt-image-1 결과를 원본 비율로)
    const correctedBase64 = await correctAspectRatio(
      result.base64,
      originalDimensions.width,
      originalDimensions.height
    );
    
    console.log('🎨 종횡비 보정 완료');
    
    if (onProgress) {
      onProgress('변환 완료!');
    }
    
    return {
      base64: correctedBase64,
      mimeType: 'image/png',
      url: `data:image/png;base64,${correctedBase64}`
    };
    
  } catch (error) {
    console.error('❌ 비동기 OpenAI 변환 실패:', error);
    throw error;
  }
};

/**
 * 업데이트된 하이브리드 변환 (비동기 OpenAI + Gemini)
 */
export const hybridFaceTransformation = async (
  originalImage: ImageFile,
  facePrompt: string,
  clothingPrompt: string,
  onProgress?: (status: string) => void
): Promise<ImageFile | null> => {
  try {
    console.log('🚀 비동기 OpenAI + Gemini 하이브리드 변환 시작');
    console.log('- Face prompt:', facePrompt);
    console.log('- Clothing prompt:', clothingPrompt || 'None');
    
    // Step 1: 비동기 OpenAI로 얼굴 변환 (헤어 보존 최우선)
    console.log('Step 1: 비동기 OpenAI 얼굴 변환 (헤어 보존 최우선, 최대 2분 대기)');
    
    if (onProgress) {
      onProgress('OpenAI에서 얼굴 변환 처리 중... (헤어는 완전 보존, 최대 2분)');
    }
    
    const faceChangedImage = await transformFaceWithAsyncOpenAI(
      originalImage, 
      facePrompt,
      onProgress
    );
    
    if (!faceChangedImage) {
      throw new Error('Step 1 실패: 비동기 OpenAI 얼굴 변환 실패');
    }
    
    console.log('✅ Step 1 완료: 비동기 OpenAI 얼굴 변환 (헤어 보존)');
    
    // 의상 변경이 없으면 1단계 결과만 반환
    if (!clothingPrompt || clothingPrompt.trim() === '') {
      console.log('변환 완료 (얼굴만)');
      return faceChangedImage;
    }
    
    // Step 2: Gemini로 의상 변환
    console.log('Step 2: Gemini 의상 변환');
    
    if (onProgress) {
      onProgress('의상 변환 처리 중...');
    }
    
    const finalResult = await changeClothingOnly(faceChangedImage, clothingPrompt);
    
    if (!finalResult) {
      console.warn('Step 2 실패, Step 1 결과 반환');
      return faceChangedImage;
    }
    
    console.log('✅ Step 2 완료: 의상 변환');
    console.log('🎉 비동기 OpenAI + Gemini 하이브리드 변환 완료!');
    
    if (onProgress) {
      onProgress('모든 변환 완료!');
    }
    
    return finalResult;
    
  } catch (error) {
    console.error('❌ 하이브리드 변환 실패:', error);
    
    if (error instanceof Error) {
      const errorMessage = error.message;
      
      if (errorMessage.includes('Step 1')) {
        throw new Error(`비동기 OpenAI 얼굴 변환 실패: ${errorMessage}`);
      } else if (errorMessage.includes('Timeout')) {
        throw new Error(`변환 시간 초과: ${errorMessage}`);
      }
      
      throw error;
    }
    
    throw new Error("비동기 OpenAI 하이브리드 얼굴 변환에 실패했습니다.");
  }
};

/**
 * 스마트 변환 (비동기 OpenAI 우선, 실패시 Gemini 폴백)
 */
export const smartFaceTransformation = async (
  originalImage: ImageFile,
  facePrompt: string,
  clothingPrompt: string,
  onProgress?: (status: string) => void
): Promise<{ result: ImageFile | null; method: string }> => {
  try {
    // 먼저 비동기 OpenAI + Gemini 하이브리드 시도
    const hybridResult = await hybridFaceTransformation(
      originalImage, 
      facePrompt, 
      clothingPrompt,
      onProgress
    );
    
    return { 
      result: hybridResult, 
      method: '비동기 OpenAI (헤어 보존 최우선, 2분 대기) + Gemini 하이브리드' 
    };
    
  } catch (error) {
    console.log('비동기 OpenAI 하이브리드 실패, Gemini 전용으로 폴백...');
    console.error('오류:', error);
    
    try {
      if (onProgress) {
        onProgress('OpenAI 실패, Gemini로 폴백 중...');
      }
      
      // 비동기 OpenAI 실패시 기존 Gemini 방식으로 폴백
      const geminiResult = await changeFaceInImage(
        originalImage, 
        facePrompt,
        clothingPrompt
      );
      
      if (onProgress) {
        onProgress('Gemini 변환 완료!');
      }
      
      return { 
        result: geminiResult, 
        method: 'Gemini Only (비동기 OpenAI 폴백)' 
      };
      
    } catch (fallbackError) {
      console.error('모든 변환 방법 실패');
      throw new Error(`모든 변환 실패: ${fallbackError instanceof Error ? fallbackError.message : 'Unknown error'}`);
    }
  }
};

/**
 * 서비스 상태 확인 - 완전 통합 버전
 */
export const getHybridServiceStatus = () => {
  return {
    version: '4.0-ASYNC-COMPLETE-FINAL',
    method: '비동기 gpt-image-1 완전 구현',
    step1: '비동기 OpenAI (헤어 보존 최우선, 2분 대기 가능, 전처리 통합)',
    step2: 'Gemini 의상 변환',
    fallback: 'Gemini Only',
    features: [
      '비동기 작업 큐 시스템',
      'Netlify Functions 타임아웃 우회',
      '최대 2분 OpenAI 대기',
      '헤어 보존 HIGHEST PRIORITY',
      'gpt-image-1 리사이즈 최적화 (768~1536px)',
      'PNG 변환 (OpenAI 호환성)',
      '종횡비 자동 보정 (세로 비율 유지)',
      '실시간 진행 상황 추적',
      '1000자 프롬프트 최적화',
      'Gemini 스마트 폴백',
      '하이브리드 변환 연계'
    ]
  };
};
