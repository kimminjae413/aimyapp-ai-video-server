// services/hybridImageService.ts - VModel 우선 + Firebase/Gemini 폴백 최종판
console.log('🚀 VMODEL HYBRID SERVICE VERSION: 8.0 - VMODEL PRIORITY WITH REFERENCE IMAGE');
console.log('📅 BUILD: 2025-09-23 - VMODEL FIRST + FIREBASE/GEMINI FALLBACK');
console.log('🔥 CACHE BUST: 2025-09-23-VMODEL');

import { changeClothingOnly, changeFaceInImage } from './geminiService';
import { transformFaceWithFirebase } from './firebaseOpenAIService';
import type { ImageFile } from '../types';

// 🆕 VModel 서비스 동적 import (선택적 로딩)
let vmodelService: any = null;
const loadVModelService = async () => {
  if (!vmodelService) {
    try {
      vmodelService = await import('./vmodelService');
      console.log('✅ VModel 서비스 로드 완료');
      return vmodelService;
    } catch (error) {
      console.warn('⚠️ VModel 서비스 로드 실패:', error);
      return null;
    }
  }
  return vmodelService;
};

/**
 * 🆕 VModel + Gemini 하이브리드 변환 (참고이미지 기반)
 */
export const vmodelHybridTransformation = async (
  originalImage: ImageFile,
  referenceImage: ImageFile | null, // 참고할 얼굴 이미지
  facePrompt: string, // Gemini 폴백용 텍스트 프롬프트
  clothingPrompt: string,
  onProgress?: (status: string) => void
): Promise<{ result: ImageFile | null; method: string }> => {
  try {
    console.log('🎯 VModel + Gemini 하이브리드 변환 시작');
    console.log('- 참고 얼굴 이미지:', !!referenceImage);
    console.log('- Face prompt (폴백용):', facePrompt);
    console.log('- Clothing prompt:', clothingPrompt || 'None');
    
    let faceSwapResult: ImageFile | null = null;
    let usedMethod = '';

    // 1단계: 얼굴 교체/변환
    if (referenceImage) {
      try {
        console.log('🔄 1순위: VModel AI 얼굴교체 시도...');
        
        if (onProgress) {
          onProgress('VModel AI로 얼굴교체 중... (참고이미지 기반)');
        }

        // VModel 서비스 동적 로드
        const vmodel = await loadVModelService();
        if (!vmodel || !vmodel.swapFaceWithVModel) {
          throw new Error('VModel 서비스를 사용할 수 없습니다.');
        }

        faceSwapResult = await vmodel.swapFaceWithVModel(
          originalImage,
          referenceImage,
          onProgress
        );
        
        usedMethod = 'VModel AI (참고이미지 → 원본이미지)';
        console.log('✅ VModel AI 얼굴교체 성공');
        
      } catch (vmodelError) {
        console.log('❌ VModel AI 실패, Firebase로 폴백...');
        console.error('VModel 오류:', vmodelError);
        
        try {
          if (onProgress) {
            onProgress('VModel 실패, Firebase OpenAI로 폴백 중...');
          }

          // Firebase 폴백
          faceSwapResult = await transformFaceWithFirebase(
            originalImage,
            facePrompt,
            onProgress
          );
          
          usedMethod = 'Firebase OpenAI (VModel 폴백)';
          console.log('✅ Firebase 폴백 완료');
          
        } catch (firebaseError) {
          console.log('❌ Firebase도 실패, Gemini 텍스트 프롬프트로 최종 폴백...');
          console.error('Firebase 오류:', firebaseError);
          
          if (onProgress) {
            onProgress('Firebase 실패, Gemini 텍스트 변환으로 최종 폴백 중...');
          }

          // Gemini 최종 폴백
          faceSwapResult = await changeFaceInImage(
            originalImage,
            facePrompt,
            '' // 의상은 나중에 별도 처리
          );
          
          usedMethod = 'Gemini 텍스트 프롬프트 (VModel+Firebase 폴백)';
          console.log('✅ Gemini 최종 폴백 완료');
        }
      }
    } else {
      // 참고이미지가 없으면 바로 Firebase 시도
      console.log('📝 참고이미지 없음, Firebase OpenAI 시도...');
      
      try {
        if (onProgress) {
          onProgress('Firebase OpenAI로 텍스트 기반 얼굴변환 중...');
        }

        faceSwapResult = await transformFaceWithFirebase(
          originalImage,
          facePrompt,
          onProgress
        );
        
        usedMethod = 'Firebase OpenAI (텍스트 프롬프트)';
        console.log('✅ Firebase 텍스트 변환 완료');
        
      } catch (firebaseError) {
        console.log('❌ Firebase 실패, Gemini로 폴백...');
        console.error('Firebase 오류:', firebaseError);
        
        if (onProgress) {
          onProgress('Firebase 실패, Gemini 텍스트 변환으로 폴백 중...');
        }

        faceSwapResult = await changeFaceInImage(
          originalImage,
          facePrompt,
          '' // 의상은 나중에 별도 처리
        );
        
        usedMethod = 'Gemini 텍스트 프롬프트 (Firebase 폴백)';
        console.log('✅ Gemini 폴백 완료');
      }
    }

    if (!faceSwapResult) {
      throw new Error('얼굴 변환/교체에 실패했습니다.');
    }

    // 2단계: 의상 변경 (선택사항)
    if (clothingPrompt && clothingPrompt.trim() !== '') {
      console.log('👕 2단계: Gemini 의상 변경...');
      
      if (onProgress) {
        onProgress('의상 변경 처리 중...');
      }

      try {
        const finalResult = await changeClothingOnly(faceSwapResult, clothingPrompt);
        
        if (finalResult) {
          console.log('✅ 의상 변경 완료');
          usedMethod += ' + Gemini 의상변경';
          
          if (onProgress) {
            onProgress('모든 변환 완료!');
          }
          
          return { 
            result: finalResult, 
            method: usedMethod 
          };
        } else {
          console.warn('⚠️ 의상 변경 실패, 얼굴 변환 결과만 반환');
          usedMethod += ' + 의상변경 실패';
        }
      } catch (clothingError) {
        console.warn('⚠️ 의상 변경 중 오류:', clothingError);
        usedMethod += ' + 의상변경 오류';
      }
    }

    // 최종 결과 반환
    if (onProgress) {
      onProgress('변환 완료!');
    }
    
    return { 
      result: faceSwapResult, 
      method: usedMethod 
    };

  } catch (error) {
    console.error('❌ VModel 하이브리드 변환 실패:', error);
    throw error;
  }
};

