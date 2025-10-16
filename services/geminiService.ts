// services/geminiService.ts - 초강력 헤어 보존 + 배경/의상 분리 버전
import { GoogleGenAI, Modality } from “@google/genai”;
import { ImageProcessor } from ‘../utils/imageProcessor’;
import type { ImageFile } from ‘../types’;

// 🚀 캐시 무효화 및 버전 확인
console.log(‘🚀 GEMINI SERVICE VERSION: 5.2 - ULTRA HAIR PRESERVATION + BACKGROUND SUPPORT’);
console.log(‘📅 BUILD: 2025-10-16-20:50 - HAIR PROTECTION + BACKGROUND/CLOTHING SEPARATION’);
console.log(‘File timestamp:’, new Date().toISOString());

// 환경변수에서 API 키 가져오기
const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
throw new Error(“GEMINI_API_KEY environment variable is not set.”);
}

const ai = new GoogleGenAI({ apiKey });

console.log(‘🔧 Gemini Service Configuration:’, {
model: ‘gemini-2.5-flash’,
method: ‘초강력 헤어 보존 + 배경/의상 분리’,
constraints: ‘헤어 변경 절대 금지’,
version: ‘5.2’
});

// 🎯 **1단계: 얼굴만 변환 (초강력 헤어 보존)**
const getUltraStrictFaceOnlyPrompt = (facePrompt: string): string => {
return `
**CRITICAL: FACE REPLACEMENT ONLY - HAIR MUST BE IDENTICAL**

Transform ONLY the facial features based on: ${facePrompt}

🚫 **ABSOLUTELY FORBIDDEN - WILL CAUSE COMPLETE FAILURE:**

- ANY change to hair style, length, texture, wave pattern, or volume
- ANY change to hair color, highlights, or hair tone
- ANY change to hair parting, fringe/bangs, or hair direction
- ANY change to hair flow, curl pattern, or straightness
- ANY change to image crop, camera angle, or zoom
- ANY change to clothing, background, or lighting

💇‍♀️ **HAIR PRESERVATION - ULTIMATE PRIORITY:**

- Hair style: MUST BE PIXEL-PERFECT IDENTICAL (wavy, straight, curly - whatever the original has)
- Hair length: EXACT same length from roots to tips
- Hair texture: IDENTICAL wave pattern, curl definition, volume
- Hair color: SAME color tone, highlights, shadows in hair
- Hair parting: EXACT same part line and direction
- Hair flow: SAME hair movement and natural fall
- Bangs/Fringe: IDENTICAL cut, length, and styling
- Hair volume: SAME thickness and fullness
- Hair edges: EXACT same hairline and baby hairs

**THE HAIR IN THE RESULT MUST LOOK LIKE IT’S THE EXACT SAME PERSON’S HAIR - NO EXCEPTIONS**

✅ **ONLY CHANGE THESE FACIAL FEATURES:**

- Eyes: shape, size, color, eyebrows (but NOT eyebrow length or thickness)
- Nose: bridge, tip, nostrils, width
- Mouth: lips shape, size, color
- Skin: tone, texture, facial structure
- Cheeks: bone structure, fullness
- Jawline: shape and definition

🔒 **MANDATORY PRESERVATION:**

- Image composition: IDENTICAL crop and frame
- Camera angle: SAME viewing angle and distance
- Lighting: IDENTICAL lighting direction and intensity
- Background: UNCHANGED
- Clothing: IDENTICAL style, color, and pattern
- Body position: SAME pose and shoulders

**REMINDER: You are changing ONLY the person’s facial identity. The hair must be so identical that someone looking at both images would think it’s the same person’s hair styled exactly the same way.**
`.trim();
};

