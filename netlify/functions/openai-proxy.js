// services/geminiService.ts
import { GoogleGenAI, Modality } from "@google/genai";
import { ImageProcessor } from '../utils/imageProcessor';
import type { ImageFile } from '../types';

// 🆕 Gemini 2.0 Flash 업데이트
console.log('GEMINI SERVICE VERSION: 4.0 - USING 2.0-FLASH-EXP');
console.log('File timestamp:', new Date().toISOString());

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable is not set.");
}

const ai = new GoogleGenAI({ apiKey });

console.log('Gemini Service Configuration:', { 
    model: 'gemini-2.0-flash-exp',
    features: ['faster_processing', 'improved_image_generation', 'latest_capabilities']
});

// 심플한 프롬프트 (최종 개선된 버전)
const getSimplePrompt = (facePrompt: string, clothingPrompt: string): string => {
  
  // 20대 남성
  if (facePrompt.includes('early 20s') && facePrompt.includes('male')) {
    return `
Transform **only the facial features** to those of a distinct East Asian male in his 20s. **It is imperative that the hair, including the fringe, length, texture, style, and color, remains perfectly unchanged and identical to the original image.** Absolutely no alterations to the hair. The background and pose must also be preserved.
${clothingPrompt ? `Change clothing to: ${clothingPrompt}` : ''}`;
  }
  
  // 20대 여성
  if (facePrompt.includes('early 20s') && facePrompt.includes('female')) {
    return `
Transform **only the facial features** to those of a distinct East Asian female in her 20s. **It is imperative that the hair, including the fringe, length, texture, style, and color, remains perfectly unchanged and identical to the original image.** Absolutely no alterations to the hair. The background and pose must also be preserved.
${clothingPrompt ? `Change clothing to: ${clothingPrompt}` : ''}`;
  }
  
  // 기본값
  return `
Transform **only the facial features** based on: ${facePrompt}. **It is imperative that the hair, including the fringe, length, texture, style, and color, remains perfectly unchanged and identical to the original image.** Absolutely no alterations to the hair. The background and pose must also be preserved.
${clothingPrompt ? `Change clothing to: ${clothingPrompt}` : ''}`;
};

// 2단계 방식: 옷만 변환 (심플) - 🔥 export 추가
export const changeClothingOnly = async (
    faceChangedImage: ImageFile, 
    clothingPrompt: string
): Promise<ImageFile | null> => {
    try {
        console.log('🔄 [Gemini 2.0 Flash] Clothing-only transformation starting...');
        
        const prompt = `
Change only the clothing to: ${clothingPrompt}
Keep the face, hair, pose, and background exactly the same.`;

        const startTime = Date.now();

        const response = await ai.models.generateContent({
            model: 'gemini-2.0-flash-exp', // 🆕 2.0 Flash 사용
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
                temperature: 0.3, // 일관성을 위해 낮은 temperature
            },
        });
        
        const responseTime = Date.now() - startTime;
        console.log('⚡ [Gemini 2.0 Flash] Clothing response time:', responseTime + 'ms');
        
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
                    console.log('✅ [Gemini 2.0 Flash] Clothing transformation completed in', responseTime + 'ms');
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
        console.error("❌ [Gemini 2.0 Flash] Clothing transformation error:", error);
        throw error;
    }
};

