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

export const changeFaceInImage = async (
    originalImage: ImageFile, 
    facePrompt: string,
    clothingPrompt: string
): Promise<ImageFile | null> => {
    try {
        const prompt = `
You are an expert digital artist specializing in photorealistic image editing. Your task is to modify a person's photo with surgical precision.

**Primary Objective: Face Replacement**
- Replace the original face with a new one based on this description: "${facePrompt}".
- The new face must be completely different, with no resemblance to the original.
- The new face must be seamlessly blended, matching the original lighting, shadows, and head angle.

**Secondary Objective: Clothing Replacement (if applicable)**
${clothingPrompt ? `- Replace the original clothing with a new outfit described as: "${clothingPrompt}".` : "- The original clothing must not be changed."}

**Strict, Non-Negotiable Constraints:**
- **DO NOT CHANGE THE HAIR.** The hairstyle, color, texture, and position must remain absolutely identical to the original image. This is the most important rule.
- **DO NOT CHANGE THE BACKGROUND.** The background must be preserved exactly.
- **DO NOT CHANGE THE BODY POSE.** The pose and body shape must not be altered.

Execute the image modification based on these exact instructions.
`.trim();

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
