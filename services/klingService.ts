import type { ImageFile } from '../types';

// Kling API configuration
const KLING_API_KEY = process.env.KLING_API_KEY || '';
const KLING_API_URL = 'https://api.klingai.com/v1/images/image2video'; // 실제 Kling API endpoint로 변경 필요

interface KlingVideoResponse {
  videoUrl: string;
  taskId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
}

export const generateVideoWithKling = async (
  image: ImageFile,
  prompt: string,
  duration: number = 5 // 기본 5초 영상
): Promise<string> => {
  if (!KLING_API_KEY) {
    throw new Error('KLING_API_KEY environment variable is not set.');
  }

  try {
    // Step 1: Image to Video 요청
    const formData = new FormData();
    
    // Base64를 Blob으로 변환
    const byteCharacters = atob(image.base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: image.mimeType });
    
    formData.append('image', blob, 'input.jpg');
    formData.append('prompt', prompt);
    formData.append('duration', duration.toString());
    formData.append('cfg_scale', '0.5'); // 프롬프트 준수 강도
    formData.append('mode', 'standard'); // 또는 'professional' for higher quality

    const response = await fetch(KLING_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${KLING_API_KEY}`,
      },
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Kling API request failed: ${response.statusText}`);
    }

    const data: KlingVideoResponse = await response.json();

    // Step 2: 비디오 생성 상태 확인 (폴링)
    if (data.status === 'pending' || data.status === 'processing') {
      return await pollVideoStatus(data.taskId);
    }

    if (data.status === 'failed') {
      throw new Error('Video generation failed');
    }

    return data.videoUrl;
  } catch (error) {
    console.error('Error calling Kling API:', error);
    throw new Error('Failed to generate video using Kling API.');
  }
};

// 비디오 생성 상태를 주기적으로 확인
const pollVideoStatus = async (taskId: string, maxAttempts: number = 60): Promise<string> => {
  const pollInterval = 5000; // 5초마다 확인
  let attempts = 0;

  while (attempts < maxAttempts) {
    try {
      const response = await fetch(`${KLING_API_URL}/status/${taskId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${KLING_API_KEY}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Status check failed: ${response.statusText}`);
      }

      const data: KlingVideoResponse = await response.json();

      if (data.status === 'completed') {
        return data.videoUrl;
      }

      if (data.status === 'failed') {
        throw new Error('Video generation failed');
      }

      // 아직 처리 중이면 대기
      await new Promise(resolve => setTimeout(resolve, pollInterval));
      attempts++;
    } catch (error) {
      console.error('Error checking video status:', error);
      throw error;
    }
  }

  throw new Error('Video generation timeout - took too long to process');
};

// 미리 정의된 모션 템플릿
export const motionTemplates = {
  smile: 'The person smiles naturally and warmly',
  wink: 'The person winks playfully with one eye',
  headTurn: 'The person slowly turns their head from left to right',
  hairFlow: 'Hair flows gently in the wind with natural movement',
  laugh: 'The person laughs joyfully with natural facial expressions',
  talk: 'The person talks naturally with lip sync movements',
  nod: 'The person nods their head in agreement',
  blink: 'The person blinks naturally several times',
};
