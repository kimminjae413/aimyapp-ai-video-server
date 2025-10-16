/**
 * Gemini Video Generation Service (Veo 2 Final)
 * 
 * Veo 2: 5초/8초 (5초=5크레딧, 8초=8크레딧)
 * 이미지 1개 → 5초 영상
 * 이미지 2개 → 8초 전환 영상
 */

interface VideoGenerationOptions {
  images: string[];  // base64 data URLs (max 2)
  prompt: string;
  duration: 5 | 8;  // ✅ 5초 또는 8초만! (Veo 2)
  aspectRatio?: '16:9' | '9:16';
}

interface VideoGenerationResult {
  videoUrl: string;
  duration: number;
  creditsUsed: number;
}

class GeminiVideoService {
  private readonly PROXY_URL = '/.netlify/functions/gemini-video-proxy';
  private readonly STATUS_URL = '/.netlify/functions/gemini-video-status';
  private readonly MAX_RETRIES = 3;
  private readonly POLL_INTERVAL = 10000; // 10초
  private readonly MAX_POLL_ATTEMPTS = 30; // 최대 5분

  /**
   * Gemini Video API로 영상 생성 (Veo 2)
   * @param options 영상 생성 옵션
   * @returns 생성된 영상 정보
   */
  async generateVideo(options: VideoGenerationOptions): Promise<VideoGenerationResult> {
    const { images, prompt, duration, aspectRatio = '9:16' } = options;

    // 검증
    if (!images || images.length === 0) {
      throw new Error('이미지가 필요합니다.');
    }

    if (images.length > 2) {
      throw new Error('최대 2개의 이미지만 지원됩니다.');
    }

    if (!prompt || !prompt.trim()) {
      throw new Error('프롬프트가 필요합니다.');
    }

    // ✅ 5초, 8초만 허용 (Veo 2)
    if (![5, 8].includes(duration)) {
      throw new Error('영상 길이는 5초, 8초만 가능합니다.');
    }

    // ✅ 크레딧 계산: duration과 동일
    const creditsRequired = duration;  // 5초=5, 8초=8

    console.log('🎬 Gemini Veo 2 생성 시작:', {
      imageCount: images.length,
      model: 'Veo 2',
      duration: `${duration}초`,
      promptLength: prompt.length,
      aspectRatio,
      creditsRequired
    });

    try {
      // Step 1: 영상 생성 시작
      const operationId = await this.startGeneration(images, prompt, duration, aspectRatio);
      
      console.log('✅ 생성 시작:', {
        operationId: operationId.substring(0, 50) + '...',
        creditsUsed: creditsRequired
      });

      // Step 2: 완료될 때까지 폴링
      const videoUrl = await this.pollUntilComplete(operationId, duration);
      
      console.log('✅ Gemini Veo 2 생성 완료:', {
        videoUrl: videoUrl.substring(0, 80) + '...',
        duration,
        creditsUsed: creditsRequired
      });

      return {
        videoUrl,
        duration,
        creditsUsed: creditsRequired
      };

    } catch (error) {
      console.error('❌ Gemini Veo 2 생성 실패:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Step 1: 영상 생성 시작
   */
  private async startGeneration(
    images: string[],
    prompt: string,
    duration: number,
    aspectRatio: string,
    retryCount = 0
  ): Promise<string> {
    try {
      const response = await fetch(this.PROXY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          images,
          prompt,
          duration,
          aspectRatio
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error || 
          `API 오류: ${response.status} ${response.statusText}`
        );
      }

      const data = await response.json();

      if (!data.success || !data.operationId) {
        throw new Error(data.error || '영상 생성 시작 실패');
      }

      return data.operationId;

    } catch (error: any) {
      // 재시도 로직
      if (retryCount < this.MAX_RETRIES) {
        console.warn(`⚠️ 오류 발생, 재시도 ${retryCount + 1}/${this.MAX_RETRIES}:`, error.message);

        // 지수 백오프 (1초, 2초, 4초)
        const delay = Math.pow(2, retryCount) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));

        return this.startGeneration(images, prompt, duration, aspectRatio, retryCount + 1);
      }

      throw error;
    }
  }