// 🎯 **2단계: 의상/배경 변환 (헤어 보존 유지)** - ✅ 개선된 버전
const getSmartModificationPrompt = (combinedPrompt: string): string => {
// 프롬프트 분석: Clothing과 Background 구분
const hasClothing = combinedPrompt.toLowerCase().includes(‘clothing:’);
const hasBackground = combinedPrompt.toLowerCase().includes(‘background:’);

let modificationTarget = ‘’;
if (hasClothing && hasBackground) {
modificationTarget = ‘clothing AND background’;
} else if (hasClothing) {
modificationTarget = ‘ONLY clothing’;
} else if (hasBackground) {
modificationTarget = ‘ONLY background’;
} else {
modificationTarget = ‘the specified elements’;
}

return `
**MISSION: MODIFY ${modificationTarget.toUpperCase()} - PRESERVE FACE AND HAIR**

${combinedPrompt}

💇‍♀️ **HAIR PRESERVATION - CRITICAL:**

- Keep the EXACT same hair from the previous image
- Hair style, length, texture, wave pattern: IDENTICAL
- Hair color and highlights: UNCHANGED
- Hair parting and flow: SAME
- DO NOT modify hair in any way

✅ **FACE PRESERVATION:**

- Keep the transformed face from previous step EXACTLY the same
- Facial features: UNCHANGED
- Skin tone and texture: IDENTICAL
- Expression: SAME

🔒 **MODIFICATION RULES:**
${hasClothing ? `

- ✅ CLOTHING: Change according to “Clothing:” instruction
- Modify clothing style, color, pattern as specified
- Keep clothing within existing frame boundaries
  `: ''} ${hasBackground ?`
- ✅ BACKGROUND: Change according to “Background:” instruction
- Modify background scenery, wall, environment as specified
- Keep person in same position and framing
  `: ''} ${!hasClothing ?`
- ❌ CLOTHING: DO NOT change clothing at all - keep identical
  `: ''} ${!hasBackground ?`
- ❌ BACKGROUND: DO NOT change background at all - keep identical
  ` : ‘’}

🚫 **NEVER CHANGE:**

- Hair (style, color, length, texture, parting)
- Face (features, expression, skin tone)
- Body pose and position
- Image crop and camera angle
- Lighting direction

**IMPORTANT: Only modify what is explicitly mentioned in the instructions above. Everything else must remain pixel-perfect identical.**
`.trim();
};

