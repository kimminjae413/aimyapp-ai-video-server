/**
 * OpenAI 프록시를 통한 얼굴 변환 (PNG 변환 포함) - 1000자 제한 준수
 */
const transformFaceWithOpenAIProxy = async (
    originalImage: ImageFile,
    facePrompt: string
): Promise<ImageFile | null> => {
    try {
        console.log('OpenAI Proxy: Face transformation starting...');
        
        // 1. 이미지 리사이즈 (1024x1024 최대)
        const resizedImage = await resizeImageForOpenAI(originalImage);
        
        // 2. PNG 형식으로 변환 (OpenAI 요구사항)
        console.log('OpenAI용 PNG 변환 중...');
        const pngBase64 = await PNGConverter.convertToPNGForOpenAI(resizedImage.base64);
        
        // 1000자 제한에 맞춘 최적화된 프롬프트
        const optimizedPrompt = `
FACE TRANSFORMATION PRIORITY:
${facePrompt}

EXECUTE:
- Replace ALL facial features completely
- Change face shape, eyes, nose, mouth, skin texture
- Make transformation dramatic and clearly visible
- Create completely different person as requested

SECONDARY:
- Maintain similar hairstyle if possible
- Keep pose and background when feasible

TECHNICAL:
- Generate photorealistic skin texture
- Ensure bold, visible changes
- Focus on complete facial reconstruction

Face transformation is PRIMARY GOAL.
        `.trim();

        // 프롬프트 길이 확인 및 로깅
        console.log('Optimized prompt length:', optimizedPrompt.length, 'characters');
        
        if (optimizedPrompt.length > 1000) {
            console.warn('Prompt still too long, truncating...');
            const truncatedPrompt = optimizedPrompt.substring(0, 997) + '...';
            console.log('Truncated prompt length:', truncatedPrompt.length);
        }

        const finalPrompt = optimizedPrompt.length > 1000 ? 
            optimizedPrompt.substring(0, 997) + '...' : 
            optimizedPrompt;

        console.log('PNG 변환 완료, OpenAI API 호출...');

        const response = await fetch('/.netlify/functions/openai-proxy', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                imageBase64: pngBase64,
                prompt: finalPrompt
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`OpenAI Proxy Error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        
        if (data.data && data.data[0] && data.data[0].b64_json) {
            console.log('OpenAI Proxy: Face transformation completed');
            
            return {
                base64: data.data[0].b64_json,
                mimeType: 'image/png',
                url: `data:image/png;base64,${data.data[0].b64_json}`
            };
        } else {
            throw new Error('No image data in OpenAI proxy response');
        }
        
    } catch (error) {
        console.error('OpenAI Proxy transformation error:', error);
        throw error;
    }
};