  /**
   * Step 2: 완료될 때까지 폴링
   */
  private async pollUntilComplete(operationId: string, duration: number): Promise<string> {
    for (let attempt = 1; attempt <= this.MAX_POLL_ATTEMPTS; attempt++) {
      console.log(`⏱️ 폴링 ${attempt}/${this.MAX_POLL_ATTEMPTS}...`);

      try {
        const response = await fetch(this.STATUS_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            operationId,
            duration  // duration 정보 전달
          })
        });

        if (!response.ok) {
          console.warn(`⚠️ 상태 확인 실패 (${response.status}), 재시도...`);
          await this.sleep(this.POLL_INTERVAL);
          continue;
        }

        const data = await response.json();

        // ✅ RAI 필터 감지 - 즉시 에러 throw (재시도 안 함)
        if (data.status === 'filtered' || data.raiFiltered) {
          console.error('🚫 RAI 필터 감지:', data.error);
          throw new Error(data.error || '이미지가 안전 정책에 의해 차단되었습니다.');
        }

        // 완료됨
        if (data.status === 'completed' && data.videoUrl) {
          return data.videoUrl;
        }

        // 실패
        if (data.status === 'failed' || data.status === 'error') {
          throw new Error(data.error || '영상 생성 실패');
        }

        // 아직 처리 중
        console.log(`⏳ ${data.message || `${duration}초 영상 생성 중...`}`);

      } catch (error) {
        // ✅ RAI 필터 에러는 즉시 throw (재시도 안 함)
        if (error instanceof Error && 
            (error.message.includes('안전 정책') || 
             error.message.includes('미성년자') || 
             error.message.includes('유명인') ||
             error.message.includes('차단'))) {
          throw error;
        }
        
        console.warn(`⚠️ 폴링 오류 (${attempt}/${this.MAX_POLL_ATTEMPTS}):`, error);
        
        if (attempt >= this.MAX_POLL_ATTEMPTS) {
          throw error;
        }
      }

      // 다음 폴링까지 대기
      await this.sleep(this.POLL_INTERVAL);
    }

    throw new Error('영상 생성 시간 초과 (5분)');
  }

  /**
   * 에러 핸들링
   */
  private handleError(error: any): Error {
    if (error.name === 'AbortError') {
      return new Error('영상 생성 시간이 초과되었습니다. 다시 시도해주세요.');
    }

    if (error.message?.includes('network')) {
      return new Error('네트워크 오류가 발생했습니다. 인터넷 연결을 확인해주세요.');
    }

    if (error.message?.includes('API key')) {
      return new Error('API 인증 오류가 발생했습니다.');
    }

    if (error.message?.includes('quota') || error.message?.includes('429')) {
      return new Error('API 요청 한도 초과. 1분 후 다시 시도해주세요.');
    }

    if (error.message?.includes('RESOURCE_EXHAUSTED')) {
      return new Error('API 리소스 한도 초과. 잠시 후 다시 시도해주세요.');
    }

    if (error.message?.includes('size')) {
      return new Error('이미지 크기가 너무 큽니다. 더 작은 이미지를 사용해주세요.');
    }

    if (error.message?.includes('시간 초과')) {
      return new Error('영상 생성에 시간이 너무 오래 걸립니다. 다시 시도해주세요.');
    }

    if (error.message?.includes('out of bound')) {
      return new Error('영상 길이는 5초, 8초만 가능합니다.');
    }

    // ✅ RAI 필터 에러는 그대로 전달
    if (error.message?.includes('안전 정책') || 
        error.message?.includes('미성년자') || 
        error.message?.includes('유명인') ||
        error.message?.includes('차단')) {
      return error;
    }

    return new Error(error.message || '영상 생성 중 오류가 발생했습니다.');
  }

  /**
   * Sleep 유틸리티
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 크레딧 계산
   */
  calculateCredits(duration: 5 | 8): number {
    return duration;  // 5초=5, 8초=8
  }

  /**
   * 건강 체크 (선택 사항)
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(this.PROXY_URL, {
        method: 'OPTIONS',
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

// 타입 export
export type { VideoGenerationOptions, VideoGenerationResult };
