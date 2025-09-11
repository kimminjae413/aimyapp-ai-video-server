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

// 1단계: 얼굴 변형 전용 프롬프트 (Nano Banana 특성에 맞게)
const getFaceOnlyPrompt = (facePrompt: string): string => {
  
  // 10대 남성
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
  
  // 20대 남성
  if (facePrompt.includes('early 20s') && facePrompt.includes('male')) {
    return `
You are an expert facial feature modifier. Transform this person's appearance to look like a different 22-25 year old East Asian male while preserving their fundamental facial structure.

CRITICAL HAIR PRESERVATION:
- Analyze and memorize: exact hair color, texture, length, style, parting, volume, positioning
- Hair must remain completely unchanged - preserve every detail
- Maintain identical hair flow and styling

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
  
  // 30대 남성
  if (facePrompt.includes('30s') && facePrompt.includes('male')) {
    return `
You are a skilled facial transformation specialist. Modify this person's features to appear as a different 30-35 year old East Asian male while maintaining their underlying facial structure.

HAIR PRESERVATION PROTOCOL:
- Study hair characteristics: color, texture, length, style, parting, volume, positioning
- Preserve hair with absolute accuracy - no modifications allowed
- Keep every strand and styling detail identical

MATURE MALE TRANSFORMATION:
- PRESERVE the person's fundamental bone structure
- ADJUST features for mature male appearance:
  * Refine jawline and facial contours for masculine maturity
  * Modify eye expression for intelligent, experienced look
  * Enhance skin texture with subtle maturity signs
  * Adjust facial proportions for sophisticated appearance
  * Refine eyebrow shape with mature masculine definition
- MAINTAIN core facial identity while creating different appearance
- ACHIEVE the effect of a different person through careful modifications

CLOTHING PRESERVATION:
- Keep original clothing completely unchanged
- Preserve all clothing details and styling

TECHNICAL EXECUTION:
- Match original lighting and ambient conditions
- Photorealistic mature male skin characteristics
- Preserve background and body pose exactly

Result: The same person transformed to appear as a different mature male through feature refinements.`;
  }
  
  // 40대 남성  
  if (facePrompt.includes('40s') && facePrompt.includes('male')) {
    return `
You are a master facial feature sculptor. Transform this person to appear as a different 40-45 year old East Asian male while preserving their core facial identity.

ABSOLUTE HAIR PRESERVATION:
- Analyze hairstyle details: color, texture, length, style, parting, volume, positioning
- Hair is completely off-limits for changes - preserve perfectly
- Maintain every strand position and natural styling

DISTINGUISHED MALE TRANSFORMATION:
- KEEP the person's basic facial architecture
- MODIFY features for distinguished middle-aged appearance:
  * Enhance jawline definition with mature masculine strength
  * Adjust eye expression for wisdom and life experience
  * Refine skin texture with natural aging characteristics
  * Modify facial contours for distinguished appearance
  * Adjust eyebrow shape with mature sophistication
- PRESERVE underlying facial structure while transforming look
- CREATE impression of different person through strategic adjustments

CLOTHING PRESERVATION:
- Original clothing must remain exactly unchanged
- Keep all clothing elements identical

TECHNICAL MASTERY:
- Perfect lighting and shadow preservation
- Photorealistic middle-aged male skin
- Preserve background and pose exactly

Result: The same person appearing as a different distinguished male through facial modifications.`;
  }
  
  // 10대 여성
  if (facePrompt.includes('late teens') && facePrompt.includes('female')) {
    return `
You are an expert portrait modifier. Transform this person to appear as a different 17-19 year old East Asian female while maintaining their fundamental facial characteristics.

HAIR PRESERVATION (TOP PRIORITY):
- Study and memorize exact hairstyle: color, texture, length, style, parting, volume, positioning
- Hair must remain completely identical - no changes permitted
- Preserve every detail of hair styling and flow

TEENAGE FEMALE TRANSFORMATION:
- MAINTAIN the person's core facial structure
- ADJUST features for innocent teenage female appearance:
  * Soften facial contours with youthful roundness
  * Enhance eye brightness with innocent sparkle
  * Perfect skin texture with natural teenage glow
  * Modify facial expression for sweet, shy charm
  * Adjust eyebrow shape for natural youthful softness
- PRESERVE basic facial identity while creating different look
- ACHIEVE appearance of different person through gentle modifications

CLOTHING PRESERVATION:
- Keep original clothing exactly as shown
- Preserve all clothing details without changes

TECHNICAL PRECISION:
- Match original lighting perfectly
- Photorealistic teenage female skin characteristics
- Preserve background and pose exactly

Result: The same person transformed to appear as a different teenage female through feature adjustments.`;
  }
  
  // 20대 여성 
  if (facePrompt.includes('early 20s') && facePrompt.includes('female')) {
    return `
You are a skilled facial feature artist. Modify this person's appearance to look like a different 22-25 year old East Asian female while preserving their core facial foundation.

CRITICAL HAIR PRESERVATION:
- Analyze hair: exact color, texture, length, style, parting, volume, positioning
- Hair preservation is mandatory - no modifications allowed
- Keep every strand and styling detail identical

VIBRANT FEMALE TRANSFORMATION:
- KEEP the person's fundamental facial structure
- REFINE features for vibrant young adult female appearance:
  * Enhance facial contours with elegant femininity
  * Adjust eye expression for confident, lively charm
  * Perfect skin quality with natural radiant glow
  * Modify facial proportions for refined beauty
  * Adjust eyebrow shape for naturally beautiful definition
- MAINTAIN underlying identity while transforming appearance
- CREATE effect of different person through strategic refinements

CLOTHING PRESERVATION:
- Original clothing must remain unchanged
- Preserve all clothing elements perfectly

TECHNICAL EXCELLENCE:
- Perfect lighting and shadow matching
- Photorealistic young adult female skin
- Preserve background and pose exactly

Result: The same person appearing as a different young adult female through facial refinements.`;
  }
  
  // 30대 여성
  if (facePrompt.includes('30s') && facePrompt.includes('female')) {
    return `
You are a master facial transformation artist. Transform this person to appear as a different 30-35 year old East Asian female while maintaining their essential facial characteristics.

HAIR PRESERVATION MANDATE:
- Study hair details: color, texture, length, style, parting, volume, positioning
- Preserve hair with complete accuracy - no changes permitted
- Keep every aspect of hairstyle identical

SOPHISTICATED FEMALE TRANSFORMATION:
- PRESERVE the person's core facial architecture
- ENHANCE features for sophisticated mature female appearance:
  * Refine facial contours with elegant maturity
  * Adjust eye expression for intelligent sophistication
  * Enhance skin texture with mature grace
  * Modify facial proportions for refined elegance
  * Adjust eyebrow shape for sophisticated definition
- MAINTAIN basic facial identity while creating different impression
- ACHIEVE appearance of different person through elegant modifications

CLOTHING PRESERVATION:
- Keep original clothing completely unchanged
- Preserve all clothing details exactly

TECHNICAL MASTERY:
- Match original lighting and conditions
- Photorealistic mature female skin characteristics
- Preserve background and pose exactly

Result: The same person transformed to appear as a different sophisticated female through feature enhancements.`;
  }
  
  // 40대 여성
  if (facePrompt.includes('40s') && facePrompt.includes('female')) {
    return `
You are an expert facial feature enhancer. Modify this person to appear as a different 40-45 year old East Asian female while preserving their fundamental facial structure.

ABSOLUTE HAIR PRESERVATION:
- Analyze hairstyle: color, texture, length, style, parting, volume, positioning
- Hair is completely protected from changes - preserve perfectly
- Maintain every detail of hair styling

GRACEFUL FEMALE TRANSFORMATION:
- KEEP the person's essential facial foundation
- ADJUST features for graceful middle-aged female appearance:
  * Enhance facial contours with mature grace
  * Modify eye expression for gentle wisdom
  * Refine skin texture with natural elegant aging
  * Adjust facial proportions for dignified beauty
  * Enhance eyebrow shape with mature sophistication
- PRESERVE core identity while transforming overall look
- CREATE impression of different person through graceful adjustments

CLOTHING PRESERVATION:
- Original clothing must remain exactly unchanged
- Keep all clothing elements identical

TECHNICAL EXCELLENCE:
- Perfect lighting and shadow preservation
- Photorealistic middle-aged female skin
- Preserve background and pose exactly

Result: The same person appearing as a different graceful middle-aged female through feature adjustments.`;
  }
  
  // 기본 프롬프트 (스타일 옵션들)
  return `
You are a master facial feature transformer with advanced preservation technology. Transform this person's appearance based on the following style while maintaining their core facial identity.

HAIR PRESERVATION PROTOCOL:
- Analyze hair: exact color, texture, length, style, parting, volume, positioning
- Hair is completely off-limits for modifications - preserve with perfect accuracy
- Keep every strand and styling detail identical

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

// 2단계: 의상 변환 전용 프롬프트
const getClothingOnlyPrompt = (clothingPrompt: string): string => {
  return `
You are a CLOTHING TRANSFORMATION specialist with ABSOLUTE FACE AND HAIR PROTECTION technology.

CRITICAL PRESERVATION REQUIREMENTS:
- The person's FACE must remain EXACTLY as shown - DO NOT change any facial features
- The person's HAIR must remain EXACTLY as shown - DO NOT change any hair details
- Keep identical: facial structure, skin, eyes, nose, mouth, expressions, hair color, hair texture, hair style, hair positioning

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

// 1단계: 얼굴만 변환하는 함수
const changeFaceOnly = async (
    originalImage: ImageFile, 
    facePrompt: string
): Promise<ImageFile | null> => {
    try {
        const prompt = getFaceOnlyPrompt(facePrompt);

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
                    return cleanedImage;
                } catch (cleanError) {
                    console.warn('Failed to clean metadata, returning original:', cleanError);
                    return {
                        base64: originalBase64,
                        mimeType: originalMimeType,
                        url: `data:${originalMimeType};base64,${originalBase64}`
                    };
                }
            }
        }
        return null;

    } catch (error) {
        console.error("Error calling Gemini API for face transformation:", error);
        throw new Error("Failed to change face using Gemini API.");
    }
};

// 2단계: 의상만 변환하는 함수
const changeClothingOnly = async (
    faceChangedImage: ImageFile, 
    clothingPrompt: string
): Promise<ImageFile | null> => {
    try {
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
                    return cleanedImage;
                } catch (cleanError) {
                    console.warn('Failed to clean metadata, returning original:', cleanError);
                    return {
                        base64: originalBase64,
                        mimeType: originalMimeType,
                        url: `data:${originalMimeType};base64,${originalBase64}`
                    };
                }
            }
        }
        return null;

    } catch (error) {
        console.error("Error calling Gemini API for clothing transformation:", error);
        throw new Error("Failed to change clothing using Gemini API.");
    }
};

// 메인 함수: 2단계 프로세스 (사용자는 1크레딧만 차감)
export const changeFaceInImage = async (
    originalImage: ImageFile, 
    facePrompt: string,
    clothingPrompt: string
): Promise<ImageFile | null> => {
    try {
        console.log('🎯 Starting 2-step transformation process...');
        console.log('💡 User will be charged for 1 credit, but backend processes 2 steps for better quality');
        
        // 1단계: 얼굴만 변환
        console.log('📍 Step 1: Face transformation only...');
        const faceChangedImage = await changeFaceOnly(originalImage, facePrompt);
        
        if (!faceChangedImage) {
            throw new Error("Face transformation failed in step 1");
        }
        
        // 의상 변경이 없으면 1단계 결과 반환
        if (!clothingPrompt) {
            console.log('✅ Step 1 complete - no clothing change requested');
            console.log('💰 Credit usage: 1 credit (face transformation only)');
            return faceChangedImage;
        }
        
        // 2단계: 의상만 변환 (추가 비용 없음 - 품질 향상 서비스)
        console.log('📍 Step 2: Clothing transformation only (free quality enhancement)...');
        const finalImage = await changeClothingOnly(faceChangedImage, clothingPrompt);
        
        if (!finalImage) {
            console.warn('⚠️ Step 2 failed, returning step 1 result');
            console.log('💰 Credit usage: 1 credit (step 1 successful, step 2 failed)');
            return faceChangedImage; // 2단계 실패 시 1단계 결과라도 반환
        }
        
        console.log('✅ 2-step transformation complete!');
        console.log('💰 Credit usage: 1 credit (both steps successful - enhanced quality service)');
        return finalImage;

    } catch (error) {
        console.error("Error in 2-step transformation process:", error);
        throw new Error("Failed to transform image using 2-step process.");
    }
};
