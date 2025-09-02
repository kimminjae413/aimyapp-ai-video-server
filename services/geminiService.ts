import { GoogleGenAI, Modality } from "@google/genai";
import type { ImageFile } from '../types';

if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable is not set.");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const changeFaceInImage = async (
    originalImage: ImageFile, 
    facePrompt: string,
    clothingPrompt: string
): Promise<ImageFile | null> => {
    try {
        const faceInstruction = `Your first mission is to completely OBLITERATE the original face in the provided image and RECONSTRUCT a new one from scratch based on the following description: "${facePrompt}". The final result MUST be a completely different person. There should be ZERO recognizable features from the original. This is a full identity replacement.`;

        let consistencyAndClothingInstruction = '';

        if (clothingPrompt) {
            consistencyAndClothingInstruction = `
// --- MISSION 2: CLOTHING REPLACEMENT & CRITICAL CONSTRAINTS --- //
Your second mission is to replace the clothing while maintaining selective consistency.

1.  **CLOTHING REPLACEMENT:** Obliterate the original clothing and accessories. Replace them entirely with a new outfit based on this description: "${clothingPrompt}". The new outfit must be photorealistic and fit the person's new identity and pose.
2.  **SACROSANCT ELEMENTS:** You are strictly forbidden from altering anything else. The following elements MUST remain IDENTICAL to the original image:
    *   **HAIR:** Style, color, texture, and position.
    *   **BACKGROUND:** The environment must be an exact pixel-for-pixel match.
    *   **LIGHTING & SHADOWS:** The original lighting conditions must be perfectly preserved and realistically applied to the new face AND clothing.
`;
        } else {
            consistencyAndClothingInstruction = `
// --- CRITICAL CONSTRAINTS: ABSOLUTE CONSISTENCY --- //
While the face undergoes a radical transformation, everything else is SACROSANCT. You are strictly forbidden from altering:
1.  **HAIR:** Style, color, texture, and position must remain IDENTICAL.
2.  **CLOTHING & ACCESSORIES:** Every thread, fold, and detail must be preserved perfectly.
3.  **BACKGROUND:** The environment must be an exact pixel-for-pixel match.
4.  **LIGHTING & SHADOWS:** The original lighting conditions must be perfectly preserved and realistically applied to the contours of the new face.
`;
        }

        const prompt = `You are a world-class digital artist specializing in hyper-realistic identity reconstruction.
${faceInstruction}
${consistencyAndClothingInstruction}
The new face and/or clothing must be seamlessly and photorealistically blended with the preserved elements. Execute this reconstruction now.`;

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
        console.error("Error calling Gemini API for image application:", error);
        throw new Error("Failed to change face using Gemini API.");
    }
};