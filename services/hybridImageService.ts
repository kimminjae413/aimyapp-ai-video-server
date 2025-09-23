// services/hybridImageService.ts - 최종 완성 버전
import { changeFaceInImage } from './geminiService';
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
 * 스마트 얼굴 변환 (VModel 우선, Gemini 폴백)
 */
export const smartFaceTransformation = async (
  originalImage: ImageFile,
  facePrompt: string,
  clothingPrompt: string,
  onProgress?: (status: string) => void,
  referenceImage?: ImageFile | null
): Promise<{ result: ImageFile | null; method: string }> => {
  try {
    // 참고이미지가 있으면 VModel 시도
    if (referenceImage) {
      console.log('참고이미지 기반 VModel 변환 시도');
      
      if (onProgress) onProgress('AI가 얼굴을 분석하고 있습니다...');
      
      try {
        const vmodel = await loadVModelService();
        if (vmodel && vmodel.swapFaceWithVModel) {
          const result = await vmodel.swapFaceWithVModel(
            referenceImage,  // 참고할 얼굴
            originalImage,   // 원본 이미지
            onProgress
          );
          
          if (result) {
            console.log('VModel 변환 성공');
            if (onProgress) onProgress('변환 완료!');
            return { result, method: 'VModel AI 얼굴교체' };
          }
        }
      } catch (vmodelError) {
        console.log('VModel 실패, Gemini로 폴백:', vmodelError);
        // VModel 실패해도 사용자에게 알리지 않고 Gemini로 폴백
      }
    }
    
    // Gemini 사용 (VModel 실패 시 또는 참고이미지 없을 때)
    console.log('Gemini 변환 시작');
    if (onProgress) onProgress('AI가 이미지를 처리하고 있습니다...');
    
    const result = await changeFaceInImage(
      originalImage, 
      facePrompt,
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
  return false; // Firebase 제거했으므로 항상 false
};

/**
 * 서비스 상태 확인
 */
export const getHybridServiceStatus = () => {
  return {
    version: '3.0-VMODEL-PRIORITY',
    primary: 'VModel AI (참고이미지 기반)',
    fallback: 'Gemini AI (텍스트 기반)',
    userExperience: '깔끔한 메시지만 표시',
    features: [
      'VModel: 참고이미지 → 원본이미지 얼굴교체',
      'Gemini: 텍스트 설명 → 얼굴 변환',
      '자동 폴백 시스템',
      '사용자 친화적 메시지'
    ]
  };
};

// 호환성 유지를 위한 별칭들
export const firebaseHybridTransformation = smartFaceTransformation;
export const hybridFaceTransformation = smartFaceTransformation;
export const vmodelHybridTransformation = smartFaceTransformation;
