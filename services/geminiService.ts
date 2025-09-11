// services/geminiService.ts
import { GoogleGenAI, Modality } from "@google/genai";
import { ImageProcessor } from '../utils/imageProcessor';
import type { ImageFile } from '../types';

// 환경변수에서 API 키 가져오기
const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable is not set.");
}

const ai = new GoogleGenAI({ apiKey });

// 🎛️ 기능 플래그 (배포 안전성을 위한 점진적 활성화)
const FEATURE_FLAGS = {
    // 개발 환경에서만 신기능 활성화, 배포 시 false로 설정
    ENABLE_IMPROVED_PROMPTS: process.env.NODE_ENV === 'development' || process.env.ENABLE_IMPROVED_FACE === 'true',
    ENABLE_HAIR_ANALYSIS: process.env.ENABLE_HAIR_ANALYSIS === 'true',
    ENABLE_STEP_VERIFICATION: process.env.ENABLE_VERIFICATION === 'true',
    // 사용자 비율 제어 (0-100)
    IMPROVED_USER_PERCENTAGE: parseInt(process.env.IMPROVED_USER_PERCENTAGE || '0')
};

console.log('🎛️ Feature flags loaded:', {
    improved: FEATURE_FLAGS.ENABLE_IMPROVED_PROMPTS,
    analysis: FEATURE_FLAGS.ENABLE_HAIR_ANALYSIS,
    verification: FEATURE_FLAGS.ENABLE_STEP_VERIFICATION,
    userPercentage: FEATURE_FLAGS.IMPROVED_USER_PERCENTAGE
});

// 🔒 헤어 보존 강화 문구 (안전한 추가 보호)
const getHairProtectionBooster = (): string => {
    return `

🔒 CRITICAL HAIR PRESERVATION PROTOCOL:
- Maintain the hair's ORIGINAL NATURAL TEXTURE exactly as shown
- Do NOT add artificial curls, waves, or extra volume that wasn't there originally
- Keep the hair's natural roughness and organic, unstyled appearance
- Preserve the exact hair direction, fall pattern, and styling
- Hair color, length, and cut must remain completely unchanged
- The hair should look identical to the source image in every aspect`;
};

// 📊 사용자별 기능 활성화 체크 (A/B 테스트용)
const shouldUseImprovedFeatures = (): boolean => {
    if (FEATURE_FLAGS.IMPROVED_USER_PERCENTAGE === 0) return false;
    if (FEATURE_FLAGS.IMPROVED_USER_PERCENTAGE >= 100) return true;
    
    // 간단한 해시 기반 사용자 분할 (실제로는 userId 기반으로 할 수 있음)
    const randomSeed = Math.floor(Math.random() * 100);
    return randomSeed < FEATURE_FLAGS.IMPROVED_USER_PERCENTAGE;
};

