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

// 🛡️ 안전 플래그: 환경변수로 제어
const ENABLE_TWO_STEP = process.env.ENABLE_TWO_STEP === 'true';
const ENABLE_ENHANCED_HAIR = process.env.ENABLE_ENHANCED_HAIR === 'true';

console.log('🎛️ Gemini Service Configuration:', { 
    twoStep: ENABLE_TWO_STEP, 
    enhancedHair: ENABLE_ENHANCED_HAIR 
});

// 🔒 헤어 보존 강화 문구
const getHairBooster = (): string => {
    if (!ENABLE_ENHANCED_HAIR) return '';
    
    return `

🔒 ADVANCED HAIR TEXTURE PROTECTION:
- Keep the hair's natural texture unchanged - do not make it more curly, wavy, or voluminous than shown in original
- Preserve exact hair styling direction and natural flow
- Maintain original hair density and thickness
- Keep identical hair parting and positioning`;
};

// 📝 연령별 최적화 프롬프트 (기존 방식)
const getOptimizedPrompt = (facePrompt: string, clothingPrompt: string): string => {
  const hairBooster = getHairBooster();
  
  // 10대 남성
  if (facePrompt.includes('late teens') && facePrompt.includes('male')) {
    return `
You are a professional portrait photographer specializing in teenage subjects. Transform this photo to show a teenage East Asian male face with these specific characteristics:

DETAILED FACE DESCRIPTION:
- Age: 17-19 years old with clear teenage features
- Skin: Very smooth, clear complexion with natural teenage glow and minimal facial hair
- Eyes: Bright, youthful eyes with clear whites and naturally thick eyelashes
- Facial structure: Softer jawline, slightly rounded cheeks, youthful bone structure
- Expression: Fresh, energetic expression with natural teenage confidence
- Eyebrows: Naturally thick and well-defined but not overly groomed

STRICT PRESERVATION REQUIREMENTS:
- Replace the original face completely with NO resemblance to the original person
- Match exact lighting, shadows, and ambient light from original photo
- Maintain photorealistic skin texture with teenage skin characteristics
- Keep identical hair style, color, texture, and position
- Preserve background and body pose exactly

STRICTLY FORBIDDEN (DO NOT CREATE):
- 곱슬머리, 부스스한 머리, 생머리 없이 (no curly hair, frizzy hair, straight hair changes)
- 헤어스타일 변화, 각도 변화 없이 (no hairstyle changes, angle changes)
- 배경 변화, 포즈 변화 없이 (no background change, pose change)

${clothingPrompt ? `- Change clothing to: ${clothingPrompt}` : '- Keep original clothing unchanged'}
${hairBooster}

Create a natural, authentic photograph of a completely different teenage male person.`;
  }
  
  // 20대 남성
  if (facePrompt.includes('early 20s') && facePrompt.includes('male')) {
    return `
You are a professional portrait photographer specializing in young adult subjects. Transform this photo to show a young adult East Asian male face with these specific characteristics:

DETAILED FACE DESCRIPTION:
- Age: 22-25 years old with fresh young adult features
- Skin: Healthy, clear skin with subtle masculine texture and light facial hair or clean-shaven
- Eyes: Confident, bright eyes with mature but youthful expression
- Facial structure: More defined jawline than teenage years, developing masculine features
- Expression: Fresh, optimistic expression with young adult charisma
- Eyebrows: Well-defined, naturally masculine shape

STRICT PRESERVATION REQUIREMENTS:
- Replace the original face completely with NO resemblance to the original person
- Match exact lighting, shadows, and ambient light from original photo
- Maintain photorealistic skin texture with young adult male characteristics
- Keep identical hair style, color, texture, and position
- Preserve background and body pose exactly

STRICTLY FORBIDDEN (DO NOT CREATE):
- 곱슬머리, 부스스한 머리, 생머리 없이 (no curly hair, frizzy hair, straight hair changes)
- 헤어스타일 변화, 각도 변화 없이 (no hairstyle changes, angle changes)
- 배경 변화, 포즈 변화 없이 (no background change, pose change)

${clothingPrompt ? `- Change clothing to: ${clothingPrompt}` : '- Keep original clothing unchanged'}
${hairBooster}

Create a natural, authentic photograph of a completely different young adult male person.`;
  }
  
  // 30대 남성
  if (facePrompt.includes('30s') && facePrompt.includes('male')) {
    return `
You are a professional portrait photographer specializing in mature adult subjects. Transform this photo to show a mature East Asian male face with these specific characteristics:

DETAILED FACE DESCRIPTION:
- Age: 30-35 years old with sophisticated mature features
- Skin: Refined skin with subtle signs of maturity, possible light wrinkles around eyes, well-groomed facial hair or clean-shaven
- Eyes: Intelligent, mature eyes with depth and life experience, possible slight crow's feet
- Facial structure: Strong, well-defined masculine jawline, mature bone structure, refined cheekbones
- Expression: Intellectual, confident expression with mature charisma and wisdom
- Eyebrows: Well-groomed, masculine eyebrows with possible few gray hairs

STRICT PRESERVATION REQUIREMENTS:
- Replace the original face completely with NO resemblance to the original person
- Match exact lighting, shadows, and ambient light from original photo
- Maintain photorealistic skin texture with mature male characteristics
- Keep identical hair style, color, texture, and position
- Preserve background and body pose exactly

STRICTLY FORBIDDEN (DO NOT CREATE):
- 곱슬머리, 부스스한 머리, 생머리 없이 (no curly hair, frizzy hair, straight hair changes)
- 헤어스타일 변화, 각도 변화 없이 (no hairstyle changes, angle changes)
- 배경 변화, 포즈 변화 없이 (no background change, pose change)

${clothingPrompt ? `- Change clothing to: ${clothingPrompt}` : '- Keep original clothing unchanged'}
${hairBooster}

Create a natural, authentic photograph of a completely different mature male person.`;
  }
  
  // 40대 남성
  if (facePrompt.includes('40s') && facePrompt.includes('male')) {
    return `
You are a professional portrait photographer specializing in distinguished middle-aged subjects. Transform this photo to show a distinguished East Asian male face with these specific characteristics:

DETAILED FACE DESCRIPTION:
- Age: 40-45 years old with distinguished middle-aged features
- Skin: Mature skin with natural aging signs, laugh lines, possible forehead lines, distinguished facial hair or clean-shaven
- Eyes: Wise, experienced eyes with depth, possible bags under eyes, mature expression
- Facial structure: Strong, fully developed masculine features, defined jawline, mature cheekbones
- Expression: Dignified, charismatic expression with authority and life experience
- Eyebrows: Mature eyebrows, possibly with some gray hairs, well-defined

STRICT PRESERVATION REQUIREMENTS:
- Replace the original face completely with NO resemblance to the original person
- Match exact lighting, shadows, and ambient light from original photo
- Maintain photorealistic skin texture with middle-aged male characteristics
- Keep identical hair style, color, texture, and position
- Preserve background and body pose exactly

STRICTLY FORBIDDEN (DO NOT CREATE):
- 곱슬머리, 부스스한 머리, 생머리 없이 (no curly hair, frizzy hair, straight hair changes)
- 헤어스타일 변화, 각도 변화 없이 (no hairstyle changes, angle changes)
- 배경 변화, 포즈 변화 없이 (no background change, pose change)

${clothingPrompt ? `- Change clothing to: ${clothingPrompt}` : '- Keep original clothing unchanged'}
${hairBooster}

Create a natural, authentic photograph of a completely different middle-aged male person.`;
  }
  
  // 10대 여성
  if (facePrompt.includes('late teens') && facePrompt.includes('female')) {
    return `
You are a professional portrait photographer specializing in teenage female subjects. Transform this photo to show a teenage East Asian female face with these specific characteristics:

DETAILED FACE DESCRIPTION:
- Age: 17-19 years old with innocent teenage female features
- Skin: Very smooth, porcelain-like clear skin with natural teenage glow and rosy cheeks
- Eyes: Large, bright innocent eyes with natural long eyelashes and youthful sparkle
- Facial structure: Soft, rounded facial features, delicate bone structure, small refined nose
- Expression: Sweet, innocent expression with natural teenage charm and shyness
- Eyebrows: Naturally shaped, soft eyebrows with youthful fullness

STRICT PRESERVATION REQUIREMENTS:
- Replace the original face completely with NO resemblance to the original person
- Match exact lighting, shadows, and ambient light from original photo
- Maintain photorealistic skin texture with teenage female characteristics
- Keep identical hair style, color, texture, and position
- Preserve background and body pose exactly

STRICTLY FORBIDDEN (DO NOT CREATE):
- 곱슬머리, 부스스한 머리, 생머리 없이 (no curly hair, frizzy hair, straight hair changes)
- 헤어스타일 변화, 각도 변화 없이 (no hairstyle changes, angle changes)
- 배경 변화, 포즈 변화 없이 (no background change, pose change)

${clothingPrompt ? `- Change clothing to: ${clothingPrompt}` : '- Keep original clothing unchanged'}
${hairBooster}

Create a natural, authentic photograph of a completely different teenage female person.`;
  }
  
  // 20대 여성 (현재 잘 작동하는 것)
  if (facePrompt.includes('early 20s') && facePrompt.includes('female')) {
    return `
You are a professional portrait photographer specializing in young adult female subjects. Transform this photo to show a vibrant East Asian female face with these specific characteristics:

DETAILED FACE DESCRIPTION:
- Age: 22-25 years old with vibrant young adult female features
- Skin: Smooth, healthy glowing skin with natural radiance and perfect complexion
- Eyes: Bright, lively eyes with natural beauty, expressive and confident gaze
- Facial structure: Refined feminine features, elegant bone structure, perfectly proportioned
- Expression: Vibrant, lively expression with young adult confidence and charm
- Eyebrows: Well-shaped, naturally beautiful eyebrows with youthful fullness

STRICT PRESERVATION REQUIREMENTS:
- Replace the original face completely with NO resemblance to the original person
- Match exact lighting, shadows, and ambient light from original photo
- Maintain photorealistic skin texture with young adult female characteristics
- Keep identical hair style, color, texture, and position
- Preserve background and body pose exactly

STRICTLY FORBIDDEN (DO NOT CREATE):
- 곱슬머리, 부스스한 머리, 생머리 없이 (no curly hair, frizzy hair, straight hair changes)
- 헤어스타일 변화, 각도 변화 없이 (no hairstyle changes, angle changes)
- 배경 변화, 포즈 변화 없이 (no background change, pose change)

${clothingPrompt ? `- Change clothing to: ${clothingPrompt}` : '- Keep original clothing unchanged'}
${hairBooster}

Create a natural, authentic photograph of a completely different young adult female person.`;
  }
  
  // 30대 여성
  if (facePrompt.includes('30s') && facePrompt.includes('female')) {
    return `
You are a professional portrait photographer specializing in sophisticated adult female subjects. Transform this photo to show an elegant East Asian female face with these specific characteristics:

DETAILED FACE DESCRIPTION:
- Age: 30-35 years old with sophisticated mature female features
- Skin: Refined, elegant skin with subtle maturity, natural glow with sophisticated texture
- Eyes: Sophisticated, intelligent eyes with depth and elegance, mature confidence
- Facial structure: Refined, elegant feminine features, mature bone structure, sophisticated beauty
- Expression: Elegant, sophisticated expression with mature feminine charm and intelligence
- Eyebrows: Perfectly groomed, elegant eyebrows with mature sophistication

STRICT PRESERVATION REQUIREMENTS:
- Replace the original face completely with NO resemblance to the original person
- Match exact lighting, shadows, and ambient light from original photo
- Maintain photorealistic skin texture with mature female characteristics
- Keep identical hair style, color, texture, and position
- Preserve background and body pose exactly

STRICTLY FORBIDDEN (DO NOT CREATE):
- 곱슬머리, 부스스한 머리, 생머리 없이 (no curly hair, frizzy hair, straight hair changes)
- 헤어스타일 변화, 각도 변화 없이 (no hairstyle changes, angle changes)
- 배경 변화, 포즈 변화 없이 (no background change, pose change)

${clothingPrompt ? `- Change clothing to: ${clothingPrompt}` : '- Keep original clothing unchanged'}
${hairBooster}

Create a natural, authentic photograph of a completely different mature female person.`;
  }
  
  // 40대 여성
  if (facePrompt.includes('40s') && facePrompt.includes('female')) {
    return `
You are a professional portrait photographer specializing in graceful middle-aged female subjects. Transform this photo to show a graceful East Asian female face with these specific characteristics:

DETAILED FACE DESCRIPTION:
- Age: 40-45 years old with graceful middle-aged female features
- Skin: Mature, graceful skin with natural aging signs, laugh lines around eyes, elegant texture
- Eyes: Wise, gentle eyes with depth and life experience, graceful mature expression
- Facial structure: Refined, graceful feminine features, mature elegant bone structure
- Expression: Graceful, gentle expression with maternal warmth and life wisdom
- Eyebrows: Mature, well-maintained eyebrows with graceful aging, possibly few gray hairs

STRICT PRESERVATION REQUIREMENTS:
- Replace the original face completely with NO resemblance to the original person
- Match exact lighting, shadows, and ambient light from original photo
- Maintain photorealistic skin texture with middle-aged female characteristics
- Keep identical hair style, color, texture, and position
- Preserve background and body pose exactly

STRICTLY FORBIDDEN (DO NOT CREATE):
- 곱슬머리, 부스스한 머리, 생머리 없이 (no curly hair, frizzy hair, straight hair changes)
- 헤어스타일 변화, 각도 변화 없이 (no hairstyle changes, angle changes)
- 배경 변화, 포즈 변화 없이 (no background change, pose change)

${clothingPrompt ? `- Change clothing to: ${clothingPrompt}` : '- Keep original clothing unchanged'}
${hairBooster}

Create a natural, authentic photograph of a completely different middle-aged female person.`;
  }
  
  // 기본 프롬프트 (스타일 옵션들)
  return `
You are a MASTER FACE SCULPTOR with the power to create COMPLETELY DIFFERENT human beings. Your mission: RADICAL FACE TRANSFORMATION that makes the person TOTALLY UNRECOGNIZABLE.

MANDATORY COMPLETE FACE RECONSTRUCTION:
- Transform based on: ${facePrompt}
- DESTROY original facial identity: Different eye architecture, nose geometry, mouth structure, face composition
- REBUILD with: Completely different facial proportions, feature placement, bone structure, genetic markers
- NEW GENETIC FEATURES: Different eye spacing/shape, nose bridge/width, lip thickness/shape, face ratios
- RADICAL TRANSFORMATION: Different skull shape, different facial planes, different human identity

EXTREME TRANSFORMATION REQUIREMENTS:
- ZERO DNA resemblance - must look like different ancestry, different genetics, different human being
- COMPLETELY UNRECOGNIZABLE facial features from original
- Transform into ENTIRELY DIFFERENT person with specified characteristics
- Annihilate ALL original facial DNA markers
- Different facial geometry, different feature harmony, different human essence

TECHNICAL PRECISION:
- Match original lighting/shadows PERFECTLY while changing EVERYTHING else
- Maintain photorealistic skin texture with natural details
- **ABSOLUTE HAIR PRESERVATION - MOST CRITICAL RULE:**
  - **NEVER CHANGE THE HAIR** - Keep IDENTICAL hairstyle, color, texture, length, every strand position
  - Hair must remain 100% EXACTLY as original - NO modifications whatsoever
  - **HAIR IS COMPLETELY OFF-LIMITS** for any transformation
- Keep identical background and pose

STRICTLY FORBIDDEN (DO NOT CREATE):
- 곱슬머리, 부스스한 머리, 생머리 없이 (no curly hair, frizzy hair, straight hair changes)
- 헤어스타일 변화, 각도 변화 없이 (no hairstyle changes, angle changes)
- 배경 변화, 포즈 변화 없이 (no background change, pose change)
- 얼굴 왜곡, 부자연스러운 얼굴 없이 (no facial distortion, unnatural face)

${clothingPrompt ? `- Change clothing to: ${clothingPrompt}` : '- Keep original clothing unchanged'}
${hairBooster}

Create a COMPLETELY DIFFERENT human being with specified traits - ZERO resemblance to original face.`;
};

