// services/hybridImageService.ts - VModel 얼굴교체 + Gemini 의상/배경변경
import { changeFaceInImage, changeClothingOnly } from './geminiService';
import type { ImageFile } from '../types';

// VModel 서비스 동적 import
let vmodelService: any = null;
const loadVModelService = async () => {
  if (!vmodelService) {
    try {
      vmodelService = await import('./vmodelService');
      return vmodelService;
    } catch (error) {
      console.warn('VModel 서비스 로드 실패:', error);
      return null;
    }
  }
  return vmodelService;
};

/**
 * 🔥 진짜 하이브리드: VModel 얼굴교체 → Gemini 의상/배경변경
 * 
 * @param originalImage - 원본 이미지
 * @param facePrompt - 얼굴 변경 프롬프트
 * @param clothingPrompt - 의상 변경 프롬프트
 * @param referenceImage - 참고할 얼굴 이미지
 * @param onProgress - 진행 상태 콜백
 * @param backgroundPrompt - 배경 변경 프롬프트 (✅ 새로 추가)
 */
export const smartFaceTransformation = async (
  originalImage: ImageFile,
  facePrompt: string,
  clothingPrompt: string,
  referenceImage?: ImageFile | null,
  onProgress?: (status: string) => void,
  backgroundPrompt?: string  // ✅ 배경 프롬프트 추가
): Promise<{ result: ImageFile | null; method: string }> => {
  try {
    let currentResult: ImageFile | null = null;
    let method = '';

    // 🎯 1단계: 얼굴 변경
    if (referenceImage) {
      console.log('🔥 HYBRID Step 1: VModel 얼굴교체 시작');
      
      if (onProgress) onProgress('VModel로 얼굴교체 중...');
      
      try {
        const vmodel = await loadVModelService();
        if (vmodel && vmodel.transformFaceWithVModel) {
          const faceResult = await vmodel.transformFaceWithVModel(
            originalImage,   // 원본 이미지 (target)
            referenceImage,  // 참고할 얼굴 (swap)
            clothingPrompt
          );
          
          if (faceResult) {
            console.log('✅ VModel 얼굴교체 성공');
            currentResult = faceResult;
            method = 'VModel 얼굴교체';
            
            // 🎯 2단계: 의상/배경 변경 (선택적)
            const hasClothing = clothingPrompt && clothingPrompt.trim();
            const hasBackground = backgroundPrompt && backgroundPrompt.trim();
            
            if (hasClothing || hasBackground) {
              console.log('🔥 HYBRID Step 2: Gemini 의상/배경 변경 시작');
              
              // 프롬프트 조합
              let combinedPrompt = '';
              if (hasClothing && hasBackground) {
                combinedPrompt = `Clothing: ${clothingPrompt}. Background: ${backgroundPrompt}.`;
                if (onProgress) onProgress('Gemini로 의상 및 배경 변경 중...');
              } else if (hasClothing) {
                combinedPrompt = `Clothing: ${clothingPrompt}.`;
                if (onProgress) onProgress('Gemini로 의상 변경 중...');
              } else if (hasBackground) {
                combinedPrompt = `Background: ${backgroundPrompt}.`;
                if (onProgress) onProgress('Gemini로 배경 변경 중...');
              }
              
              try {
                const enhancedResult = await changeClothingOnly(faceResult, combinedPrompt);
                if (enhancedResult) {
                  console.log('✅ Gemini 의상/배경 변경 성공');
                  currentResult = enhancedResult;
                  
                  // 메서드명 업데이트
                  if (hasClothing && hasBackground) {
                    method = 'VModel 얼굴교체 + Gemini 의상/배경 변경';
                  } else if (hasClothing) {
                    method = 'VModel 얼굴교체 + Gemini 의상 변경';
                  } else {
                    method = 'VModel 얼굴교체 + Gemini 배경 변경';
                  }
                } else {
                  console.log('⚠️ Gemini 의상/배경 변경 실패, 얼굴교체 결과만 사용');
                }
              } catch (enhanceError) {
                console.log('⚠️ Gemini 의상/배경 변경 실패:', enhanceError);
                // 의상/배경 변경 실패해도 얼굴교체 결과는 유지
              }
            }
            
            if (onProgress) onProgress('하이브리드 변환 완료!');
            return { result: currentResult, method };
          }
        }
      } catch (vmodelError) {
        console.log('VModel 실패, Gemini 전체 변환으로 폴백:', vmodelError);
      }
    }
    
    // 🔄 폴백: Gemini 전체 변환
    console.log('🔄 Gemini 전체 변환 시작 (VModel 실패 또는 참고이미지 없음)');
    if (onProgress) onProgress('Gemini AI로 변환 중...');
    
    // 폴백 시 프롬프트 조합
    let fallbackClothingPrompt = clothingPrompt;
    if (backgroundPrompt && backgroundPrompt.trim()) {
      fallbackClothingPrompt = clothingPrompt 
        ? `${clothingPrompt}. Background: ${backgroundPrompt}.`
        : `Background: ${backgroundPrompt}.`;
    }
    
    const result = await changeFaceInImage(
      originalImage, 
      referenceImage ? '참조이미지를 바탕으로 자연스러운 얼굴로 변환' : facePrompt,
      fallbackClothingPrompt
    );
    
    if (onProgress) onProgress('변환 완료!');
    return { result, method: 'Gemini AI 변환' };
    
  } catch (error) {
    console.error('모든 변환 방법 실패:', error);
    if (onProgress) onProgress('오류가 발생했습니다.');
    throw new Error('이미지 변환에 실패했습니다. 다른 이미지나 설정으로 시도해보세요.');
  }
};

/**
 * VModel 연결 상태 확인
 */
export const checkVModelAvailability = async (): Promise<boolean> => {
  try {
    const vmodel = await loadVModelService();
    if (!vmodel || !vmodel.testVModelConnection) {
      return false;
    }
    return await vmodel.testVModelConnection();
  } catch (error) {
    return false;
  }
};

/**
 * Firebase 연결 상태 확인 (호환성 유지)
 */
export const checkFirebaseAvailability = async (): Promise<boolean> => {
  return false;
};

/**
 * 서비스 상태 확인
 */
export const getHybridServiceStatus = () => {
  return {
    version: '4.1-TRUE-HYBRID-WITH-BACKGROUND',
    workflow: 'VModel 얼굴교체 → Gemini 의상/배경 변경',
    primary: 'VModel AI (참고이미지 기반 얼굴교체)',
    secondary: 'Gemini AI (텍스트 기반 의상/배경 변경)',
    fallback: 'Gemini AI (전체 변환)',
    features: [
      '🎯 VModel: 참고이미지 → 정밀 얼굴교체',
      '👔 Gemini: 텍스트 → 의상 변경',
      '🎨 Gemini: 텍스트 → 배경 변경 (NEW!)',
      '🔄 자동 폴백 시스템',
      '🎨 2단계 하이브리드 처리',
      '⚡ 최적화된 워크플로우'
    ]
  };
};

// 호환성 유지를 위한 별칭들
export const firebaseHybridTransformation = smartFaceTransformation;
export const hybridFaceTransformation = smartFaceTransformation;
export const vmodelHybridTransformation = smartFaceTransformation;
