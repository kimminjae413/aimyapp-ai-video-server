// services/hybridImageService.ts - Firebase + Gemini 하이브리드 최종 완성판
console.log('🔥 FIREBASE HYBRID SERVICE VERSION: 5.0 - Firebase OpenAI + Gemini');
console.log('📅 BUILD: 2025-09-12-19:30 - FIREBASE FUNCTIONS COMPLETE VERSION');
console.log('🔥 FORCE CACHE BUST: 2025-09-12-19:30');

import { changeClothingOnly, changeFaceInImage } from './geminiService';
import { transformFaceWithFirebase } from './firebaseOpenAIService';
import type { ImageFile } from '../types';

/**
 * Firebase + Gemini 하이브리드 변환 (9분 타임아웃)
 */
export const firebaseHybridTransformation = async (
  originalImage: ImageFile,
  facePrompt: string,
  clothingPrompt: string,
  onProgress?: (status: string) => void
): Promise<ImageFile | null> => {
  try {
    console.log('🔥 Firebase + Gemini 하이브리드 변환 시작');
    console.log('- Face prompt:', facePrompt);
    console.log('- Clothing prompt:', clothingPrompt || 'None');
    
    // Step 1: Firebase Functions로 얼굴 변환 (최대 9분)
    console.log('Step 1: Firebase OpenAI 얼굴 변환 (헤어 보존 최우선, 최대 9분)');
    
    if (onProgress) {
      onProgress('Firebase에서 얼굴 변환 처리 중... (헤어 완전 보존)');
    }
    
    const faceChangedImage = await transformFaceWithFirebase(
      originalImage, 
      facePrompt,
      onProgress
    );
    
    if (!faceChangedImage) {
      throw new Error('Firebase 얼굴 변환 실패');
    }
    
    console.log('✅ Step 1 완료: Firebase OpenAI 얼굴 변환');
    
    // 의상 변경이 없으면 1단계 결과만 반환
    if (!clothingPrompt || clothingPrompt.trim() === '') {
      console.log('Firebase 변환 완료 (얼굴만)');
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
    console.log('🎉 Firebase + Gemini 하이브리드 변환 완료!');
    
    if (onProgress) {
      onProgress('모든 변환 완료!');
    }
    
    return finalResult;
    
  } catch (error) {
    console.error('❌ Firebase 하이브리드 변환 실패:', error);
    throw error;
  }
};

/**
 * 레거시 Netlify 비동기 변환 (폴백용 - 기존 코드 유지)
 */
const legacyNetlifyTransformation = async (
  originalImage: ImageFile,
  facePrompt: string,
  clothingPrompt: string,
  onProgress?: (status: string) => void
): Promise<ImageFile | null> => {
  try {
    console.log('⚠️ 레거시 Netlify 비동기 변환 시작 (폴백)');
    
    // 기존 비동기 OpenAI 방식 (Netlify Functions)
    // 이 부분은 기존 코드를 그대로 사용
    const { generateImageAsync } = await import('./asyncOpenAIService');
    const { PNGConverter } = await import('../utils/pngConverter');
    
    // 이미지 전처리
    const pngBase64 = await PNGConverter.convertToPNGForOpenAI(originalImage.base64);
    
    const optimizedPrompt = `
HIGHEST PRIORITY - HAIR PRESERVATION:
- Keep EXACT same hair: style, color, length, texture, parting
- Hair must remain 100% identical to original

SECONDARY - FACE TRANSFORMATION:
${facePrompt}
- Replace facial features completely
- Change face shape, eyes, nose, mouth, skin

TECHNICAL:
- Keep pose and background
- Photorealistic skin texture

Hair preservation is CRITICAL priority.
    `.trim();
    
    if (onProgress) {
      onProgress('Netlify 비동기 처리 중... (최대 2분)');
    }
    
    const processedImageFile: ImageFile = {
      base64: pngBase64,
      mimeType: 'image/png',
      url: `data:image/png;base64,${pngBase64}`
    };
    
    const result = await generateImageAsync(processedImageFile, optimizedPrompt, 120000);
    
    if (!result) {
      throw new Error('Netlify 비동기 변환 실패');
    }
    
    // 의상 변경이 있으면 Gemini로 추가 처리
    if (clothingPrompt && clothingPrompt.trim() !== '') {
      if (onProgress) {
        onProgress('의상 변환 처리 중...');
      }
      
      const finalResult = await changeClothingOnly(result, clothingPrompt);
      return finalResult || result;
    }
    
    return result;
    
  } catch (error) {
    console.error('❌ 레거시 Netlify 변환 실패:', error);
    throw error;
  }
};

/**
 * 스마트 변환 (Firebase 우선, 실패시 Netlify 폴백, 최후 Gemini)
 */
export const smartFaceTransformation = async (
  originalImage: ImageFile,
  facePrompt: string,
  clothingPrompt: string,
  onProgress?: (status: string) => void
): Promise<{ result: ImageFile | null; method: string }> => {
  try {
    // 🔥 1순위: Firebase + Gemini 하이브리드 (9분 타임아웃)
    console.log('🔥 1순위: Firebase Functions 시도...');
    
    const firebaseResult = await firebaseHybridTransformation(
      originalImage, 
      facePrompt, 
      clothingPrompt,
      onProgress
    );
    
    return { 
      result: firebaseResult, 
      method: 'Firebase OpenAI (9분, 헤어 보존) + Gemini 하이브리드' 
    };
    
  } catch (firebaseError) {
    console.log('Firebase 실패, Netlify 비동기로 폴백...');
    console.error('Firebase 오류:', firebaseError);
    
    try {
      // 🔄 2순위: Netlify 비동기 OpenAI (2분 타임아웃)
      console.log('🔄 2순위: Netlify 비동기 OpenAI 시도...');
      
      if (onProgress) {
        onProgress('Firebase 실패, Netlify 비동기로 폴백 중...');
      }
      
      const netlifyResult = await legacyNetlifyTransformation(
        originalImage, 
        facePrompt, 
        clothingPrompt,
        onProgress
      );
      
      if (onProgress) {
        onProgress('Netlify 비동기 변환 완료!');
      }
      
      return { 
        result: netlifyResult, 
        method: 'Netlify 비동기 OpenAI (Firebase 폴백)' 
      };
      
    } catch (netlifyError) {
      console.log('Netlify 비동기도 실패, Gemini 전용으로 최종 폴백...');
      console.error('Netlify 오류:', netlifyError);
      
      try {
        // 🆘 3순위: Gemini Only (최종 폴백)
        console.log('🆘 3순위: Gemini Only 최종 시도...');
        
        if (onProgress) {
          onProgress('모든 OpenAI 실패, Gemini 전용으로 폴백 중...');
        }
        
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
          method: 'Gemini Only (Firebase + Netlify 모두 폴백)' 
        };
        
      } catch (geminiError) {
        console.error('모든 변환 방법 실패');
        throw new Error(`모든 변환 실패 - Firebase: ${firebaseError instanceof Error ? firebaseError.message : 'Unknown'}, Netlify: ${netlifyError instanceof Error ? netlifyError.message : 'Unknown'}, Gemini: ${geminiError instanceof Error ? geminiError.message : 'Unknown'}`);
      }
    }
  }
};