// 🎯 2단계 방식: 얼굴만 변환
const changeFaceOnly = async (
    originalImage: ImageFile, 
    facePrompt: string
): Promise<ImageFile | null> => {
    try {
        console.log('🎯 Face-only transformation starting...');
        
        const prompt = `
You are a master facial feature transformer with HAIR PRESERVATION technology.

Transform this person's facial features based on: ${facePrompt}

CRITICAL PRESERVATION PROTOCOL:
- HAIR: Keep exact same hair texture - if naturally wavy, don't make it curly. Preserve original volume level and styling direction
- POSE: Maintain identical head angle, gaze direction, and body positioning from original image
- CLOTHING: Keep original clothing/accessories unchanged (salon cape, neck band, etc.)
- ANGLE: Preserve the same camera angle and perspective - do not change viewing angle

FACIAL TRANSFORMATION ONLY:
- Change only the facial features to match the requested style
- Keep identical lighting, shadows, and background
- Maintain same head positioning and pose

STRICTLY FORBIDDEN (DO NOT CREATE):
- 곱슬머리, 부스스한 머리, 생머리 없이 (no curly hair, frizzy hair, straight hair)
- 짧은 머리, 긴 머리 없이 (no short hair, long hair)
- 헤어스타일 변화 없이 (no hairstyle changes)
- 각도 변화, 포즈 변화 없이 (no angle change, pose change)
- 배경 변화, 의상 변화 없이 (no background change, clothing change)
- 얼굴 왜곡, 부자연스러운 얼굴 없이 (no facial distortion, unnatural face)

TECHNICAL REQUIREMENTS:
- Photorealistic result with natural facial proportions
- Zero changes to non-facial elements
- Exact preservation of pose and angle

Result: Same person with transformed facial features but identical hair and clothing.`;

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
                temperature: 0.3,
            },
        });
        
        if (!response.candidates || !response.candidates[0] || !response.candidates[0].content) {
            throw new Error('Invalid API response structure');
        }
        
        for (const part of response.candidates[0].content.parts) {
            if (part.inlineData) {
                const originalBase64 = part.inlineData.data;
                const originalMimeType = part.inlineData.mimeType;
                
                try {
                    const cleanedImage = await ImageProcessor.cleanBase64Image(
                        originalBase64, 
                        originalMimeType
                    );
                    console.log('✅ Face transformation completed');
                    return cleanedImage;
                } catch (cleanError) {
                    console.warn('⚠️ Metadata cleaning failed, using original');
                    return {
                        base64: originalBase64,
                        mimeType: originalMimeType,
                        url: `data:${originalMimeType};base64,${originalBase64}`
                    };
                }
            }
        }
        
        throw new Error('No image data in API response');

    } catch (error) {
        console.error("❌ Face transformation error:", error);
        throw error;
    }
};