// 메인 함수 - 수동 2단계 방식
export const changeFaceInImage = async (
    originalImage: ImageFile, 
    facePrompt: string,
    clothingPrompt: string
): Promise<ImageFile | null> => {
    try {
        console.log('🚀 [Gemini 2.0 Flash] Starting transformation...');
        
        // 1단계: 얼굴만 변환 (기존 방식으로)
        console.log('👤 Step 1: Face transformation only');
        const prompt = getSimplePrompt(facePrompt, ''); // 의상 변경 없이 얼굴만
        
        const step1StartTime = Date.now();
        
        const response = await ai.models.generateContent({
            model: 'gemini-2.0-flash-exp', // 🆕 2.0 Flash 사용
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
                temperature: 0.4, // 얼굴 변환은 약간 더 창의적
            },
        });
        
        const step1Time = Date.now() - step1StartTime;
        console.log('⚡ [Gemini 2.0 Flash] Step 1 response time:', step1Time + 'ms');
        
        if (!response.candidates || !response.candidates[0] || !response.candidates[0].content) {
            throw new Error('Invalid API response structure');
        }
        
        let faceResult: ImageFile | null = null;
        
        for (const part of response.candidates[0].content.parts) {
            if (part.inlineData) {
                const originalBase64 = part.inlineData.data;
                const originalMimeType = part.inlineData.mimeType;
                
                try {
                    faceResult = await ImageProcessor.cleanBase64Image(
                        originalBase64, 
                        originalMimeType
                    );
                } catch (cleanError) {
                    console.warn('⚠️ Failed to clean metadata, returning original:', cleanError);
                    faceResult = {
                        base64: originalBase64,
                        mimeType: originalMimeType,
                        url: `data:${originalMimeType};base64,${originalBase64}`
                    };
                }
                break;
            }
        }
        
        if (!faceResult) {
            throw new Error('No image data in face transformation response');
        }
        
        console.log('✅ Step 1 completed - face transformed in', step1Time + 'ms');
        
        // 의상 변경이 없으면 1단계 결과만 반환
        if (!clothingPrompt || clothingPrompt.trim() === '') {
            console.log('🏁 [Gemini 2.0 Flash] Face-only transformation completed');
            return faceResult;
        }
        
        // 2단계: 의상만 변경
        console.log('👕 Step 2: Clothing transformation');
        const step2StartTime = Date.now();
        
        const clothingPromptText = `
Change only the clothing to: ${clothingPrompt}
Keep the face, hair, pose, and background exactly the same.`;

        const clothingResponse = await ai.models.generateContent({
            model: 'gemini-2.0-flash-exp', // 🆕 2.0 Flash 사용
            contents: {
                parts: [
                    {
                        inlineData: {
                            data: faceResult.base64,
                            mimeType: faceResult.mimeType,
                        },
                    },
                    {
                        text: clothingPromptText,
                    },
                ],
            },
            config: {
                responseModalities: [Modality.IMAGE, Modality.TEXT],
                temperature: 0.3, // 의상은 더 일관되게
            },
        });
        
        const step2Time = Date.now() - step2StartTime;
        const totalTime = step1Time + step2Time;
        
        console.log('⚡ [Gemini 2.0 Flash] Step 2 response time:', step2Time + 'ms');
        console.log('⚡ [Gemini 2.0 Flash] Total time:', totalTime + 'ms');
        
        if (!clothingResponse.candidates || !clothingResponse.candidates[0] || !clothingResponse.candidates[0].content) {
            console.warn('⚠️ Clothing transformation failed, returning face result');
            return faceResult;
        }
        
        for (const part of clothingResponse.candidates[0].content.parts) {
            if (part.inlineData) {
                const originalBase64 = part.inlineData.data;
                const originalMimeType = part.inlineData.mimeType;
                
                try {
                    const finalResult = await ImageProcessor.cleanBase64Image(
                        originalBase64, 
                        originalMimeType
                    );
                    console.log('✅ [Gemini 2.0 Flash] All steps completed in', totalTime + 'ms');
                    return finalResult;
                } catch (cleanError) {
                    console.warn('⚠️ Failed to clean final metadata, returning original:', cleanError);
                    return {
                        base64: originalBase64,
                        mimeType: originalMimeType,
                        url: `data:${originalMimeType};base64,${originalBase64}`
                    };
                }
            }
        }
        
        console.warn('⚠️ No clothing transformation result, returning face result');
        return faceResult;

    } catch (error) {
        console.error("❌ [Gemini 2.0 Flash] Critical transformation error:", error);
        throw error;
    }
};

// 디버깅용 상태 확인
export const getServiceStatus = () => {
    return {
        model: 'gemini-2.5-flash',
        version: '4.0',
        features: ['2x_faster_than_1.5_pro', 'latest_multimodal', 'improved_consistency'],
        environment: process.env.NODE_ENV
    };
};