// 2단계 방식: 의상/배경 변환 (초강력 헤어 보존) - 🔥 개선된 버전
export const changeClothingOnly = async (
faceChangedImage: ImageFile,
combinedPrompt: string  // ✅ “Clothing: …” 또는 “Background: …” 또는 둘 다
): Promise<ImageFile | null> => {
try {
console.log(‘🔄 [Gemini 2.5 Flash] Smart modification (ULTRA HAIR PRESERVATION) starting…’);
console.log(‘📋 Modification prompt:’, combinedPrompt);

```
    const prompt = getSmartModificationPrompt(combinedPrompt);
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
            temperature: 0.05, // 🔧 더욱 낮은 온도로 일관성 극대화
        },
    });
    
    const responseTime = Date.now() - startTime;
    console.log('⚡ [Gemini 2.5 Flash] ULTRA HAIR PRESERVATION Smart modification response time:', responseTime + 'ms');
    
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
                console.log('✅ [Gemini 2.5 Flash] ULTRA HAIR PRESERVATION Smart modification completed in', responseTime + 'ms');
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
    
    throw new Error('No image data in modification response');

} catch (error) {
    console.error("❌ [Gemini 2.5 Flash] ULTRA HAIR PRESERVATION Smart modification error:", error);
    throw error;
}
```

};

// 메인 함수 - **초강력 헤어 보존 2단계**
export const changeFaceInImage = async (
originalImage: ImageFile,
facePrompt: string,
clothingPrompt: string
): Promise<ImageFile | null> => {
try {
console.log(‘🚀 [Gemini 2.5 Flash] Starting ULTRA HAIR PRESERVATION 2-step transformation…’);
console.log(‘📋 Step plan:’, {
step1: ‘Face-only (ULTRA HAIR PRESERVATION)’,
step2: clothingPrompt ? ‘Clothing/Background modification (MAINTAIN HAIR)’ : ‘Skip’,
totalSteps: clothingPrompt ? 2 : 1,
hairProtection: ‘MAXIMUM’
});

```
    // 🎯 **1단계: 얼굴만 변환 (초강력 헤어 보존)**
    console.log('👤 Step 1: ULTRA HAIR PRESERVATION Face transformation');
    const faceOnlyPrompt = getUltraStrictFaceOnlyPrompt(facePrompt);
    
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
            temperature: 0.05, // 🔧 초저온도로 헤어 보존 극대화
        },
    });
    
    const step1Time = Date.now() - step1StartTime;
    console.log('⚡ [Gemini 2.5 Flash] ULTRA HAIR PRESERVATION Step 1 response time:', step1Time + 'ms');
    
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
    
    console.log('✅ Step 1 completed - ULTRA HAIR PRESERVATION face transformed in', step1Time + 'ms');
    
    // 의상/배경 변경이 없으면 1단계 결과만 반환
    if (!clothingPrompt || clothingPrompt.trim() === '') {
        console.log('🏁 [Gemini 2.5 Flash] Face-only transformation completed (ULTRA HAIR PRESERVATION)');
        return faceResult;
    }
    
    // 🎯 **2단계: 의상/배경 변경 (헤어 보존 유지)**
    console.log('👕🎨 Step 2: Clothing/Background transformation (MAINTAIN HAIR PRESERVATION)');
    const step2StartTime = Date.now();

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
                    text: getSmartModificationPrompt(clothingPrompt),
                },
            ],
        },
        config: {
            responseModalities: [Modality.IMAGE, Modality.TEXT],
            temperature: 0.05, // 🔧 초저온도로 헤어 보존 유지
        },
    });
    
    const step2Time = Date.now() - step2StartTime;
    const totalTime = step1Time + step2Time;
    
    console.log('⚡ [Gemini 2.5 Flash] ULTRA HAIR PRESERVATION Step 2 response time:', step2Time + 'ms');
    console.log('⚡ [Gemini 2.5 Flash] ULTRA HAIR PRESERVATION Total time:', totalTime + 'ms');
    
    if (!clothingResponse.candidates || !clothingResponse.candidates[0] || !clothingResponse.candidates[0].content) {
        console.warn('⚠️ Clothing/Background transformation failed, returning face result (with preserved hair)');
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
                console.log('✅ [Gemini 2.5 Flash] ULTRA HAIR PRESERVATION All steps completed in', totalTime + 'ms');
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
    
    console.warn('⚠️ No clothing/background transformation result, returning face result (with preserved hair)');
    return faceResult;

} catch (error) {
    console.error("❌ [Gemini 2.5 Flash] ULTRA HAIR PRESERVATION transformation error:", error);
    throw error;
}
```

};

// 디버깅용 상태 확인
export const getServiceStatus = () => {
return {
model: ‘gemini-2.5-flash’,
version: ‘5.2’,
method: ‘초강력 헤어 보존 + 배경/의상 분리 + 강제 2단계’,
constraints: ‘헤어 변경 절대 금지’,
temperature: 0.05,
improvements: [
‘💇‍♀️ 초강력 헤어 보존 (웨이브, 길이, 색상, 파팅 완전 보존)’,
‘🎯 1단계: 얼굴만 변환 (헤어 픽셀 단위 보존)’,
‘👕 2단계: 의상만 변환 (헤어 보존 유지)’,
‘🎨 2단계: 배경만 변환 (헤어 보존 유지) - NEW!’,
‘🧠 스마트 분석: Clothing/Background 자동 구분’,
‘📐 앵글/사이즈 변경 완전 금지’,
‘🌡️ Temperature 0.05로 극한 일관성’,
‘🔄 Firebase와 동일한 2단계 방식’,
‘🛡️ 헤어스타일 변경 실패 방지’
],
environment: process.env.NODE_ENV
};
};