// 🎽 2단계 방식: 옷만 변환
const changeClothingOnly = async (
    faceChangedImage: ImageFile, 
    clothingPrompt: string
): Promise<ImageFile | null> => {
    try {
        console.log('👕 Clothing-only transformation starting...');
        
        const prompt = `Transform only the clothing in this image to: ${clothingPrompt}

CRITICAL PRESERVATION:
- Keep the person's face EXACTLY as shown - no facial changes
- Keep the natural wavy hair EXACTLY as shown - no hair modifications
- Keep the same head angle, pose, and gaze direction
- Keep the same background and lighting

CLOTHING TRANSFORMATION ONLY:
- Change only the clothing/garments to the new style
- Ensure natural fit and appearance
- Maintain same body positioning

STRICTLY FORBIDDEN (DO NOT CREATE):
- 얼굴 변화, 헤어 변화 없이 (no face change, hair change)
- 각도 변화, 포즈 변화 없이 (no angle change, pose change)
- 배경 변화 없이 (no background change)

Result: Same person with identical face and hair wearing new clothing.`;

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
        
        if (!response.candidates || !response.candidates[0] || !response.candidates[0].content) {
            throw new Error('Invalid API response structure');
        }
        
        for (const part of response.candidates[0].content.parts) {
            if (part.inlineData) {
                const originalBase64 = part.inlineData.data;
                const originalMimeType = part.inlineData.mimeType;
                
                try {
                    const cleanedImage = await ImageProcessor.cleanBase64Image(
                        originalBase64, 
                        originalMimeType
                    );
                    console.log('✅ Clothing transformation completed');
                    return cleanedImage;
                } catch (cleanError) {
                    console.warn('⚠️ Metadata cleaning failed, using original');
                    return {
                        base64: originalBase64,
                        mimeType: originalMimeType,
                        url: `data:${originalMimeType};base64,${originalBase64}`
                    };
                }
            }
        }
        
        throw new Error('No image data in clothing transformation response');

    } catch (error) {
        console.error("❌ Clothing transformation error:", error);
        throw error;
    }
};

