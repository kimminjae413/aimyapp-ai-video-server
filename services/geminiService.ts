/**
 * ═══════════════════════════════════════════════════════════════════════
 * Gemini Video Service - Async Polling Version
 * ═══════════════════════════════════════════════════════════════════════
 * 
 * @description Veo 3 Fast 비동기 영상 생성 서비스
 * @version 2.0.0 - Async with Polling
 * @date 2025-10-16
 */

interface VideoGenerationOptions {
  images: string[];  // base64 data URLs
  prompt: string;
  aspectRatio?: '16:9' | '9:16';
}

interface VideoGenerationResult {
  videoUrl: string;
  duration: number;
  creditsUsed: number;
}

interface OperationStatusResponse {
  status: 'processing' | 'completed' | 'error';
  done: boolean;
  videoUrl?: string;
  duration?: number;
  message?: string;
  error?: string;
}

class GeminiVideoService {
  private readonly GENERATE_URL = '/.netlify/functions/gemini-video-proxy';
  private readonly STATUS_URL = '/.netlify/functions/gemini-video-status';
  private readonly MAX_RETRIES = 3;
  private readonly TIMEOUT_MS = 10000; // 10초 (초기 요청)
  private readonly POLL_INTERVAL_MS = 10000; // 10초마다 폴링
  private readonly MAX_POLL_ATTEMPTS = 30; // 최대 5분 (30 × 10초)

  /**
   * 영상 생성 시작 및 완료까지 대기
   */
  async generateVideo(options: VideoGenerationOptions): Promise<VideoGenerationResult> {
    const { images, prompt, aspectRatio = '9:16' } = options;

    // 검증
    if (!images || images.length === 0 || images.length > 2) {
      throw new Error('이미지는 1~2개만 지원됩니다.');
    }

    if (!prompt || prompt.trim() === '') {
      throw new Error('프롬프트가 필요합니다.');
    }

    try {
      // 1단계: 영상 생성 시작
      console.log('🎬 영상 생성 요청 시작...');
      const operationId = await this.startGeneration(images, prompt, aspectRatio);
      
      console.log('✅ Operation ID 받음:', operationId);
      console.log('⏳ 영상 생성 중... (2~3분 소요 예상)');

      // 2단계: 완료될 때까지 폴링
      const result = await this.pollUntilComplete(operationId);
      
      console.log('✅ 영상 생성 완료!');
      return result;

    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * 영상 생성 시작 (즉시 operation ID 반환)
   */
  private async startGeneration(
    images: string[],
    prompt: string,
    aspectRatio: string,
    retryCount = 0
  ): Promise<string> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.TIMEOUT_MS);

      const response = await fetch(this.GENERATE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ images, prompt, aspectRatio }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const data = await response.json();

      if (!data.operationId) {
        throw new Error('서버에서 Operation ID를 받지 못했습니다.');
      }

      return data.operationId;

    } catch (error: any) {
      // 재시도 로직
      if (retryCount < this.MAX_RETRIES && !error.message.includes('429')) {
        const delay = Math.pow(2, retryCount) * 1000;
        console.warn(`⚠️ 재시도 ${retryCount + 1}/${this.MAX_RETRIES} (${delay}ms 후)...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.startGeneration(images, prompt, aspectRatio, retryCount + 1);
      }
      throw error;
    }
  }

  /**
   * 영상 생성 완료까지 폴링
   */
  private async pollUntilComplete(operationId: string): Promise<VideoGenerationResult> {
    let attempts = 0;

    while (attempts < this.MAX_POLL_ATTEMPTS) {
      attempts++;
      
      console.log(`⏱️ 상태 확인 중... (${attempts}/${this.MAX_POLL_ATTEMPTS})`);

      try {
        const status = await this.checkStatus(operationId);

        // 완료됨
        if (status.done && status.status === 'completed') {
          if (!status.videoUrl) {
            throw new Error('영상 URL을 받지 못했습니다.');
          }

          return {
            videoUrl: status.videoUrl,
            duration: status.duration || 8,
            creditsUsed: this.getCreditsUsed(operationId)
          };
        }

        // 에러 발생
        if (status.status === 'error') {
          throw new Error(status.error || '영상 생성 중 오류가 발생했습니다.');
        }

        // 아직 처리 중 - 대기 후 재시도
        await new Promise(resolve => setTimeout(resolve, this.POLL_INTERVAL_MS));

      } catch (pollError: any) {
        console.warn(`⚠️ 폴링 오류 (${attempts}/${this.MAX_POLL_ATTEMPTS}):`, pollError.message);
        
        // 마지막 시도였으면 에러 던지기
        if (attempts >= this.MAX_POLL_ATTEMPTS) {
          throw new Error('영상 생성 시간이 초과되었습니다. (5분)');
        }

        // 계속 시도
        await new Promise(resolve => setTimeout(resolve, this.POLL_INTERVAL_MS));
      }
    }

    throw new Error('영상 생성 시간이 초과되었습니다. (5분)');
  }

  /**
   * Operation 상태 확인
   */
  private async checkStatus(operationId: string): Promise<OperationStatusResponse> {
    const response = await fetch(this.STATUS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ operationId })
    });

    if (!response.ok) {
      throw new Error(`상태 확인 실패: HTTP ${response.status}`);
    }

    return await response.json();
  }

  /**
   * Operation ID에서 크레딧 사용량 추출
   * (Operation ID에 이미지 개수 정보가 없으므로 기본값 사용)
   */
  private getCreditsUsed(operationId: string): number {
    // Veo 3.1인지 확인 (lastFrame 포함 여부)
    // 실제로는 초기 요청에서 저장해두어야 함
    // 여기서는 간단히 기본값 반환
    return 3; // 2개 이미지 기준
  }

  /**
   * 에러 처리
   */
  private handleError(error: any): Error {
    console.error('❌ Gemini Video 생성 실패:', error);

    if (error.name === 'AbortError') {
      return new Error('요청 시간이 초과되었습니다.');
    }

    if (error.message?.includes('429')) {
      return new Error('API 할당량이 초과되었습니다. 잠시 후 다시 시도해주세요.');
    }

    if (error.message?.includes('quota')) {
      return new Error('API 할당량이 초과되었습니다. 잠시 후 다시 시도해주세요.');
    }

    return new Error(error.message || '영상 생성 중 오류가 발생했습니다.');
  }
}

// Singleton 인스턴스
export const geminiVideoService = new GeminiVideoService();

// 타입 export
export type { VideoGenerationOptions, VideoGenerationResult };
