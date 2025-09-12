// services/hybridImageService.ts - GPT-Image-1 + Gemini 2단계 시스템
import { transformFaceWithGPTImage } from './openaiService';
import { changeFaceInImage } from './geminiService';
import type { ImageFile } from '../types';

console.log('HYBRID SERVICE VERSION: 1.0 - GPT-Image-1 + Gemini Pipeline');

/**
 * 🎯 2단계 하이브리드 변환
 * 1단계: GPT-Image-1로 얼굴 변환 (헤어 보존)
 * 2단계: Gemini로 의상 변환 (얼굴+헤어 보존)
 */
export const hybridFaceTransformation = async (
  originalImage: ImageFile,
  facePrompt: string,
  clothingPrompt: string
): Promise<ImageFile | null> => {
  try {
    console.log('🚀 Starting 2-step hybrid transformation...');
    console.log('- Original face prompt:', facePrompt);
    console.log('- Clothing prompt:', clothingPrompt || 'None');
    
    // ========== STEP 1: GPT-Image-1 얼굴 변환 ==========
    console.log('🎯 Step 1: GPT-Image-1 face transformation');
    
    const faceChangedImage = await transformFaceWithGPTImage(
      originalImage, 
      facePrompt // 기존 20대, 30대 등 옵션 그대로 사용!
    );
    
    if (!faceChangedImage) {
      throw new Error('Step 1 failed: GPT-Image-1 face transformation unsuccessful');
    }
    
    console.log('✅ Step 1 complete: Face transformed, hair perfectly preserved');
    
    // 의상 변경이 없으면 1단계 결과만 반환
    if (!clothingPrompt || clothingPrompt.trim() === '') {
      console.log('🎉 Transformation complete (face only)');
      return faceChangedImage;
    }
    
    // ========== STEP 2: Gemini 의상 변환 ==========
    console.log('🎯 Step 2: Gemini clothing transformation');
    
    // Gemini용 의상 전용 프롬프트 (얼굴+헤어 보존 강조)
    const clothingOnlyPrompt = `
CRITICAL: This image has been processed with GPT-Image-1 and has PERFECT face and hair.

CLOTHING TRANSFORMATION ONLY:
Change the clothing to: ${clothingPrompt}

ABSOLUTE PRESERVATION RULES:
- Face: Keep EXACTLY as shown (already transformed by GPT-Image-1)
- Hair: Keep EXACTLY as shown (already preserved perfectly)  
- Background: Keep identical
- Pose: Keep identical
- ONLY MODIFY: Clothing/outfit

The face and hair are already perfect - preserve them completely while changing only the clothes.
    `.trim();
    
    const finalResult = await changeFaceInImage(
      faceChangedImage,
      '', // 얼굴 프롬프트는 빈 문자열 (이미 변환 완료)
      clothingOnlyPrompt // 의상만 변경하는 특별한 프롬프트
    );
    
    if (!finalResult) {
      console.warn('⚠️ Step 2 failed, returning Step 1 result');
      return faceChangedImage; // 2단계 실패해도 1단계 결과는 반환
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
      } else if (errorMessage.includes('verification')) {
        throw new Error('GPT-Image-1 접근 권한이 필요합니다.');
      }
      
      throw error;
    }
    
    throw new Error("하이브리드 얼굴 변환에 실패했습니다.");
  }
};

/**
 * 🔄 스마트 변환 (GPT-Image-1 실패시 Gemini 폴백)
 */
export const smartFaceTransformation = async (
  originalImage: ImageFile,
  facePrompt: string,
  clothingPrompt: string
): Promise<{ result: ImageFile | null; method: string }> => {
  try {
    // 먼저 하이브리드 방식 시도
    const hybridResult = await hybridFaceTransformation(
      originalImage, 
      facePrompt, 
      clothingPrompt
    );
    
    return { 
      result: hybridResult, 
      method: 'GPT-Image-1 + Gemini (2-step Hybrid)' 
    };
    
  } catch (error) {
    console.warn('🔄 Hybrid failed, falling back to Gemini-only...');
    console.warn('Error:', error);
    
    try {
      // 하이브리드 실패시 기존 Gemini 방식으로 폴백
      const geminiResult = await changeFaceInImage(
        originalImage, 
        facePrompt,  // 기존 20대, 30대 옵션 그대로 사용
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
    step1: 'GPT-Image-1 (Face transformation)',
    step2: 'Gemini (Clothing transformation)', 
    fallback: 'Gemini Only',
    faceOptions: 'Maintains existing 20s, 30s, 40s age options'
  };
};
