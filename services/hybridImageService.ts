// services/hybridImageService.ts - VModel 얼굴교체 + Gemini 의상변경
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
 * 🔥 진짜 하이브리드: VModel 얼굴교체 → Gemini 의상변경
 */
export const smartFaceTransformation = async (
  originalImage: ImageFile,
  facePrompt: string,
  clothingPrompt: string,
  referenceImage?: ImageFile | null,
  onProgress?: (status: string) => void
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
            
            // 🎯 2단계: 의상변경 (선택적)
            if (clothingPrompt && clothingPrompt.trim()) {
              console.log('🔥 HYBRID Step 2: Gemini 의상변경 시작');
              if (onProgress) onProgress('Gemini로 의상변경 중...');
              
              try {
                const clothingResult = await changeClothingOnly(faceResult, clothingPrompt);
                if (clothingResult) {
                  console.log('✅ Gemini 의상변경 성공');
                  currentResult = clothingResult;
                  method = 'VModel 얼굴교체 + Gemini 의상변경';
                } else {
                  console.log('⚠️ Gemini 의상변경 실패, 얼굴교체 결과만 사용');
                }
              } catch (clothingError) {
                console.log('⚠️ Gemini 의상변경 실패:', clothingError);
                // 의상변경 실패해도 얼굴교체 결과는 유지
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
    
    const result = await changeFaceInImage(
      originalImage, 
      referenceImage ? '참조이미지를 바탕으로 자연스러운 얼굴로 변환' : facePrompt,
      clothingPrompt
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
    version: '4.0-TRUE-HYBRID',
    workflow: 'VModel 얼굴교체 → Gemini 의상변경',
    primary: 'VModel AI (참고이미지 기반 얼굴교체)',
    secondary: 'Gemini AI (텍스트 기반 의상변경)',
    fallback: 'Gemini AI (전체 변환)',
    features: [
      '🎯 VModel: 참고이미지 → 정밀 얼굴교체',
      '👔 Gemini: 텍스트 → 의상변경',
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