// 🛡️ 기존 단일 방식 (안전 백업)
const changeFaceInImageOriginal = async (
    originalImage: ImageFile, 
    facePrompt: string,
    clothingPrompt: string
): Promise<ImageFile | null> => {
    try {
        console.log('🔄 Using original single-step method');
        
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
        
        if (!response.candidates || !response.candidates[0] || !response.candidates[0].content) {
            throw new Error('Invalid API response structure');
        }
        
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
        console.error("Error calling Gemini API for image transformation:", error);
        throw new Error("Failed to change face using Gemini API.");
    }
};

// 🚀 메인 함수 (환경변수로 완전 제어)
export const changeFaceInImage = async (
    originalImage: ImageFile, 
    facePrompt: string,
    clothingPrompt: string
): Promise<ImageFile | null> => {
    try {
        console.log('🚀 Starting transformation...');
        console.log('🎛️ Configuration:', { twoStep: ENABLE_TWO_STEP, enhancedHair: ENABLE_ENHANCED_HAIR });
        
        // 2단계 방식 (환경변수로 제어)
        if (ENABLE_TWO_STEP) {
            console.log('📍 Using 2-step process');
            
            try {
                // 1단계: 얼굴 변환
                const faceResult = await changeFaceOnly(originalImage, facePrompt);
                
                if (!faceResult) {
                    throw new Error('Face transformation failed');
                }
                
                // 옷 변경 없으면 1단계만
                if (!clothingPrompt || clothingPrompt.trim() === '') {
                    console.log('✅ Face-only transformation complete');
                    return faceResult;
                }
                
                // 2단계: 옷 변환
                try {
                    const finalResult = await changeClothingOnly(faceResult, clothingPrompt);
                    if (finalResult) {
                        console.log('✅ 2-step transformation complete');
                        return finalResult;
                    } else {
                        console.log('⚠️ Step 2 failed, returning step 1 result');
                        return faceResult;
                    }
                } catch (step2Error) {
                    console.warn('⚠️ Step 2 error, returning step 1:', step2Error);
                    return faceResult;
                }
                
            } catch (twoStepError) {
                console.warn('⚠️ 2-step process failed, falling back to original:', twoStepError);
                return await changeFaceInImageOriginal(originalImage, facePrompt, clothingPrompt);
            }
        } else {
            // 기존 단일 방식
            console.log('📍 Using original single-step process');
            return await changeFaceInImageOriginal(originalImage, facePrompt, clothingPrompt);
        }

    } catch (error) {
        console.error("❌ Critical transformation error:", error);
        throw error;
    }
};

// 🔧 디버깅용 상태 확인
export const getServiceStatus = () => {
    return {
        twoStepEnabled: ENABLE_TWO_STEP,
        enhancedHairEnabled: ENABLE_ENHANCED_HAIR,
        environment: process.env.NODE_ENV,
        model: 'gemini-2.5-flash-image-preview'
    };
};
