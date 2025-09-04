import { GoogleGenAI, Modality } from "@google/genai";
import type { ImageFile } from '../types';

// 환경변수 접근 방식 변경
declare global {
  const __GEMINI_API_KEY__: string;
}

// 여러 방식으로 API 키 획득 시도
const getApiKey = (): string => {
  // 1. 전역 변수에서
  if (typeof __GEMINI_API_KEY__ !== 'undefined' && __GEMINI_API_KEY__) {
    console.log('✅ API key found from global variable');
    return __GEMINI_API_KEY__;
  }
  
  // 2. process.env에서 (있다면)
  if (typeof process !== 'undefined' && process.env?.GEMINI_API_KEY) {
    console.log('✅ API key found from process.env');
    return process.env.GEMINI_API_KEY;
  }
  
  // 3. window 객체에서 (fallback)
  const windowEnv = (window as any).__GEMINI_API_KEY__;
  if (windowEnv) {
    console.log('✅ API key found from window');
    return windowEnv;
  }
  
  console.error('❌ API key not found in any location');
  throw new Error("GEMINI_API_KEY environment variable is not set.");
};

const apiKey = getApiKey();
console.log('🔑 Final API key length:', apiKey.length);

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
                const newBase64 = part.inlineData.data;
                const newMimeType = part.inlineData.mimeType;
                return {
                    base64: newBase64,
                    mimeType: newMimeType,
                    url: `data:${newMimeType};base64,${newBase64}`
                };
            }
        }
        return null;

    } catch (error) {
        console.error("Error calling Gemini API:", error);
        throw new Error("Failed to change face using Gemini API.");
    }
};
