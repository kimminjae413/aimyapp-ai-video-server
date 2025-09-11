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

// 연령별 최적화 프롬프트 함수 (Nano Banana 특성 반영)
const getOptimizedPrompt = (facePrompt: string, clothingPrompt: string): string => {
  
  // 10대 남성
  if (facePrompt.includes('late teens') && facePrompt.includes('male')) {
    return `
You are a master portrait editor specializing in facial feature adjustment. Transform this person to appear as a different 17-19 year old East Asian male while maintaining their core facial identity.

ABSOLUTE PRESERVATION REQUIREMENTS:
- HAIR: Keep EXACT same hairstyle, cut, length, texture, color, layers, styling - NO changes whatsoever
- HEAD ANGLE: Maintain IDENTICAL head position and viewing angle from original
- BACKGROUND: Keep the EXACT same background environment and lighting
- POSE: Preserve the EXACT same body position and pose

HAIR PRESERVATION (ABSOLUTE PRIORITY):
- Study the exact hairstyle: color, texture, length, style, parting, volume, positioning, layering
- Keep hair 100% IDENTICAL - no changes to any hair characteristics
- Preserve every strand position and natural flow
- Maintain exact cut style (layered/straight/etc.)

FACIAL TRANSFORMATION APPROACH:
- MAINTAIN the person's basic bone structure and facial foundation
- ADJUST facial features to create a teenage male appearance:
  * Soften jawline and create more youthful proportions (but same bone structure)
  * Adjust eye shape and brightness for teenage energy
  * Smooth skin texture with natural teenage glow
  * Modify facial expression to show youthful confidence
  * Adjust eyebrow shape for natural teenage fullness
- CREATE the impression of a different person through feature adjustments only
- PRESERVE the core facial identity while transforming the appearance

TECHNICAL PRECISION:
- Match original lighting and shadows perfectly
- Maintain photorealistic quality with teenage skin characteristics
- Preserve EXACT background, pose, head angle, hair completely
- Keep identical hair style, color, texture, and position
${clothingPrompt ? `- Change clothing to: ${clothingPrompt}` : '- Keep original clothing unchanged'}

Result: The same person transformed to appear as a different teenage male through facial adjustments only, with absolutely everything else identical.`;
  }
  
  // 20대 남성
  if (facePrompt.includes('early 20s') && facePrompt.includes('male')) {
    return `
You are an expert facial feature modifier. Transform this person's appearance to look like a different 22-25 year old East Asian male while preserving their fundamental facial structure.

ABSOLUTE PRESERVATION REQUIREMENTS:
- HAIR: Keep EXACT same hairstyle, cut, length, texture, color, layers, styling - NO changes whatsoever
- HEAD ANGLE: Maintain IDENTICAL head position and viewing angle from original
- BACKGROUND: Keep the EXACT same background environment and lighting
- POSE: Preserve the EXACT same body position and pose

CRITICAL HAIR PRESERVATION:
- Analyze and memorize: exact hair color, texture, length, style, parting, volume, positioning, layering
- Hair must remain completely unchanged - preserve every detail
- Maintain identical hair flow and styling
- Preserve the exact cut style (layered/straight/etc.)

FACIAL FEATURE ADJUSTMENT:
- KEEP the person's basic facial bone structure intact
- MODIFY features to create a young adult male appearance:
  * Adjust jawline definition for masculine maturity (but same bone structure)
  * Refine eye shape with confident, bright expression
  * Enhance skin quality with healthy young adult texture
  * Modify facial expression while maintaining same head angle
  * Adjust eyebrow shape for masculine definition
- TRANSFORM the overall appearance while maintaining core identity
- CREATE the effect of a different person through strategic adjustments

TECHNICAL REQUIREMENTS:
- Perfect lighting and shadow matching
- Photorealistic young adult male skin
- Preserve EXACT background, pose, head angle, hair completely
- Keep identical hair style, color, texture, and position
${clothingPrompt ? `- Change clothing to: ${clothingPrompt}` : '- Keep original clothing unchanged'}

Result: The same person appearing as a different young adult male through facial adjustments only, with absolutely everything else identical.`;
  }
  
  // 30대 남성
  if (facePrompt.includes('30s') && facePrompt.includes('male')) {
    return `
You are a skilled facial transformation specialist. Modify this person's features to appear as a different 30-35 year old East Asian male while maintaining their underlying facial structure.

ABSOLUTE PRESERVATION REQUIREMENTS:
- HAIR: Keep EXACT same hairstyle, cut, length, texture, color, layers, styling - NO changes whatsoever
- HEAD ANGLE: Maintain IDENTICAL head position and viewing angle from original
- BACKGROUND: Keep the EXACT same background environment and lighting
- POSE: Preserve the EXACT same body position and pose

HAIR PRESERVATION PROTOCOL:
- Study hair characteristics: color, texture, length, style, parting, volume, positioning, layering
- Preserve hair with absolute accuracy - no modifications allowed
- Keep every strand and styling detail identical
- Maintain exact cut style (layered/straight/etc.)

MATURE MALE TRANSFORMATION:
- PRESERVE the person's fundamental bone structure
- ADJUST features for mature male appearance:
  * Refine jawline and facial contours for masculine maturity (but same bone structure)
  * Modify eye expression for intelligent, experienced look
  * Enhance skin texture with subtle maturity signs
  * Adjust facial expression while maintaining same head angle
  * Refine eyebrow shape with mature masculine definition
- MAINTAIN core facial identity while creating different appearance
- ACHIEVE the effect of a different person through careful modifications

TECHNICAL EXECUTION:
- Match original lighting and ambient conditions
- Photorealistic mature male skin characteristics
- Preserve EXACT background, pose, head angle, hair completely
- Keep identical hair style, color, texture, and position
${clothingPrompt ? `- Change clothing to: ${clothingPrompt}` : '- Keep original clothing unchanged'}

Result: The same person transformed to appear as a different mature male through facial refinements only, with absolutely everything else identical.`;
  }
  
  // 40대 남성  
  if (facePrompt.includes('40s') && facePrompt.includes('male')) {
    return `
You are a master facial feature sculptor. Transform this person to appear as a different 40-45 year old East Asian male while preserving their core facial identity.

ABSOLUTE PRESERVATION REQUIREMENTS:
- HAIR: Keep EXACT same hairstyle, cut, length, texture, color, layers, styling - NO changes whatsoever
- HEAD ANGLE: Maintain IDENTICAL head position and viewing angle from original
- BACKGROUND: Keep the EXACT same background environment and lighting
- POSE: Preserve the EXACT same body position and pose

ABSOLUTE HAIR PRESERVATION:
- Analyze hairstyle details: color, texture, length, style, parting, volume, positioning, layering
- Hair is completely off-limits for changes - preserve perfectly
- Maintain every strand position and natural styling
- Preserve the exact cut style (layered/straight/etc.)

DISTINGUISHED MALE TRANSFORMATION:
- KEEP the person's basic facial architecture
- MODIFY features for distinguished middle-aged appearance:
  * Enhance jawline definition with mature masculine strength (but same bone structure)
  * Adjust eye expression for wisdom and life experience
  * Refine skin texture with natural aging characteristics
  * Modify facial expression while maintaining same head angle
  * Adjust eyebrow shape with mature sophistication
- PRESERVE underlying facial structure while transforming look
- CREATE impression of different person through strategic adjustments

TECHNICAL MASTERY:
- Perfect lighting and shadow preservation
- Photorealistic middle-aged male skin
- Preserve EXACT background, pose, head angle, hair completely
- Keep identical hair style, color, texture, and position
${clothingPrompt ? `- Change clothing to: ${clothingPrompt}` : '- Keep original clothing unchanged'}

Result: The same person appearing as a different distinguished male through facial modifications only, with absolutely everything else identical.`;
  }
  
  // 10대 여성
  if (facePrompt.includes('late teens') && facePrompt.includes('female')) {
    return `
You are an expert portrait modifier. Transform this person to appear as a different 17-19 year old East Asian female while maintaining their fundamental facial characteristics.

ABSOLUTE PRESERVATION REQUIREMENTS:
- HAIR: Keep EXACT same hairstyle, cut, length, texture, color, layers, styling - NO changes whatsoever
- HEAD ANGLE: Maintain IDENTICAL head position and viewing angle from original
- BACKGROUND: Keep the EXACT same background environment and lighting
- POSE: Preserve the EXACT same body position and pose

HAIR PRESERVATION (TOP PRIORITY):
- Study and memorize exact hairstyle: color, texture, length, style, parting, volume, positioning, layering
- Hair must remain completely identical - no changes permitted
- Preserve every detail of hair styling and flow
- Maintain exact cut style (layered/straight/etc.)

TEENAGE FEMALE TRANSFORMATION:
- MAINTAIN the person's core facial structure
- ADJUST features for innocent teenage female appearance:
  * Soften facial contours with youthful roundness (but same bone structure)
  * Enhance eye brightness with innocent sparkle
  * Perfect skin texture with natural teenage glow
  * Modify facial expression for sweet, shy charm
  * Adjust eyebrow shape for natural youthful softness
- PRESERVE basic facial identity while creating different look
- ACHIEVE appearance of different person through gentle modifications

TECHNICAL PRECISION:
- Match original lighting perfectly
- Photorealistic teenage female skin characteristics
- Preserve EXACT background, pose, head angle, hair completely
- Keep identical hair style, color, texture, and position
${clothingPrompt ? `- Change clothing to: ${clothingPrompt}` : '- Keep original clothing unchanged'}

Result: The same person transformed to appear as a different teenage female through facial adjustments only, with absolutely everything else identical.`;
  }
  
  // 20대 여성 
  if (facePrompt.includes('early 20s') && facePrompt.includes('female')) {
    return `
You are a skilled facial feature artist. Modify this person's appearance to look like a different 22-25 year old East Asian female while preserving their core facial foundation.

ABSOLUTE PRESERVATION REQUIREMENTS:
- HAIR: Keep EXACT same hairstyle, cut, length, texture, color, layers, styling - NO changes whatsoever
- HEAD ANGLE: Maintain IDENTICAL head position and viewing angle from original
- BACKGROUND: Keep the EXACT same background environment and lighting
- POSE: Preserve the EXACT same body position and pose

CRITICAL HAIR PRESERVATION:
- Analyze hair: exact color, texture, length, style, parting, volume, positioning, layering
- Hair preservation is MANDATORY - absolutely no modifications allowed
- Keep every strand and styling detail identical
- Preserve the exact cut style (layered/straight/etc.)

FACIAL FEATURE ADJUSTMENT ONLY:
- KEEP the person's fundamental facial structure
- REFINE features for vibrant young adult female appearance:
  * Enhance facial contours with elegant femininity (but same bone structure)
  * Adjust eye expression for confident, lively charm
  * Perfect skin quality with natural radiant glow
  * Modify facial expression while maintaining same head angle
  * Adjust eyebrow shape for naturally beautiful definition
- MAINTAIN underlying identity while transforming appearance
- CREATE effect of different person through strategic facial refinements only

TECHNICAL EXCELLENCE:
- Perfect lighting and shadow matching to original environment
- Photorealistic young adult female skin
- Preserve EXACT background, pose, head angle, hair completely
- Keep identical hair style, color, texture, and position
${clothingPrompt ? `- Change clothing to: ${clothingPrompt}` : '- Keep original clothing unchanged'}

Result: The same person appearing as a different young adult female through facial refinements only, with absolutely everything else identical.`;
  }
  
  // 30대 여성
  if (facePrompt.includes('30s') && facePrompt.includes('female')) {
    return `
You are a master facial transformation artist. Transform this person to appear as a different 30-35 year old East Asian female while maintaining their essential facial characteristics.

ABSOLUTE PRESERVATION REQUIREMENTS:
- HAIR: Keep EXACT same hairstyle, cut, length, texture, color, layers, styling - NO changes whatsoever
- HEAD ANGLE: Maintain IDENTICAL head position and viewing angle from original
- BACKGROUND: Keep the EXACT same background environment and lighting
- POSE: Preserve the EXACT same body position and pose

HAIR PRESERVATION MANDATE:
- Study hair details: color, texture, length, style, parting, volume, positioning, layering
- Preserve hair with complete accuracy - no changes permitted
- Keep every aspect of hairstyle identical
- Maintain exact cut style (layered/straight/etc.)

SOPHISTICATED FEMALE TRANSFORMATION:
- PRESERVE the person's core facial architecture
- ENHANCE features for sophisticated mature female appearance:
  * Refine facial contours with elegant maturity (but same bone structure)
  * Adjust eye expression for intelligent sophistication
  * Enhance skin texture with mature grace
  * Modify facial expression while maintaining same head angle
  * Adjust eyebrow shape for sophisticated definition
- MAINTAIN basic facial identity while creating different impression
- ACHIEVE appearance of different person through elegant modifications

TECHNICAL MASTERY:
- Match original lighting and conditions
- Photorealistic mature female skin characteristics
- Preserve EXACT background, pose, head angle, hair completely
- Keep identical hair style, color, texture, and position
${clothingPrompt ? `- Change clothing to: ${clothingPrompt}` : '- Keep original clothing unchanged'}

Result: The same person transformed to appear as a different sophisticated female through facial enhancements only, with absolutely everything else identical.`;
  }
  
  // 40대 여성
  if (facePrompt.includes('40s') && facePrompt.includes('female')) {
    return `
You are an expert facial feature enhancer. Modify this person to appear as a different 40-45 year old East Asian female while preserving their fundamental facial structure.

ABSOLUTE PRESERVATION REQUIREMENTS:
- HAIR: Keep EXACT same hairstyle, cut, length, texture, color, layers, styling - NO changes whatsoever
- HEAD ANGLE: Maintain IDENTICAL head position and viewing angle from original
- BACKGROUND: Keep the EXACT same background environment and lighting
- POSE: Preserve the EXACT same body position and pose

ABSOLUTE HAIR PRESERVATION:
- Analyze hairstyle: color, texture, length, style, parting, volume, positioning, layering
- Hair is completely protected from changes - preserve perfectly
- Maintain every detail of hair styling
- Preserve the exact cut style (layered/straight/etc.)

GRACEFUL FEMALE TRANSFORMATION:
- KEEP the person's essential facial foundation
- ADJUST features for graceful middle-aged female appearance:
  * Enhance facial contours with mature grace (but same bone structure)
  * Modify eye expression for gentle wisdom
  * Refine skin texture with natural elegant aging
  * Adjust facial expression while maintaining same head angle
  * Enhance eyebrow shape with mature sophistication
- PRESERVE core identity while transforming overall look
- CREATE impression of different person through graceful adjustments

TECHNICAL EXCELLENCE:
- Perfect lighting and shadow preservation
- Photorealistic middle-aged female skin
- Preserve EXACT background, pose, head angle, hair completely
- Keep identical hair style, color, texture, and position
${clothingPrompt ? `- Change clothing to: ${clothingPrompt}` : '- Keep original clothing unchanged'}

Result: The same person appearing as a different graceful middle-aged female through facial adjustments only, with absolutely everything else identical.`;
  }
  
  // 기본 프롬프트 (스타일 옵션들)
  return `
You are a master facial feature transformer with advanced preservation technology. Transform this person's appearance based on the following style while maintaining their core facial identity.

ABSOLUTE PRESERVATION REQUIREMENTS:
- HAIR: Keep EXACT same hairstyle, cut, length, texture, color, layers, styling - NO changes whatsoever
- HEAD ANGLE: Maintain IDENTICAL head position and viewing angle from original
- BACKGROUND: Keep the EXACT same background environment and lighting
- POSE: Preserve the EXACT same body position and pose

HAIR PRESERVATION PROTOCOL:
- Analyze hair: exact color, texture, length, style, parting, volume, positioning, layering
- Hair is completely off-limits for modifications - preserve with perfect accuracy
- Keep every strand and styling detail identical
- Maintain exact cut style (layered/straight/etc.)

STYLE TRANSFORMATION:
Transform based on: ${facePrompt}
- PRESERVE the person's fundamental facial structure and bone architecture
- MODIFY features to create the requested style/appearance:
  * Adjust facial contours and proportions appropriately (but same bone structure)
  * Enhance or modify expression and facial characteristics
  * Refine skin texture and quality for the desired look
  * Modify facial expression while maintaining same head angle
- MAINTAIN the person's basic facial foundation while transforming appearance
- CREATE the impression of a different person through strategic feature adjustments

TECHNICAL MASTERY:
- Match original lighting and shadows perfectly
- Maintain photorealistic quality appropriate for transformation
- Preserve EXACT background, pose, head angle, hair completely
- Keep identical hair style, color, texture, and position
${clothingPrompt ? `- Change clothing to: ${clothingPrompt}` : '- Keep original clothing unchanged'}

Result: The same person transformed to appear different through strategic facial feature modifications only, preserving their core identity and absolutely everything else identical.`;
};

export const changeFaceInImage = async (
    originalImage: ImageFile, 
    facePrompt: string,
    clothingPrompt: string
): Promise<ImageFile | null> => {
    try {
        // 연령별 최적화 프롬프트 사용
        const prompt = getOptimizedPrompt(facePrompt, clothingPrompt);

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
                
                // 메타데이터 제거 처리
                try {
                    const cleanedImage = await ImageProcessor.cleanBase64Image(
                        originalBase64, 
                        originalMimeType
                    );
                    return cleanedImage;
                } catch (cleanError) {
                    console.warn('Failed to clean metadata, returning original:', cleanError);
                    // 메타데이터 제거 실패 시 원본 반환
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
        console.error("Error calling Gemini API for image application:", error);
        throw new Error("Failed to change face using Gemini API.");
    }
};