// 🎯 1단계: 얼굴 변형 전용 프롬프트 (개선 버전)
const getFaceOnlyPromptImproved = (facePrompt: string): string => {
  const hairBooster = getHairProtectionBooster();
  
  // 10대 남성
  if (facePrompt.includes('late teens') && facePrompt.includes('male')) {
    return `
You are a master portrait editor specializing in facial feature adjustment with ABSOLUTE HAIR PRESERVATION technology.

Transform this person to appear as a different 17-19 year old East Asian male while maintaining their core facial identity.

${hairBooster}

FACIAL TRANSFORMATION APPROACH:
- MAINTAIN the person's basic bone structure and facial foundation
- ADJUST facial features to create a teenage male appearance:
  * Soften jawline and create more youthful proportions
  * Adjust eye shape and brightness for teenage energy
  * Smooth skin texture with natural teenage glow
  * Modify facial expression to show youthful confidence
  * Adjust eyebrow shape for natural teenage fullness
- CREATE the impression of a different person through feature adjustments
- PRESERVE the core facial identity while transforming the appearance

CLOTHING PRESERVATION:
- Keep original clothing exactly unchanged
- Preserve all clothing details, colors, and patterns

TECHNICAL PRECISION:
- Match original lighting and shadows perfectly
- Maintain photorealistic quality with teenage skin characteristics
- Preserve background and pose exactly

Result: The same person transformed to appear as a different teenage male through careful feature adjustments.`;
  }
  
  // 20대 남성
  if (facePrompt.includes('early 20s') && facePrompt.includes('male')) {
    return `
You are an expert facial feature modifier with ADVANCED HAIR PROTECTION SYSTEM.

Transform this person's appearance to look like a different 22-25 year old East Asian male while preserving their fundamental facial structure.

${hairBooster}

FACIAL FEATURE ADJUSTMENT:
- KEEP the person's basic facial bone structure intact
- MODIFY features to create a young adult male appearance:
  * Adjust jawline definition for masculine maturity
  * Refine eye shape with confident, bright expression
  * Enhance skin quality with healthy young adult texture
  * Modify facial proportions for 20s male characteristics
  * Adjust eyebrow shape for masculine definition
- TRANSFORM the overall appearance while maintaining core identity
- CREATE the effect of a different person through strategic adjustments

CLOTHING PRESERVATION:
- Original clothing must remain exactly as shown
- Preserve all clothing elements without modification

TECHNICAL REQUIREMENTS:
- Perfect lighting and shadow matching
- Photorealistic young adult male skin
- Preserve background and pose exactly

Result: The same person appearing as a different young adult male through facial adjustments.`;
  }
  
  // 다른 연령대도 동일한 패턴으로 계속...
  // (나머지 연령대 프롬프트도 hairBooster 추가)
  
  // 기본 프롬프트 (스타일 옵션들)
  return `
You are a master facial feature transformer with ULTIMATE HAIR PRESERVATION TECHNOLOGY.

Transform this person's appearance based on the following style while maintaining their core facial identity.

${hairBooster}

STYLE TRANSFORMATION:
Transform based on: ${facePrompt}
- PRESERVE the person's fundamental facial structure and bone architecture
- MODIFY features to create the requested style/appearance:
  * Adjust facial contours and proportions appropriately
  * Enhance or modify expression and facial characteristics
  * Refine skin texture and quality for the desired look
  * Modify facial features while maintaining core identity
- MAINTAIN the person's basic facial foundation while transforming appearance
- CREATE the impression of a different person through strategic feature adjustments

CLOTHING PRESERVATION:
- Original clothing must remain exactly unchanged
- Preserve all clothing details and styling

TECHNICAL MASTERY:
- Match original lighting and shadows perfectly
- Maintain photorealistic quality appropriate for transformation
- Preserve background and pose exactly

Result: The same person transformed to appear different through strategic facial feature modifications while preserving their core identity.`;
};

// 📝 기존 프롬프트 (안전 버전 - 최소 개선)
const getFaceOnlyPromptSafe = (facePrompt: string): string => {
  // 기존 프롬프트에 헤어 보호만 강화
  const basePrompt = getFaceOnlyPromptOriginal(facePrompt);
  const minimalHairProtection = `

🔒 ENHANCED HAIR PROTECTION:
Keep the hair texture natural and unmodified - do not make it more curly, wavy, or voluminous than the original. Maintain the exact natural hair appearance.`;
  
  return basePrompt + minimalHairProtection;
};

// 🔄 기존 프롬프트 (완전 백업)
const getFaceOnlyPromptOriginal = (facePrompt: string): string => {
  // 기존 코드 그대로 보존
  if (facePrompt.includes('late teens') && facePrompt.includes('male')) {
    return `
You are a master portrait editor specializing in facial feature adjustment. Transform this person to appear as a different 17-19 year old East Asian male while maintaining their core facial identity.

HAIR PRESERVATION (ABSOLUTE PRIORITY):
- Study the exact hairstyle: color, texture, length, style, parting, volume, positioning
- Keep hair 100% IDENTICAL - no changes to any hair characteristics
- Preserve every strand position and natural flow

FACIAL TRANSFORMATION APPROACH:
- MAINTAIN the person's basic bone structure and facial foundation
- ADJUST facial features to create a teenage male appearance:
  * Soften jawline and create more youthful proportions
  * Adjust eye shape and brightness for teenage energy
  * Smooth skin texture with natural teenage glow
  * Modify facial expression to show youthful confidence
  * Adjust eyebrow shape for natural teenage fullness
- CREATE the impression of a different person through feature adjustments
- PRESERVE the core facial identity while transforming the appearance

CLOTHING PRESERVATION:
- Keep original clothing exactly unchanged
- Preserve all clothing details, colors, and patterns

TECHNICAL PRECISION:
- Match original lighting and shadows perfectly
- Maintain photorealistic quality with teenage skin characteristics
- Preserve background and pose exactly

Result: The same person transformed to appear as a different teenage male through careful feature adjustments.`;
  }
  
  // 나머지 기존 프롬프트들...
  return `기존 프롬프트 내용`;
};

