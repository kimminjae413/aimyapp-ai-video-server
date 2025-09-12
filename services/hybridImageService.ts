// services/hybridImageService.ts - OpenAI 프록시 + PNG 변환 + 얼굴 변환 우선
import { changeClothingOnly, changeFaceInImage } from './geminiService';
import { PNGConverter } from '../utils/pngConverter';
import type { ImageFile } from '../types';

console.log('HYBRID SERVICE VERSION: 2.2 - OpenAI Proxy + PNG 변환 + 얼굴 변환 우선');

/**
 * 이미지 리사이즈 (OpenAI API 용)
 */
const resizeImageForOpenAI = (originalImage: ImageFile): Promise<ImageFile> => {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d')!;
            
            // 1024x1024 최대 크기로 비율 유지하며 리사이즈
            const maxSize = 1024;
            const ratio = Math.min(maxSize / img.width, maxSize / img.height);
            
            canvas.width = img.width * ratio;
            canvas.height = img.height * ratio;
            
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            
            const resizedDataUrl = canvas.toDataURL('image/jpeg', 0.8);
            const resizedBase64 = resizedDataUrl.split(',')[1];
            
            console.log('이미지 리사이즈 완료:', {
                original: `${img.width}x${img.height}`,
                resized: `${canvas.width}x${canvas.height}`,
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
 * OpenAI 프록시를 통한 얼굴 변환 (PNG 변환 포함) - 얼굴 변환 우선
 */
const transformFaceWithOpenAIProxy = async (
    originalImage: ImageFile,
    facePrompt: string
): Promise<ImageFile | null> => {
    try {
        console.log('OpenAI Proxy: Face transformation starting...');
        
        // 1. 이미지 리사이즈 (1024x1024 최대)
        const resizedImage = await resizeImageForOpenAI(originalImage);
        
        // 2. PNG 형식으로 변환 (OpenAI 요구사항)
        console.log('OpenAI용 PNG 변환 중...');
        const pngBase64 = await PNGConverter.convertToPNGForOpenAI(resizedImage.base64);
        
        // 1000자 제한에 맞춘 얼굴 변환 우선 프롬프트
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

        // 1000자 초과시 자동 자르기
        if (optimizedPrompt.length > 1000) {
            optimizedPrompt = optimizedPrompt.substring(0, 997) + '...';
            console.log('Prompt truncated to 1000 characters');
        }

        console.log('Final prompt length:', optimizedPrompt.length, 'characters');
        console.log('PNG 변환 완료, OpenAI API 호출...');

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
            throw new Error(`OpenAI Proxy Error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        
        if (data.data && data.data[0] && data.data[0].b64_json) {
            console.log('OpenAI Proxy: Face transformation completed');
            
            return {
                base64: data.data[0].b64_json,
                mimeType: 'image/png',
                url: `data:image/png;base64,${data.data[0].b64_json}`
            };
        } else {
            throw new Error('No image data in OpenAI proxy response');
        }
        
    } catch (error) {
        console.error('OpenAI Proxy transformation error:', error);
        throw error;
    }
};

/**
 * 2단계 하이브리드 변환 (OpenAI 프록시 + Gemini)
 */
export const hybridFaceTransformation = async (
  originalImage: ImageFile,
  facePrompt: string,
  clothingPrompt: string
): Promise<ImageFile | null> => {
  try {
    console.log('Starting 2-step hybrid transformation...');
    console.log('- Face prompt:', facePrompt);
    console.log('- Clothing prompt:', clothingPrompt || 'None');
    
    // Step 1: OpenAI 프록시로 얼굴 변환
    console.log('Step 1: OpenAI Proxy face transformation');
    
    const faceChangedImage = await transformFaceWithOpenAIProxy(
      originalImage, 
      facePrompt
    );
    
    if (!faceChangedImage) {
      throw new Error('Step 1 failed: OpenAI Proxy face transformation unsuccessful');
    }
    
    console.log('Step 1 complete: Face transformed, hair preserved');
    
    // 의상 변경이 없으면 1단계 결과만 반환
    if (!clothingPrompt || clothingPrompt.trim() === '') {
      console.log('Transformation complete (face only)');
      return faceChangedImage;
    }
    
    // Step 2: Gemini 의상 변환
    console.log('Step 2: Gemini clothing transformation');
    
    const finalResult = await changeClothingOnly(
      faceChangedImage,
      clothingPrompt
    );
    
    if (!finalResult) {
      console.warn('Step 2 failed, returning Step 1 result');
      return faceChangedImage;
    }
    
    console.log('Step 2 complete: Clothing transformed');
    console.log('2-step hybrid transformation complete!');
    
    return finalResult;
    
  } catch (error) {
    console.error('Hybrid transformation failed:', error);
    
    if (error instanceof Error) {
      const errorMessage = error.message;
      
      if (errorMessage.includes('Step 1')) {
        throw new Error(`얼굴 변환 실패: ${errorMessage}`);
      } else if (errorMessage.includes('OpenAI Proxy')) {
        throw new Error(`OpenAI 프록시 오류: ${errorMessage}`);
      }
      
      throw error;
    }
    
    throw new Error("하이브리드 얼굴 변환에 실패했습니다.");
  }
};

/**
 * 스마트 변환 (OpenAI 프록시 실패시 Gemini 폴백) - 기존 호환성 유지
 */
export const smartFaceTransformation = async (
  originalImage: ImageFile,
  facePrompt: string,
  clothingPrompt: string
): Promise<{ result: ImageFile | null; method: string }> => {
  try {
    // 먼저 하이브리드 방식 시도 (OpenAI 프록시 + Gemini)
    const hybridResult = await hybridFaceTransformation(
      originalImage, 
      facePrompt, 
      clothingPrompt
    );
    
    return { 
      result: hybridResult, 
      method: 'OpenAI Proxy + Gemini (2-step Hybrid)' 
    };
    
  } catch (error) {
    console.log('Hybrid failed, falling back to Gemini-only...');
    console.error('Error:', error);
    
    try {
      // 하이브리드 실패시 기존 Gemini 방식으로 폴백
      const geminiResult = await changeFaceInImage(
        originalImage, 
        facePrompt,
        clothingPrompt
      );
      
      return { 
        result: geminiResult, 
        method: 'Gemini Only (Fallback)' 
      };
      
    } catch (fallbackError) {
      console.error('All transformation methods failed');
      throw new Error(`모든 변환 방법 실패: ${fallbackError instanceof Error ? fallbackError.message : 'Unknown error'}`);
    }
  }
};

/**
 * 서비스 상태
 */
export const getHybridServiceStatus = () => {
  return {
    step1: 'OpenAI Proxy (Face transformation - Priority)',
    step2: 'Gemini (Clothing transformation)', 
    fallback: 'Gemini Only',
    faceOptions: 'Enhanced dramatic transformation prompts',
    pngConversion: 'Enabled for OpenAI compatibility',
    version: '2.2'
  };
};