/**
 * ✅ 기존 Firebase + Gemini 하이브리드 변환 (호환성 유지)
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
 * 🔄 스마트 변환 (VModel 우선, 실패시 Firebase/Gemini 폴백) - 호환성 유지
 */
export const smartFaceTransformation = async (
  originalImage: ImageFile,
  facePrompt: string,
  clothingPrompt: string,
  onProgress?: (status: string) => void,
  referenceImage?: ImageFile | null // 🆕 참고이미지 파라미터 추가
): Promise<{ result: ImageFile | null; method: string }> => {
  
  // 🆕 참고이미지가 있으면 VModel 하이브리드 사용
  if (referenceImage) {
    console.log('🎯 참고이미지 감지, VModel 하이브리드 시스템 사용');
    return await vmodelHybridTransformation(
      originalImage,
      referenceImage,
      facePrompt,
      clothingPrompt,
      onProgress
    );
  }

  // ✅ 기존 Firebase → Gemini 폴백 시스템 (참고이미지 없을 때)
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
 * 🆕 VModel 서비스 상태 확인
 */
export const checkVModelAvailability = async (): Promise<boolean> => {
  try {
    const vmodel = await loadVModelService();
    if (!vmodel || !vmodel.testVModelConnection) {
      return false;
    }
    return await vmodel.testVModelConnection();
  } catch (error) {
    console.error('VModel 연결 확인 실패:', error);
    return false;
  }
};

/**
 * ✅ 기존 Firebase 연결 상태 확인 (유지)
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
 * 🔄 서비스 상태 확인 - VModel 우선 시스템
 */
export const getHybridServiceStatus = () => {
  return {
    version: '8.0-VMODEL-FIREBASE-GEMINI-HYBRID',
    architecture: 'VModel 우선 + Firebase/Gemini 폴백',
    workflow: {
      vmodel: 'VModel AI 얼굴교체 (참고이미지 → 원본)',
      firebase_fallback: 'Firebase OpenAI (VModel 실패시)',
      gemini_fallback: 'Gemini 텍스트 프롬프트 (최종 폴백)',
      clothing: 'Gemini 의상변경 (모든 경우)'
    },
    inputTypes: {
      vmodel: '참고 얼굴 이미지 (jpg, png)',
      firebase: '텍스트 프롬프트 (Firebase OpenAI)',
      gemini: '텍스트 프롬프트 (Gemini)',
      clothing: '의상 설명 텍스트'
    },
    features: [
      '🎯 VModel AI 최우선 (고품질 얼굴교체)',
      '📸 사용자 참고이미지 업로드',
      '🛡️ 개인정보보호법 준수',
      '🔥 Firebase Functions 폴백 (9분 타임아웃)',
      '🔄 Gemini 최종 폴백',
      '👕 Gemini 의상변경',
      '⚡ 빠른 처리 속도',
      '💰 비용 효율적',
      '🎨 3단계 안전망'
    ],
    legalCompliance: [
      '✅ 사용자 직접 이미지 업로드',
      '✅ 얼굴 생성 없음 (교체만)',
      '✅ 개인정보 자동 생성 방지',
      '✅ 명확한 사용자 동의 절차'
    ],
    advantages: [
      '🎯 전용 얼굴교체 AI (더 자연스러운 결과)',
      '🔄 3단계 폴백 시스템 (VModel → Firebase → Gemini)',
      '⚡ 더 빠른 처리 (VModel: 30초, Firebase: 9분, Gemini: 14초)',
      '💵 예측 가능한 비용',
      '🔒 법적 안전성',
      '🎨 사용자 선택권 확대',
      '📉 복잡성 감소'
    ],
    services: {
      primary: 'VModel AI ($0.02/회)',
      secondary: 'Firebase Functions (9분 타임아웃)',
      tertiary: 'Google Gemini 2.5 Flash (14초)',
      clothing: 'Gemini 의상변경 (공통)'
    },
    urls: {
      vmodel: 'https://api.vmodel.ai/api/tasks/v1',
      firebase: 'https://us-central1-hgfaceswap-functions.cloudfunctions.net/openaiProxy',
      gemini: 'Google Gemini 2.5 Flash Image API'
    }
  };
};

/**
 * 🔄 안전성 검증 함수 - VModel 포함 의존성 확인
 */
export const validateServiceDependencies = async (): Promise<{
  vmodel: boolean;
  firebase: boolean;
  gemini: boolean;
  safe: boolean;
  errors: string[];
}> => {
  const errors: string[] = [];
  let vmodel = false;
  let firebase = false;
  let gemini = false;

  // VModel 서비스 확인
  try {
    const vmodelService = await loadVModelService();
    if (vmodelService && vmodelService.swapFaceWithVModel) {
      vmodel = true;
      console.log('✅ VModel 서비스 의존성 확인됨');
    } else {
      errors.push('VModel 서비스 함수 누락');
    }
  } catch (error) {
    errors.push('VModel 서비스 파일 누락');
    console.warn('⚠️ VModel 서비스 의존성 누락 (선택사항):', error);
  }

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

  // VModel은 선택사항이므로 Firebase나 Gemini 중 하나만 있어도 안전
  const safe = (firebase || gemini) && errors.length <= 1; // VModel 오류는 허용

  console.log('🔍 VModel 하이브리드 의존성 검증 결과:', {
    vmodel,
    firebase,
    gemini,
    safe,
    errors
  });

  return { vmodel, firebase, gemini, safe, errors };
};

// ✅ 호환성 유지를 위한 별칭들
export const hybridFaceTransformation = firebaseHybridTransformation;
