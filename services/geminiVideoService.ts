/**
 * Gemini Video Generation Service
 * 
 * Veo 2: 1개 이미지 → 5초 영상
 * Veo 3.1: 2개 이미지 → 10초 전환 영상 (last_frame)
 */

interface VideoGenerationOptions {
  images: string[];  // base64 data URLs (max 2)
  prompt: string;
  aspectRatio?: '16:9' | '9:16';
}

interface VideoGenerationResult {
  videoUrl: string;
  duration: number;
  creditsUsed: number;
}

class GeminiVideoService {
  private readonly NETLIFY_FUNCTION_URL = '/.netlify/functions/gemini-video-proxy';
  private readonly MAX_RETRIES = 3;
  private readonly TIMEOUT_MS = 300000; // 5분

  /**
   * Gemini Video API로 영상 생성
   * @param options 영상 생성 옵션
   * @returns 생성된 영상 정보
   */
  async generateVideo(options: VideoGenerationOptions): Promise<VideoGenerationResult> {
    const { images, prompt, aspectRatio = '9:16' } = options;

    // 검증
    if (!images || images.length === 0) {
      throw new Error('이미지가 필요합니다.');
    }

    if (images.length > 2) {
      throw new Error('최대 2개의 이미지만 지원됩니다.');
    }

    if (!prompt) {
      throw new Error('프롬프트가 필요합니다.');
    }

    console.log('🎬 Gemini Video 생성 시작:', {
      imageCount: images.length,
      model: images.length === 2 ? 'Veo 3.1' : 'Veo 2',
      promptLength: prompt.length,
      aspectRatio
    });

    try {
      const result = await this.callNetlifyFunction(images, prompt, aspectRatio);
      
      console.log('✅ Gemini Video 생성 완료:', {
        videoUrl: result.videoUrl.substring(0, 80) + '...',
        duration: result.duration,
        creditsUsed: result.creditsUsed
      });

      return result;
    } catch (error) {
      console.error('❌ Gemini Video 생성 실패:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Netlify Function 호출 (재시도 로직 포함)
   */
  private async callNetlifyFunction(
    images: string[],
    prompt: string,
    aspectRatio: string,
    retryCount = 0
  ): Promise<VideoGenerationResult> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.TIMEOUT_MS);

      const response = await fetch(this.NETLIFY_FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          images,
          prompt,
          aspectRatio
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error || 
          `API 오류: ${response.status} ${response.statusText}`
        );
      }

      const data = await response.json();

      if (!data.videoUrl) {
        throw new Error('영상 URL을 받지 못했습니다.');
      }

      return {
        videoUrl: data.videoUrl,
        duration: data.duration || (images.length === 2 ? 10 : 5),
        creditsUsed: images.length === 2 ? 3 : 1
      };

    } catch (error: any) {
      // 재시도 로직
      if (retryCount < this.MAX_RETRIES) {
        if (error.name === 'AbortError') {
          console.warn(`⏱️ 타임아웃 발생, 재시도 ${retryCount + 1}/${this.MAX_RETRIES}`);
        } else {
          console.warn(`⚠️ 오류 발생, 재시도 ${retryCount + 1}/${this.MAX_RETRIES}:`, error.message);
        }

        // 지수 백오프 (1초, 2초, 4초)
        const delay = Math.pow(2, retryCount) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));

        return this.callNetlifyFunction(images, prompt, aspectRatio, retryCount + 1);
      }

      throw error;
    }
  }

  /**
   * 에러 핸들링
   */
  private handleError(error: any): Error {
    if (error.name === 'AbortError') {
      return new Error('영상 생성 시간이 초과되었습니다. 다시 시도해주세요.');
    }

    if (error.message.includes('network')) {
      return new Error('네트워크 오류가 발생했습니다. 인터넷 연결을 확인해주세요.');
    }

    if (error.message.includes('API key')) {
      return new Error('API 인증 오류가 발생했습니다.');
    }

    if (error.message.includes('quota')) {
      return new Error('API 할당량이 초과되었습니다. 잠시 후 다시 시도해주세요.');
    }

    if (error.message.includes('size')) {
      return new Error('이미지 크기가 너무 큽니다. 더 작은 이미지를 사용해주세요.');
    }

    return new Error(error.message || '영상 생성 중 오류가 발생했습니다.');
  }

  /**
   * 건강 체크 (선택 사항)
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(this.NETLIFY_FUNCTION_URL + '/health', {
        method: 'GET',
        signal: AbortSignal.timeout(5000)
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}

// 싱글톤 인스턴스 export
export const geminiVideoService = new GeminiVideoService();
