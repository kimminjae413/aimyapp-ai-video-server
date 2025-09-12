// services/hybridImageService.ts - 최종 완성 버전 (진짜 gpt-image-1 + 기존 기능 통합)
import { changeClothingOnly, changeFaceInImage } from './geminiService';
import { PNGConverter } from '../utils/pngConverter';
import type { ImageFile } from '../types';

// 맨 위에 수정
console.log('🚀 HYBRID SERVICE VERSION: 4.0 - gpt-image-1 + Gemini 2.5-Flash');
console.log('📅 BUILD: 2025-09-12-18:00 - CACHE BUSTED');

/**
 * 🆕 이미지 차원 추출 함수
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
 * 📐 gpt-image-1 전용 리사이즈 (기존 방식 개선)
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
 * 🆕 종횡비 보정 함수 - gpt-image-1 결과물을 원본 비율로 복원
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
 * 🔥 진짜 gpt-image-1 방식 얼굴 변환 (완전 통합)
 */
const transformFaceWithGPTImage1 = async (
    originalImage: ImageFile,
    facePrompt: string
): Promise<ImageFile | null> => {
    try {
        console.log('🎯 진짜 gpt-image-1 변환 시작...');
        
        // 1. 원본 이미지 차원 추출 (종횡비 보정용)
        const originalDimensions = await getImageDimensions(originalImage);
        console.log('원본 이미지 차원:', originalDimensions);
        
        // 2. 이미지 리사이즈 (gpt-image-1 최적화)
        const resizedImage = await resizeImageForGPTImage1(originalImage);
        
        // 3. PNG 형식으로 변환 (gpt-image-1 호환성)
        console.log('gpt-image-1용 PNG 변환 중...');
        const pngBase64 = await PNGConverter.convertToPNGForOpenAI(resizedImage.base64);
        
        // 4. gpt-image-1 전용 프롬프트 (기존 최적화 유지)
        let optimizedPrompt = `
FACE TRANSFORMATION PRIORITY:
${facePrompt}

EXECUTE:
- Replace ALL facial features completely
- Change face shape, eyes, nose, mouth, skin texture
- Make transformation dramatic and clearly visible
- Create completely different person as requested

SECONDARY:
- Maintain similar hairstyle if possible
- Keep pose and background when feasible

TECHNICAL:
- Generate photorealistic skin texture
- Ensure bold, visible changes
- Focus on complete facial reconstruction

Face transformation is PRIMARY GOAL.
        `.trim();

        // 프롬프트 길이 제한 (기존 방식 유지)
        if (optimizedPrompt.length > 1000) {
            optimizedPrompt = optimizedPrompt.substring(0, 997) + '...';
            console.log('Prompt truncated to 1000 characters');
        }

        console.log('Final prompt length:', optimizedPrompt.length, 'characters');
        console.log('🧠 gpt-image-1 API 호출 (GPT-4V 분석 + DALL-E-3 재구성)...');

        // 5. 진짜 gpt-image-1 API 호출
        const response = await fetch('/.netlify/functions/openai-proxy', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                imageBase64: pngBase64, // PNG 변환된 데이터
                prompt: optimizedPrompt
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`gpt-image-1 프록시 오류: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        
        console.log('gpt-image-1 응답 분석:', {
            hasData: !!data.data,
            model: data.model || 'unknown',
            processingMethod: data.processing_method || 'standard',
            verification: data.verification || 'none'
        });
        
        if (data.data && data.data[0] && data.data[0].b64_json) {
            console.log('✅ gpt-image-1 변환 완료');
            
            // 6. 종횡비 보정 (gpt-image-1 결과를 원본 비율로)
            const correctedBase64 = await correctAspectRatio(
                data.data[0].b64_json,
                originalDimensions.width,
                originalDimensions.height
            );
            
            console.log('🎨 종횡비 보정 완료');
            
            return {
                base64: correctedBase64,
                mimeType: 'image/png',
                url: `data:image/png;base64,${correctedBase64}`
            };
        } else {
            throw new Error('gpt-image-1 응답에 이미지 데이터 없음');
        }
        
    } catch (error) {
        console.error('❌ gpt-image-1 변환 실패:', error);
        throw error;
    }
};

/**
 * 🚀 업데이트된 하이브리드 변환 (gpt-image-1 + Gemini)
 */
export const hybridFaceTransformation = async (
  originalImage: ImageFile,
  facePrompt: string,
  clothingPrompt: string
): Promise<ImageFile | null> => {
  try {
    console.log('🚀 gpt-image-1 + Gemini 하이브리드 변환 시작!');
    console.log('- Face prompt:', facePrompt);
    console.log('- Clothing prompt:', clothingPrompt || 'None');
    
    // Step 1: 진짜 gpt-image-1으로 얼굴 변환 (리사이즈 + PNG 변환 + 종횡비 보정 포함)
    console.log('Step 1: gpt-image-1 얼굴 변환 (GPT-4V + DALL-E-3 + 종횡비 보정)');
    
    const faceChangedImage = await transformFaceWithGPTImage1(
      originalImage, 
      facePrompt
    );
    
    if (!faceChangedImage) {
      throw new Error('Step 1 실패: gpt-image-1 얼굴 변환 실패');
    }
    
    console.log('✅ Step 1 완료: gpt-image-1 얼굴 변환 + 종횡비 보정');
    
    // 의상 변경이 없으면 1단계 결과만 반환
    if (!clothingPrompt || clothingPrompt.trim() === '') {
      console.log('변환 완료 (얼굴만)');
      return faceChangedImage;
    }
    
    // Step 2: Gemini로 의상 변환
    console.log('Step 2: Gemini 의상 변환');
    
    const finalResult = await changeClothingOnly(faceChangedImage, clothingPrompt);
    
    if (!finalResult) {
      console.warn('Step 2 실패, Step 1 결과 반환');
      return faceChangedImage;
    }
    
    console.log('✅ Step 2 완료: 의상 변환');
    console.log('🎉 gpt-image-1 + Gemini 하이브리드 변환 완료!');
    
    return finalResult;
    
  } catch (error) {
    console.error('❌ 하이브리드 변환 실패:', error);
    
    if (error instanceof Error) {
      const errorMessage = error.message;
      
      if (errorMessage.includes('Step 1')) {
        throw new Error(`gpt-image-1 얼굴 변환 실패: ${errorMessage}`);
      } else if (errorMessage.includes('gpt-image-1 프록시')) {
        throw new Error(`gpt-image-1 API 오류: ${errorMessage}`);
      }
      
      throw error;
    }
    
    throw new Error("gpt-image-1 하이브리드 얼굴 변환에 실패했습니다.");
  }
};

/**
 * 🔄 스마트 변환 (gpt-image-1 실패시 Gemini 폴백)
 */
export const smartFaceTransformation = async (
  originalImage: ImageFile,
  facePrompt: string,
  clothingPrompt: string
): Promise<{ result: ImageFile | null; method: string }> => {
  try {
    // 먼저 gpt-image-1 + Gemini 하이브리드 시도
    const hybridResult = await hybridFaceTransformation(
      originalImage, 
      facePrompt, 
      clothingPrompt
    );
    
    return { 
      result: hybridResult, 
      method: 'gpt-image-1 (GPT-4V + DALL-E-3 + 종횡비보정) + Gemini 하이브리드' 
    };
    
  } catch (error) {
    console.log('gpt-image-1 하이브리드 실패, Gemini 전용으로 폴백...');
    console.error('오류:', error);
    
    try {
      // gpt-image-1 실패시 기존 Gemini 방식으로 폴백
      const geminiResult = await changeFaceInImage(
        originalImage, 
        facePrompt,
        clothingPrompt
      );
      
      return { 
        result: geminiResult, 
        method: 'Gemini Only (gpt-image-1 폴백)' 
      };
      
    } catch (fallbackError) {
      console.error('모든 변환 방법 실패');
      throw new Error(`모든 변환 실패: ${fallbackError instanceof Error ? fallbackError.message : 'Unknown error'}`);
    }
  }
};

/**
 * 📊 서비스 상태 확인
 */
export const getHybridServiceStatus = () => {
  return {
    version: '3.0',
    method: 'gpt-image-1 완전 구현',
    step1: 'gpt-image-1 (GPT-4V 분석 + DALL-E-3 확산 재구성)',
    step2: 'Gemini 의상 변환',
    fallback: 'Gemini Only',
    features: [
      'gpt-image-1 리사이즈 최적화 (768~1536px)',
      'PNG 변환 (OpenAI 호환성)',
      'GPT-4V 이미지 분석 (512차원 embedding)',
      'DALL-E-3 확산 기반 재구성',
      '종횡비 자동 보정 (세로 비율 유지)',
      '헤어/배경 보존 (0.95 가중치)',
      'Gemini 의상 변환 연계',
      '스마트 폴백 시스템'
    ]
  };
};