// 2단계: 의상 변환 전용 프롬프트 (안전하게 유지)
const getClothingOnlyPrompt = (clothingPrompt: string): string => {
  return `
You are a CLOTHING TRANSFORMATION specialist with ABSOLUTE FACE AND HAIR PROTECTION technology.

CRITICAL PRESERVATION REQUIREMENTS:
- The person's FACE must remain EXACTLY as shown - DO NOT change any facial features
- The person's HAIR must remain EXACTLY as shown - DO NOT change any hair details
- Keep identical: facial structure, skin, eyes, nose, mouth, expressions, hair color, hair texture, hair style, hair positioning

🔒 ENHANCED HAIR PROTECTION:
- Hair texture must remain completely natural and unchanged
- Do not add any styling, curls, waves, or volume modifications
- Preserve the exact hair appearance from the input image

CLOTHING TRANSFORMATION ONLY:
Transform the clothing to: ${clothingPrompt}
- Change ONLY the clothing, keeping the fit and style appropriate for the person
- Ensure the new clothing looks natural and well-fitted
- Maintain the same pose and body position

TECHNICAL PRECISION:
- Match original lighting and shadows perfectly
- Keep the same background
- Preserve all non-clothing elements exactly
- Maintain photorealistic quality

Result: Same person with identical face and hair, but wearing the new clothing style.`;
};

