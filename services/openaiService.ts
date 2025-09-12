// services/openaiService.ts - GPT-Image-1 얼굴 변환 서비스
import OpenAI from 'openai';
import type { ImageFile } from '../types';

console.log('OPENAI SERVICE VERSION: 1.0 - GPT-IMAGE-1 FACE TRANSFORMATION');

// 환경변수에서 API 키 가져오기
const apiKey = process.env.OPENAI_API_KEY;

if (!apiKey) {
    throw new Error("OPENAI_API_KEY environment variable is not set.");
}

// OpenAI 클라이언트 초기화
const openai = new OpenAI({
    apiKey: apiKey,
});

console.log('OpenAI Service Configuration:', { 
    hasApiKey: !!apiKey,
    model: 'gpt-image-1'
});

/**
 * GPT-Image-1을 사용한 얼굴 변환 (헤어 보존 최적화)
 * 1단계: 얼굴만 변환, 헤어는 완벽 보존
 */
export const transformFaceWithGPTImage = async (
    originalImage: ImageFile,
    facePrompt: string
): Promise<ImageFile | null> => {
    try {
        console.log('🎯 GPT-Image-1 face transformation starting...');
        console.log('- Face prompt:', facePrompt);

        // 헤어 보존 최적화 프롬프트
        const optimizedPrompt = `
Transform this person's facial features while preserving all other elements:

🎯 FACE TRANSFORMATION:
${facePrompt}

🔒 CRITICAL PRESERVATION:
- Hair: Keep EXACT same hairstyle, color, texture, length, and styling
- Clothing: Maintain identical outfit and accessories
- Background: Preserve environment completely  
- Pose: Keep body position and angle unchanged
- Lighting: Match original illumination and shadows

⚙️ TECHNICAL REQUIREMENTS:
- Generate photorealistic skin with natural texture
- Ensure seamless blending between new face and existing hair
- Maintain color harmony throughout the image

The goal is facial reconstruction only - everything else must remain identical.
        `.trim();

        console.log('📤 Sending request to GPT-Image-1...');

        // GPT-Image-1 API 호출 (정확한 스펙)
        const response = await openai.images.edit({
            model: "gpt-image-1",
            image: [await base64ToFile(originalImage)], // 배열 형태
            prompt: optimizedPrompt,
            size: "auto", // 원본 비율 유지
            quality: "high", // high/medium/low
            input_fidelity: "high", // 원본 특징 최대 보존
            background: "auto", // 배경 자동 처리
            output_format: "png",
            n: 1
        });

        console.log('📨 GPT-Image-1 API response received');

        if (response.data && response.data.length > 0) {
            const generatedImage = response.data[0];
            
            // GPT-Image-1은 항상 base64로 반환
            if (generatedImage.b64_json) {
                console.log('✅ GPT-Image-1 face transformation completed');
                
                return {
                    base64: generatedImage.b64_json,
                    mimeType: 'image/png',
                    url: `data:image/png;base64,${generatedImage.b64_json}`
                };
            } else {
                throw new Error('No base64 data in GPT-Image-1 response');
            }
        } else {
            throw new Error('Empty response from GPT-Image-1');
        }

    } catch (error) {
        console.error("❌ GPT-Image-1 transformation error:", error);
        
        // 상세한 에러 처리
        if (error instanceof Error) {
            const errorMessage = error.message.toLowerCase();
            
            if (errorMessage.includes('verification') || errorMessage.includes('verify')) {
                throw new Error('조직 인증이 아직 처리되지 않았습니다.');
            } else if (errorMessage.includes('quota')) {
                throw new Error('OpenAI 크레딧이 부족합니다.');
            } else if (errorMessage.includes('rate_limit')) {
                throw new Error('API 호출 한도 초과. 잠시 후 다시 시도해주세요.');
            } else if (errorMessage.includes('content_policy')) {
                throw new Error('이미지 내용이 정책에 위반됩니다.');
            }
            throw new Error(`GPT-Image-1 변환 실패: ${error.message}`);
        }
        
        throw new Error("얼굴 변환에 실패했습니다.");
    }
};

/**
 * Base64를 File 객체로 변환
 */
async function base64ToFile(imageFile: ImageFile): Promise<File> {
    const base64Data = imageFile.base64;
    const mimeType = imageFile.mimeType || 'image/jpeg';
    
    // Base64 → Blob → File
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    
    const blob = new Blob([bytes], { type: mimeType });
    return new File([blob], 'face-source.jpg', { type: mimeType });
}

/**
 * 서비스 상태 확인
 */
export const getOpenAIServiceStatus = () => {
    return {
        model: 'gpt-image-1',
        hasApiKey: !!apiKey,
        purpose: 'Face transformation with hair preservation'
    };
};
