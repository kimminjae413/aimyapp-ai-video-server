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

// 안전 플래그: 일단 false로 설정해서 기존 방식으로 테스트
const ENABLE_TWO_STEP = false; // process.env.ENABLE_TWO_STEP === 'true';

console.log('Gemini Service Configuration:', { 
    twoStep: ENABLE_TWO_STEP
});

// 심플한 프롬프트 (테스트용)
const getSimplePrompt = (facePrompt: string, clothingPrompt: string): string => {
  
  // 20대 남성
  if (facePrompt.includes('early 20s') && facePrompt.includes('male')) {
    return `
Change this person's face to look like a different 20s East Asian male.
Keep the hair exactly the same - same style, texture, and color.
Keep the same pose and background.
${clothingPrompt ? `Change clothing to: ${clothingPrompt}` : 'Keep original clothing.'}

IMPORTANT: Do not change the hairstyle.`;
  }
  
  // 20대 여성
  if (facePrompt.includes('early 20s') && facePrompt.includes('female')) {
    return `
Change this person's face to look like a different 20s East Asian female.
Keep the hair exactly the same - same style, texture, and color.
Keep the same pose and background.
${clothingPrompt ? `Change clothing to: ${clothingPrompt}` : 'Keep original clothing.'}

IMPORTANT: Do not change the hairstyle.`;
  }
  
  // 기본값
  return `
Change only the face based on: ${facePrompt}
Keep hair, pose, and background identical.
${clothingPrompt ? `Change clothing to: ${clothingPrompt}` : 'Keep original clothing.'}

IMPORTANT: Do not change the hairstyle.`;
};

// 2단계 방식: 얼굴만 변환 (심플)
const changeFaceOnly = async (
    originalImage: ImageFile, 
    facePrompt: string
): Promise<ImageFile | null> => {
    try {
        console.log('Face-only transformation starting...');
        
        const prompt = `
Change only the face to: ${facePrompt}
Keep everything else exactly the same - hair, clothing, pose, background.

Do not change the hairstyle.`;

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
                    console.log('Face transformation completed');
                    return cleanedImage;
                } catch (cleanError) {
                    console.warn('Metadata cleaning failed, using original');
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
        console.error("Face transformation error:", error);
        throw error;
    }
};

// 2단계 방식: 옷만 변환 (심플)
const changeClothingOnly = async (
    faceChangedImage: ImageFile, 
    clothingPrompt: string
): Promise<ImageFile | null> => {
    try {
        console.log('Clothing-only transformation starting...');
        
        const prompt = `
Change only the clothing to: ${clothingPrompt}
Keep the face, hair, pose, and background exactly the same.`;

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
                    console.log('Clothing transformation completed');
                    return cleanedImage;
                } catch (cleanError) {
                    console.warn('Metadata cleaning failed, using original');
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
        console.error("Clothing transformation error:", error);
        throw error;
    }
};

// 기존 단일 방식 (심플)
const changeFaceInImageOriginal = async (
    originalImage: ImageFile, 
    facePrompt: string,
    clothingPrompt: string
): Promise<ImageFile | null> => {
    try {
        console.log('Using original single-step method');
        
        const prompt = getSimplePrompt(facePrompt, clothingPrompt);

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

// 메인 함수
export const changeFaceInImage = async (
    originalImage: ImageFile, 
    facePrompt: string,
    clothingPrompt: string
): Promise<ImageFile | null> => {
    try {
        console.log('Starting transformation...');
        console.log('Two-step enabled:', ENABLE_TWO_STEP);
        
        // 2단계 방식
        if (ENABLE_TWO_STEP) {
            console.log('Using 2-step process');
            
            try {
                // 1단계: 얼굴 변환
                const faceResult = await changeFaceOnly(originalImage, facePrompt);
                
                if (!faceResult) {
                    throw new Error('Face transformation failed');
                }
                
                // 옷 변경 없으면 1단계만
                if (!clothingPrompt || clothingPrompt.trim() === '') {
                    console.log('Face-only transformation complete');
                    return faceResult;
                }
                
                // 2단계: 옷 변환
                try {
                    const finalResult = await changeClothingOnly(faceResult, clothingPrompt);
                    if (finalResult) {
                        console.log('2-step transformation complete');
                        return finalResult;
                    } else {
                        console.log('Step 2 failed, returning step 1 result');
                        return faceResult;
                    }
                } catch (step2Error) {
                    console.warn('Step 2 error, returning step 1:', step2Error);
                    return faceResult;
                }
                
            } catch (twoStepError) {
                console.warn('2-step process failed, falling back to original:', twoStepError);
                return await changeFaceInImageOriginal(originalImage, facePrompt, clothingPrompt);
            }
        } else {
            // 기존 단일 방식
            console.log('Using original single-step process');
            return await changeFaceInImageOriginal(originalImage, facePrompt, clothingPrompt);
        }

    } catch (error) {
        console.error("Critical transformation error:", error);
        throw error;
    }
};

// 디버깅용 상태 확인
export const getServiceStatus = () => {
    return {
        twoStepEnabled: ENABLE_TWO_STEP,
        environment: process.env.NODE_ENV,
        model: 'gemini-2.5-flash-image-preview'
    };
};
