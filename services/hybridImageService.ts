// services/hybridImageService.ts - Gemini 엄격한 2단계 적용 최종판
console.log('🔥 FIREBASE HYBRID SERVICE VERSION: 6.1 - STRICT GEMINI FALLBACK');
console.log('📅 BUILD: 2025-09-12-21:00 - GEMINI 2STEP STRICT');
console.log('🔥 CACHE BUST: 2025-09-12-21:00');

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
 * 스마트 변환 (Firebase 우선, 실패시 엄격한 2단계 Gemini 폴백)
 */
export const smartFaceTransformation = async (
  originalImage: ImageFile,
  facePrompt: string,
  clothingPrompt: string,
  onProgress?: (status: string) => void
): Promise<{ result: ImageFile | null; method: string }> => {
  try {
    // 1순위: Firebase + Gemini 하이브리드 (9분 타임아웃)
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
    console.log('Firebase 실패, Gemini 엄격한 2단계로 폴백...');
    console.error('Firebase 오류:', firebaseError);
    
    try {
      // 🎯 2순위: Gemini 엄격한 2단계 (최종 폴백)
      console.log('🆘 2순위: Gemini STRICT 2-Step 최종 시도...');
      console.log('🔧 Gemini 폴백 방식: 얼굴 먼저 → 옷 나중에 (Firebase와 동일)');
      
      if (onProgress) {
        onProgress('Firebase 실패, Gemini 엄격한 2단계로 폴백 중...');
      }
      
      // 🚀 새로운 엄격한 2단계 Gemini 사용
      const geminiResult = await changeFaceInImage(
        originalImage, 
        facePrompt,
        clothingPrompt
      );
      
      if (onProgress) {
        onProgress('Gemini 엄격한 2단계 변환 완료!');
      }
      
      return { 
        result: geminiResult, 
        method: 'Gemini 엄격한 2단계 (얼굴→옷, Firebase 폴백)' 
      };
      
    } catch (geminiError) {
      console.error('모든 변환 방법 실패');
      throw new Error(`모든 변환 실패 - Firebase: ${firebaseError instanceof Error ? firebaseError.message : 'Unknown'}, Gemini: ${geminiError instanceof Error ? geminiError.message : 'Unknown'}`);
    }
  }
};

/**
 * 서비스 상태 확인 - 엄격한 2단계 시스템
 */
export const getHybridServiceStatus = () => {
  return {
    version: '6.1-FIREBASE-GEMINI-STRICT',
    architecture: '2단계 엄격한 시스템',
    step1: 'Firebase OpenAI (헤어 보존 최우선, 9분 대기)',
    step2: 'Gemini 의상 변환',
    fallback: 'Gemini 엄격한 2단계 (Firebase와 동일한 방식)',
    features: [
      '🔥 Firebase Functions v2 (9분 타임아웃)',
      '💾 2GB 메모리 할당',
      '🤖 OpenAI gpt-image-1 Edit API',
      '💇 헤어 보존 HIGHEST PRIORITY',
      '📸 PNG 자동 변환 + 리사이즈 (최대 1792px)',
      '📐 종횡비 자동 보정',
      '📊 실시간 진행 상황 추적',
      '📝 1200자 프롬프트 지원',
      '🛡️ 안전한 2단계 폴백 시스템',
      '🎨 하이브리드 변환 연계',
      '⚡ 빌드 오류 없는 안전한 구조',
      '🎯 Gemini 폴백: 엄격한 2단계 (얼굴→옷)',
      '🔧 앵글/사이즈 변경 완전 금지',
      '🌡️ Temperature 0.1로 일관성 극대화'
    ],
    services: {
      primary: 'Firebase Functions (9분)',
      fallback: 'Google Gemini 2.5 Flash 엄격한 2단계 (14초)',
      removed: 'Netlify 비동기 (충돌 방지를 위해 제거)'
    },
    urls: {
      firebase: 'https://us-central1-hgfaceswap-functions.cloudfunctions.net/openaiProxy',
      gemini: 'Google Gemini 2.5 Flash Image API (엄격한 제약)'
    },
    improvements: [
      '🔄 Firebase 실패 시 Gemini도 2단계 처리',
      '📐 앵글/사이즈 변경 완전 방지',
      '💇 헤어 보존 절대 우선순위',
      '🎯 얼굴 변환과 의상 변환 분리',
      '🌡️ 낮은 Temperature로 일관성 향상'
    ]
  };
};

// 호환성 유지를 위한 별칭들
export const hybridFaceTransformation = firebaseHybridTransformation;

/**
 * Firebase 연결 상태 확인
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

/**
 * 안전성 검증 함수 - 모든 필요한 의존성이 있는지 확인
 */
export const validateServiceDependencies = async (): Promise<{
  firebase: boolean;
  gemini: boolean;
  safe: boolean;
  errors: string[];
}> => {
  const errors: string[] = [];
  let firebase = false;
  let gemini = false;

  // Firebase 서비스 확인
  try {
    await import('./firebaseOpenAIService');
    firebase = true;
    console.log('✅ Firebase 서비스 의존성 확인됨');
  } catch (error) {
    errors.push('Firebase 서비스 파일 누락');
    console.error('❌ Firebase 서비스 의존성 누락:', error);
  }

  // Gemini 서비스 확인 (엄격한 2단계 포함)
  try {
    const geminiService = await import('./geminiService');
    if (geminiService.changeFaceInImage && geminiService.changeClothingOnly) {
      gemini = true;
      console.log('✅ Gemini 엄격한 2단계 서비스 의존성 확인됨');
    } else {
      errors.push('Gemini 서비스 필수 함수 누락');
    }
  } catch (error) {
    errors.push('Gemini 서비스 파일 누락');
    console.error('❌ Gemini 서비스 의존성 누락:', error);
  }

  const safe = firebase && gemini && errors.length === 0;

  console.log('🔍 의존성 검증 결과:', {
    firebase,
    gemini,
    safe,
    errors
  });

  return { firebase, gemini, safe, errors };
};
