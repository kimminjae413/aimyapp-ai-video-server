// services/hybridImageService.ts - OpenAI 프록시 사용 버전
import { changeClothingOnly, changeFaceInImage } from './geminiService';
import type { ImageFile } from '../types';

console.log('HYBRID SERVICE VERSION: 2.0 - OpenAI Proxy + Gemini Pipeline');

/**
 * OpenAI 프록시를 통한 얼굴 변환
 */
const transformFaceWithOpenAIProxy = async (
    originalImage: ImageFile,
    facePrompt: string
): Promise<ImageFile | null> => {
    try {
        console.log('🎯 OpenAI Proxy: Face transformation starting...');
        
        // 헤어 보존 최적화 프롬프트
        const optimizedPrompt = `
Transform this person's facial features while preserving all other elements:

🎯 FACE TRANSFORMATION:
${facePrompt}

🔒 CRITICAL PRESERVATION:
- Hair: Keep EXACT same hairstyle, color, texture, length, and styling
- Clothing: Maintain identical outfit and accessories
- Background: Preserve environment completely  
- Pose: Keep body position and angle unchanged
- Lighting: Match original illumination and shadows

⚙️ TECHNICAL REQUIREMENTS:
- Generate photorealistic skin with natural texture
- Ensure seamless blending between new face and existing hair
- Maintain color harmony throughout the image

The goal is facial reconstruction only - everything else must remain identical.
        `.trim();

        const response = await fetch('/.netlify/functions/openai-proxy', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                imageData: originalImage.base64,
                mimeType: originalImage.mimeType,
                prompt: optimizedPrompt
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`OpenAI Proxy Error: ${errorData.error || response.statusText}`);
        }

        const data = await response.json();
        
        if (data.data && data.data[0] && data.data[0].b64_json) {
            console.log('✅ OpenAI Proxy: Face transformation completed');
            
            return {
                base64: data.data[0].b64_json,
                mimeType: 'image/png',
                url: `data:image/png;base64,${data.data[0].b64_json}`
            };
        } else {
            throw new Error('No image data in OpenAI proxy response');
        }
        
    } catch (error) {
        console.error('❌ OpenAI Proxy transformation error:', error);
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
    console.log('🚀 Starting 2-step hybrid transformation (Proxy)...');
    console.log('- Original face prompt:', facePrompt);
    console.log('- Clothing prompt:', clothingPrompt || 'None');
    
    // ========== STEP 1: OpenAI 프록시로 얼굴 변환 ==========
    console.log('🎯 Step 1: OpenAI Proxy face transformation');
    
    const faceChangedImage = await transformFaceWithOpenAIProxy(
      originalImage, 
      facePrompt
    );
    
    if (!faceChangedImage) {
      throw new Error('Step 1 failed: OpenAI Proxy face transformation unsuccessful');
    }
    
    console.log('✅ Step 1 complete: Face transformed, hair perfectly preserved');
    
    // 의상 변경이 없으면 1단계 결과만 반환
    if (!clothingPrompt || clothingPrompt.trim() === '') {
      console.log('🎉 Transformation complete (face only)');
      return faceChangedImage;
    }
    
    // ========== STEP 2: Gemini 의상 변환 ==========
    console.log('🎯 Step 2: Gemini clothing transformation');
    
    const finalResult = await changeClothingOnly(
      faceChangedImage,
      clothingPrompt
    );
    
    if (!finalResult) {
      console.warn('⚠️ Step 2 failed, returning Step 1 result');
      return faceChangedImage;
    }
    
    console.log('✅ Step 2 complete: Clothing transformed');
    console.log('🎉 2-step hybrid transformation fully complete!');
    
    return finalResult;
    
  } catch (error) {
    console.error('❌ Hybrid transformation failed:', error);
    
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
 * 스마트 변환 (OpenAI 프록시 실패시 Gemini 폴백)
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
    console.warn('🔄 Hybrid failed, falling back to Gemini-only...');
    console.warn('Error:', error);
    
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
      console.error('❌ All transformation methods failed');
      throw new Error(`모든 변환 방법 실패: ${fallbackError instanceof Error ? fallbackError.message : 'Unknown error'}`);
    }
  }
};

/**
 * 서비스 상태
 */
export const getHybridServiceStatus = () => {
  return {
    step1: 'OpenAI Proxy (Face transformation)',
    step2: 'Gemini (Clothing transformation)', 
    fallback: 'Gemini Only',
    faceOptions: 'Maintains existing age/style options'
  };
};
