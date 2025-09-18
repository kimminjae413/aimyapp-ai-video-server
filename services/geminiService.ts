// services/geminiService.ts - 엄격한 제약 + 2단계 최종 버전
import { GoogleGenAI, Modality } from "@google/genai";
import { ImageProcessor } from '../utils/imageProcessor';
import type { ImageFile } from '../types';

// 🚀 캐시 무효화 및 버전 확인
console.log('🚀 GEMINI SERVICE VERSION: 5.0 - STRICT 2STEP FIREBASE FALLBACK');
console.log('📅 BUILD: 2025-09-12-20:45 - ULTRA STRICT CONSTRAINTS');
console.log('File timestamp:', new Date().toISOString());

// 환경변수에서 API 키 가져오기
const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable is not set.");
}

const ai = new GoogleGenAI({ apiKey });

console.log('🔧 Gemini Service Configuration:', { 
    model: 'gemini-2.5-flash',
    method: '강제 2단계 (Firebase 동일)',
    constraints: '극도로 엄격한 앵글/사이즈 보존',
    version: '5.0'
});

// 🎯 **1단계: 얼굴만 변환 (극도로 엄격한 제약)**
const getStrictFaceOnlyPrompt = (facePrompt: string): string => {
  return `
**CRITICAL MISSION: FACE REPLACEMENT ONLY - ZERO TOLERANCE FOR OTHER CHANGES**

Transform ONLY the facial features based on: ${facePrompt}

**ABSOLUTE CONSTRAINTS - COMPLETE PRESERVATION:**

🚫 **FORBIDDEN CHANGES (WILL CAUSE FAILURE):**
- ANY change to camera angle, distance, or zoom level
- ANY change to image crop, frame boundaries, or composition
- ANY change to face size, width, height, or proportions
- ANY change to hair (style, color, length, texture, volume, parting)
- ANY change to clothing, body position, or pose
- ANY change to background or lighting
- ANY expansion or contraction of the visible area

✅ **MANDATORY PRESERVATION:**
1. **FRAME GEOMETRY**: 
   - IDENTICAL image dimensions and crop boundaries
   - SAME camera distance and viewing angle
   - NO switching between close-up/medium/full shots
   - PRESERVE exact same portrait orientation

2. **FACE DIMENSIONS**: 
   - MAINTAIN exact facial width-to-height ratio
   - NO face stretching, compressing, or resizing
   - PRESERVE original face shape (V-line, oval, square, etc.)
   - KEEP same face size relative to frame borders

3. **HAIR - 100% IDENTICAL**: 
   - Hair style, color, length, texture: UNCHANGED
   - Hair parting, fringe, volume, flow: IDENTICAL
   - Hair position and boundaries: PRESERVED
   - This is absolutely non-negotiable

4. **BODY & CLOTHING**: 
   - ALL clothing: style, color, pattern - UNCHANGED
   - Body position, shoulders, posture: IDENTICAL
   - Visible clothing area: PRESERVED

5. **ENVIRONMENT**: 
   - Background: IDENTICAL in every detail
   - Lighting: same direction, intensity, color
   - Shadows and highlights: UNCHANGED

**TRANSFORMATION SCOPE - ONLY THESE:**
- Eyes: shape, size, color, eyebrows
- Nose: bridge, tip, nostrils, width
- Mouth: lips shape, size, cupid's bow
- Skin: texture, tone, facial structure
- Cheeks: bone structure, fullness
- Jawline: shape and definition

**CRITICAL REMINDER:**
You are ONLY changing the person's identity through facial features. Everything else must remain PIXEL-PERFECT identical to the original image.
  `.trim();
};

// 🎯 **2단계: 의상만 변환 (엄격한 제약)**
const getStrictClothingOnlyPrompt = (clothingPrompt: string): string => {
  return `
**MISSION: CLOTHING CHANGE ONLY - PRESERVE EVERYTHING ELSE**

Change only the clothing to: ${clothingPrompt}

**ABSOLUTE PRESERVATION:**
- Face, facial features, skin tone: IDENTICAL
- Hair style, color, length, texture: UNCHANGED  
- Body pose, position, shoulders: SAME
- Background and lighting: IDENTICAL
- Image crop and frame boundaries: UNCHANGED

**CLOTHING CHANGE RULES:**
- Change ONLY visible clothing within existing frame
- DO NOT expand frame to show more body parts
- IF original shows only upper body, change ONLY upper body clothing
- Maintain same clothing area boundaries
- Preserve original image composition

Keep the transformed face from previous step exactly the same.
  `.trim();
};

