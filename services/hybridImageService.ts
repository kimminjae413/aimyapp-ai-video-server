// services/hybridImageService.ts - 최종 깔끔 버전
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
      return null;
    }
  }
  return vmodelService;
};

/**
 * 얼굴 변환 (사용자는 이 함수만 알면 됨)
 */
export const smartFaceTransformation = async (
  originalImage: ImageFile,
  facePrompt: string,
  clothingPrompt: string,
  referenceImage?: ImageFile | null,
  onProgress?: (status: string) => void
): Promise<{ result: ImageFile | null; method: string }> => {
  try {
    let result: ImageFile | null = null;

    // 참고이미지 있으면 VModel 시도
    if (referenceImage) {
      if (onProgress) onProgress('처리 중...');
      
      try {
        const vmodel = await loadVModelService();
        if (vmodel && vmodel.transformFaceWithVModel) {
          result = await vmodel.transformFaceWithVModel(
            originalImage,
            referenceImage,
            clothingPrompt
          );
          
          if (result) {
            if (onProgress) onProgress('완료!');
            return { result, method: 'success' };
          }
        }
      } catch (error) {
        // 실패해도 사용자에게 알리지 않고 Gemini로 폴백
      }
    }
    
    // Gemini 사용
    if (onProgress) onProgress('처리 중...');
    
    result = await changeFaceInImage(
      originalImage, 
      facePrompt,
      clothingPrompt
    );
    
    if (onProgress) onProgress('완료!');
    return { result, method: 'success' };
    
  } catch (error) {
    if (onProgress) onProgress('오류가 발생했습니다.');
    throw new Error('이미지 변환에 실패했습니다. 다른 이미지로 시도해보세요.');
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

// 호환성 유지
export const firebaseHybridTransformation = smartFaceTransformation;
export const hybridFaceTransformation = smartFaceTransformation;
export const vmodelHybridTransformation = smartFaceTransformation;