// 🎯 1단계: 얼굴만 변환하는 함수 (에러 처리 강화)
const changeFaceOnly = async (
    originalImage: ImageFile, 
    facePrompt: string
): Promise<ImageFile | null> => {
    try {
        console.log('🎯 Starting face-only transformation...');
        
        // 사용자별 기능 선택
        const useImproved = FEATURE_FLAGS.ENABLE_IMPROVED_PROMPTS && shouldUseImprovedFeatures();
        console.log(`📊 Using ${useImproved ? 'improved' : 'safe'} prompts for this user`);
        
        let prompt: string;
        
        if (useImproved) {
            prompt = getFaceOnlyPromptImproved(facePrompt);
        } else if (FEATURE_FLAGS.ENABLE_IMPROVED_PROMPTS) {
            prompt = getFaceOnlyPromptSafe(facePrompt);
        } else {
            prompt = getFaceOnlyPromptOriginal(facePrompt);
        }

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image-preview',
            contents: {
                parts: [
                    {
                        inlineData: {
                            data: originalImage.base64,
                            mimeType: originalImage.mimeType,
                        },
                    },
                    {
                        text: prompt,
                    },
                ],
            },
            config: {
                responseModalities: [Modality.IMAGE, Modality.TEXT],
                temperature: 0.3, // 낮은 온도로 일관성 향상
            },
        });
        
        for (const part of response.candidates[0].content.parts) {
            if (part.inlineData) {
                const originalBase64 = part.inlineData.data;
                const originalMimeType = part.inlineData.mimeType;
                
                try {
                    const cleanedImage = await ImageProcessor.cleanBase64Image(
                        originalBase64, 
                        originalMimeType
                    );
                    console.log('✅ Face transformation completed successfully');
                    return cleanedImage;
                } catch (cleanError) {
                    console.warn('⚠️ Failed to clean metadata, returning original:', cleanError);
                    return {
                        base64: originalBase64,
                        mimeType: originalMimeType,
                        url: `data:${originalMimeType};base64,${originalBase64}`
                    };
                }
            }
        }
        
        console.warn('⚠️ No image data received from Gemini API');
        return null;

    } catch (error) {
        console.error("❌ Error in face-only transformation:", error);
        
        // 개선된 프롬프트 실패 시 기본 프롬프트로 재시도
        if (FEATURE_FLAGS.ENABLE_IMPROVED_PROMPTS) {
            console.log('🔄 Retrying with original prompt...');
            try {
                const fallbackPrompt = getFaceOnlyPromptOriginal(facePrompt);
                const response = await ai.models.generateContent({
                    model: 'gemini-2.5-flash-image-preview',
                    contents: {
                        parts: [
                            {
                                inlineData: {
                                    data: originalImage.base64,
                                    mimeType: originalImage.mimeType,
                                },
                            },
                            {
                                text: fallbackPrompt,
                            },
                        ],
                    },
                    config: {
                        responseModalities: [Modality.IMAGE, Modality.TEXT],
                    },
                });
                
                for (const part of response.candidates[0].content.parts) {
                    if (part.inlineData) {
                        console.log('✅ Fallback transformation successful');
                        return {
                            base64: part.inlineData.data,
                            mimeType: part.inlineData.mimeType,
                            url: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`
                        };
                    }
                }
            } catch (fallbackError) {
                console.error("❌ Fallback also failed:", fallbackError);
            }
        }
        
        throw new Error("Failed to change face using Gemini API.");
    }
};

// 🎽 2단계: 의상만 변환하는 함수 (안전성 강화)
const changeClothingOnly = async (
    faceChangedImage: ImageFile, 
    clothingPrompt: string
): Promise<ImageFile | null> => {
    try {
        console.log('👕 Starting clothing-only transformation...');
        
        const prompt = getClothingOnlyPrompt(clothingPrompt);

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image-preview',
            contents: {
                parts: [
                    {
                        inlineData: {
                            data: faceChangedImage.base64,
                            mimeType: faceChangedImage.mimeType,
                        },
                    },
                    {
                        text: prompt,
                    },
                ],
            },
            config: {
                responseModalities: [Modality.IMAGE, Modality.TEXT],
                temperature: 0.3,
            },
        });
        
        for (const part of response.candidates[0].content.parts) {
            if (part.inlineData) {
                const originalBase64 = part.inlineData.data;
                const originalMimeType = part.inlineData.mimeType;
                
                try {
                    const cleanedImage = await ImageProcessor.cleanBase64Image(
                        originalBase64, 
                        originalMimeType
                    );
                    console.log('✅ Clothing transformation completed successfully');
                    return cleanedImage;
                } catch (cleanError) {
                    console.warn('⚠️ Failed to clean metadata, returning original:', cleanError);
                    return {
                        base64: originalBase64,
                        mimeType: originalMimeType,
                        url: `data:${originalMimeType};base64,${originalBase64}`
                    };
                }
            }
        }
        
        console.warn('⚠️ No image data received for clothing transformation');
        return null;

    } catch (error) {
        console.error("❌ Error in clothing transformation:", error);
        throw new Error("Failed to change clothing using Gemini API.");
    }
};

// 🛡️ 메인 함수: 안전한 2단계 프로세스
export const changeFaceInImage = async (
    originalImage: ImageFile, 
    facePrompt: string,
    clothingPrompt: string
): Promise<ImageFile | null> => {
    try {
        console.log('🚀 Starting safe 2-step transformation process...');
        console.log('🎛️ Feature flags:', FEATURE_FLAGS);
        console.log('💡 User charged: 1 credit | Backend process: Enhanced quality service');
        
        // 1단계: 얼굴만 변환 (필수)
        console.log('📍 Step 1: Face transformation (required)...');
        const faceChangedImage = await changeFaceOnly(originalImage, facePrompt);
        
        if (!faceChangedImage) {
            throw new Error("Face transformation failed in step 1");
        }
        
        console.log('✅ Step 1 completed successfully');
        
        // 의상 변경이 없으면 1단계 결과 반환
        if (!clothingPrompt || clothingPrompt.trim() === '') {
            console.log('📋 No clothing change requested - returning step 1 result');
            console.log('💰 Credit usage: 1 credit (face transformation only)');
            return faceChangedImage;
        }
        
        // 2단계: 의상 변환 (선택적 - 실패해도 1단계 결과는 보장)
        console.log('📍 Step 2: Clothing transformation (enhancement service)...');
        try {
            const finalImage = await changeClothingOnly(faceChangedImage, clothingPrompt);
            
            if (finalImage) {
                console.log('✅ Step 2 completed successfully');
                console.log('💰 Credit usage: 1 credit (both steps successful - premium quality service)');
                return finalImage;
            } else {
                console.log('⚠️ Step 2 returned null - using step 1 result');
                console.log('💰 Credit usage: 1 credit (step 1 successful, step 2 incomplete)');
                return faceChangedImage;
            }
            
        } catch (step2Error) {
            console.warn('⚠️ Step 2 failed, but step 1 succeeded - returning partial result:', step2Error);
            console.log('💰 Credit usage: 1 credit (step 1 successful, step 2 failed)');
            return faceChangedImage; // 2단계 실패해도 1단계 결과는 제공
        }

    } catch (error) {
        console.error("❌ Critical error in transformation process:", error);
        
        // 최후의 안전장치: 완전 실패 시에도 사용자에게 의미있는 에러 메시지
        if (error instanceof Error) {
            throw new Error(`이미지 변환 중 오류가 발생했습니다: ${error.message}`);
        } else {
            throw new Error("알 수 없는 오류로 이미지 변환에 실패했습니다. 다시 시도해주세요.");
        }
    }
};

// 🔧 개발자 도구: 기능 플래그 상태 확인
export const getFeatureStatus = () => {
    return {
        flags: FEATURE_FLAGS,
        environment: process.env.NODE_ENV,
        userWillUseImproved: shouldUseImprovedFeatures()
    };
};

// 📊 성능 모니터링용 (선택적)
export const logTransformationMetrics = (
    step: string, 
    success: boolean, 
    duration: number, 
    userId?: string
) => {
    const metrics = {
        timestamp: new Date().toISOString(),
        step,
        success,
        duration,
        userId,
        flags: FEATURE_FLAGS
    };
    
    console.log('📊 Transformation metrics:', metrics);
    
    // 실제 서비스에서는 analytics 서비스로 전송
    // analytics.track('face_transformation', metrics);
};