/**
 * 서비스 상태 확인 - Firebase 우선 버전
 */
export const getHybridServiceStatus = () => {
  return {
    version: '5.0-FIREBASE-HYBRID-COMPLETE',
    priority: 'Firebase Functions 우선',
    step1: 'Firebase OpenAI (헤어 보존 최우선, 9분 대기)',
    step2: 'Gemini 의상 변환',
    fallback1: 'Netlify 비동기 OpenAI (2분 대기)',
    fallback2: 'Gemini Only',
    features: [
      '🔥 Firebase Functions v2 (9분 타임아웃)',
      '💾 2GB 메모리 할당',
      '🤖 OpenAI gpt-image-1 Edit API',
      '💇 헤어 보존 HIGHEST PRIORITY',
      '📸 PNG 자동 변환 + 리사이즈',
      '📐 종횡비 자동 보정',
      '📊 실시간 진행 상황 추적',
      '📝 1000자 프롬프트 최적화',
      '🔄 3단계 스마트 폴백 시스템',
      '🎨 하이브리드 변환 연계'
    ],
    urls: {
      firebase: 'https://us-central1-hgfaceswap-functions.cloudfunctions.net/openaiProxy',
      netlify: '/.netlify/functions/openai-start (비동기)',
      gemini: 'Google Gemini 2.5 Flash Image'
    }
  };
};

// 🔥 기존 함수들 호환성 유지 (다른 파일에서 import하는 경우)
export const hybridFaceTransformation = firebaseHybridTransformation;

/**
 * Firebase 연결 상태 확인용 헬퍼
 */
export const checkFirebaseAvailability = async (): Promise<boolean> => {
  try {
    const { testFirebaseConnection } = await import('./firebaseOpenAIService');
    return await testFirebaseConnection();
  } catch (error) {
    console.error('Firebase 연결 확인 실패:', error);
    return false;
  }
};
