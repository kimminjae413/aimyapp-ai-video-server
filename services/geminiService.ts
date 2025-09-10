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

// 연령별 최적화 프롬프트 함수
const getOptimizedPrompt = (facePrompt: string, clothingPrompt: string): string => {
  
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

TECHNICAL REQUIREMENTS:
- Replace the original face completely with NO resemblance to the original person
- Match exact lighting, shadows, and ambient light from original photo
- Maintain photorealistic skin texture with teenage skin characteristics
- Keep identical hair style, color, texture, and position
- Preserve background and body pose exactly
${clothingPrompt ? `- Change clothing to: ${clothingPrompt}` : '- Keep original clothing unchanged'}

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

TECHNICAL REQUIREMENTS:
- Replace the original face completely with NO resemblance to the original person
- Match exact lighting, shadows, and ambient light from original photo
- Maintain photorealistic skin texture with young adult male characteristics
- Keep identical hair style, color, texture, and position
- Preserve background and body pose exactly
${clothingPrompt ? `- Change clothing to: ${clothingPrompt}` : '- Keep original clothing unchanged'}

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

TECHNICAL REQUIREMENTS:
- Replace the original face completely with NO resemblance to the original person
- Match exact lighting, shadows, and ambient light from original photo
- Maintain photorealistic skin texture with mature male characteristics
- Keep identical hair style, color, texture, and position
- Preserve background and body pose exactly
${clothingPrompt ? `- Change clothing to: ${clothingPrompt}` : '- Keep original clothing unchanged'}

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

TECHNICAL REQUIREMENTS:
- Replace the original face completely with NO resemblance to the original person
- Match exact lighting, shadows, and ambient light from original photo
- Maintain photorealistic skin texture with middle-aged male characteristics
- Keep identical hair style, color, texture, and position
- Preserve background and body pose exactly
${clothingPrompt ? `- Change clothing to: ${clothingPrompt}` : '- Keep original clothing unchanged'}

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

TECHNICAL REQUIREMENTS:
- Replace the original face completely with NO resemblance to the original person
- Match exact lighting, shadows, and ambient light from original photo
- Maintain photorealistic skin texture with teenage female characteristics
- Keep identical hair style, color, texture, and position
- Preserve background and body pose exactly
${clothingPrompt ? `- Change clothing to: ${clothingPrompt}` : '- Keep original clothing unchanged'}

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

TECHNICAL REQUIREMENTS:
- Replace the original face completely with NO resemblance to the original person
- Match exact lighting, shadows, and ambient light from original photo
- Maintain photorealistic skin texture with young adult female characteristics
- Keep identical hair style, color, texture, and position
- Preserve background and body pose exactly
${clothingPrompt ? `- Change clothing to: ${clothingPrompt}` : '- Keep original clothing unchanged'}

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

TECHNICAL REQUIREMENTS:
- Replace the original face completely with NO resemblance to the original person
- Match exact lighting, shadows, and ambient light from original photo
- Maintain photorealistic skin texture with mature female characteristics
- Keep identical hair style, color, texture, and position
- Preserve background and body pose exactly
${clothingPrompt ? `- Change clothing to: ${clothingPrompt}` : '- Keep original clothing unchanged'}

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

TECHNICAL REQUIREMENTS:
- Replace the original face completely with NO resemblance to the original person
- Match exact lighting, shadows, and ambient light from original photo
- Maintain photorealistic skin texture with middle-aged female characteristics
- Keep identical hair style, color, texture, and position
- Preserve background and body pose exactly
${clothingPrompt ? `- Change clothing to: ${clothingPrompt}` : '- Keep original clothing unchanged'}

Create a natural, authentic photograph of a completely different middle-aged female person.`;
  }
  
  // 기본 프롬프트 (매치되지 않는 경우 - 스타일 옵션들)
  return `
You are a professional portrait photographer and digital artist. Transform this photo with these requirements:

FACE TRANSFORMATION:
- Create a completely new face based on: ${facePrompt}
- Replace original face with NO resemblance to the original person
- Match exact lighting, shadows, and ambient light from original photo
- Maintain photorealistic skin texture with natural details
- Keep identical hair style, color, texture, and position
- Preserve background and body pose exactly
${clothingPrompt ? `- Change clothing to: ${clothingPrompt}` : '- Keep original clothing unchanged'}

Create a natural, authentic photograph of a completely different person with the specified characteristics.`;
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
                
                // 🧹 메타데이터 제거 처리
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