// 2단계 방식: 의상만 변환 (엄격한 제약) - 🔥 export 추가
export const changeClothingOnly = async (
    faceChangedImage: ImageFile, 
    clothingPrompt: string
): Promise<ImageFile | null> => {
    try {
        console.log('🔄 [Gemini 2.5 Flash] Clothing-only transformation (STRICT) starting...');
        
        const prompt = getStrictClothingOnlyPrompt(clothingPrompt);
        const startTime = Date.now();

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
                temperature: 0.1, // 🔧 더 낮은 온도로 일관성 향상
            },
        });
        
        const responseTime = Date.now() - startTime;
        console.log('⚡ [Gemini 2.5 Flash] STRICT Clothing response time:', responseTime + 'ms');
        
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
                    console.log('✅ [Gemini 2.5 Flash] STRICT Clothing transformation completed in', responseTime + 'ms');
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
        console.error("❌ [Gemini 2.5 Flash] STRICT Clothing transformation error:", error);
        throw error;
    }
};

// 메인 함수 - **강제 2단계 방식** (Firebase 폴백용)
export const changeFaceInImage = async (
    originalImage: ImageFile, 
    facePrompt: string,
    clothingPrompt: string
): Promise<ImageFile | null> => {
    try {
        console.log('🚀 [Gemini 2.5 Flash] Starting STRICT 2-step transformation (Firebase fallback)...');
        console.log('📋 Step plan:', {
            step1: 'Face-only (ULTRA STRICT)',
            step2: clothingPrompt ? 'Clothing-only (STRICT)' : 'Skip',
            totalSteps: clothingPrompt ? 2 : 1
        });
        
        // 🎯 **1단계: 얼굴만 변환 (엄격한 제약)**
        console.log('👤 Step 1: STRICT Face transformation only');
        const faceOnlyPrompt = getStrictFaceOnlyPrompt(facePrompt);
        
        const step1StartTime = Date.now();
        
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
                        text: faceOnlyPrompt,
                    },
                ],
            },
            config: {
                responseModalities: [Modality.IMAGE, Modality.TEXT],
                temperature: 0.1, // 🔧 낮은 온도로 일관성 극대화
            },
        });
        
        const step1Time = Date.now() - step1StartTime;
        console.log('⚡ [Gemini 2.5 Flash] STRICT Step 1 response time:', step1Time + 'ms');
        
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
        
        console.log('✅ Step 1 completed - STRICT face transformed in', step1Time + 'ms');
        
        // 의상 변경이 없으면 1단계 결과만 반환
        if (!clothingPrompt || clothingPrompt.trim() === '') {
            console.log('🏁 [Gemini 2.5 Flash] Face-only transformation completed (STRICT)');
            return faceResult;
        }
        
        // 🎯 **2단계: 의상만 변경 (엄격한 제약)**
        console.log('👕 Step 2: STRICT Clothing transformation only');
        const step2StartTime = Date.now();
        
        const clothingOnlyPrompt = getStrictClothingOnlyPrompt(clothingPrompt);

        const clothingResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image-preview',
            contents: {
                parts: [
                    {
                        inlineData: {
                            data: faceResult.base64,
                            mimeType: faceResult.mimeType,
                        },
                    },
                    {
                        text: clothingOnlyPrompt,
                    },
                ],
            },
            config: {
                responseModalities: [Modality.IMAGE, Modality.TEXT],
                temperature: 0.1, // 🔧 낮은 온도로 일관성 극대화
            },
        });
        
        const step2Time = Date.now() - step2StartTime;
        const totalTime = step1Time + step2Time;
        
        console.log('⚡ [Gemini 2.5 Flash] STRICT Step 2 response time:', step2Time + 'ms');
        console.log('⚡ [Gemini 2.5 Flash] STRICT Total time:', totalTime + 'ms');
        
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
                    console.log('✅ [Gemini 2.5 Flash] STRICT All steps completed in', totalTime + 'ms');
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
        console.error("❌ [Gemini 2.5 Flash] STRICT transformation error:", error);
        throw error;
    }
};

// 디버깅용 상태 확인
export const getServiceStatus = () => {
    return {
        model: 'gemini-2.5-flash',
        version: '5.0',
        method: '강제 2단계 (Firebase 폴백용)',
        constraints: '극도로 엄격한 앵글/사이즈 보존',
        temperature: 0.1,
        improvements: [
            '🎯 1단계: 얼굴만 변환 (엄격한 제약)',
            '👕 2단계: 의상만 변환 (엄격한 제약)', 
            '📐 앵글/사이즈 변경 완전 금지',
            '💇 헤어 보존 절대 우선순위',
            '🌡️ Temperature 0.1로 일관성 극대화',
            '🔄 Firebase와 동일한 2단계 방식'
        ],
        environment: process.env.NODE_ENV
    };
};
