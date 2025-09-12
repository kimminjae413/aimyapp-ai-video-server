// services/asyncOpenAIService.ts - 비동기 OpenAI 서비스
import type { ImageFile } from '../types';

export interface AsyncTaskResult {
  taskId: string;
  status: 'processing' | 'completed' | 'failed' | 'not_found';
  result?: ImageFile;
  error?: string;
  elapsedTime?: number;
  processingTime?: number;
}

/**
 * 비동기 OpenAI 이미지 생성 시작
 */
export const startAsyncGeneration = async (
  imageFile: ImageFile, 
  prompt: string
): Promise<string> => {
  try {
    console.log('🚀 Starting async OpenAI generation...');
    
    const response = await fetch('/.netlify/functions/openai-start', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        imageBase64: imageFile.base64,
        prompt: prompt
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to start async generation: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log(`✅ Async task started: ${data.taskId}`);
    
    return data.taskId;
  } catch (error) {
    console.error('❌ Failed to start async generation:', error);
    throw error;
  }
};

/**
 * 작업 결과 확인
 */
export const checkTaskResult = async (taskId: string): Promise<AsyncTaskResult> => {
  try {
    const response = await fetch(`/.netlify/functions/openai-result/${taskId}`);
    
    if (!response.ok) {
      if (response.status === 404) {
        return { taskId, status: 'not_found' };
      }
      throw new Error(`Failed to check task result: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`❌ Failed to check task ${taskId}:`, error);
    throw error;
  }
};

/**
 * 폴링으로 결과 대기 (메인 함수)
 */
export const waitForResult = async (
  taskId: string, 
  maxWaitTime: number = 120000, // 2분
  pollInterval: number = 8000    // 8초
): Promise<ImageFile> => {
  const startTime = Date.now();
  const maxAttempts = Math.floor(maxWaitTime / pollInterval);
  let attempts = 0;

  console.log(`⏳ Waiting for result (max ${maxWaitTime/1000}s, check every ${pollInterval/1000}s)`);

  return new Promise((resolve, reject) => {
    const checkResult = async () => {
      try {
        attempts++;
        const result = await checkTaskResult(taskId);
        const elapsedTime = Date.now() - startTime;
        
        console.log(`🔍 Check ${attempts}/${maxAttempts}: ${result.status} (${Math.round(elapsedTime/1000)}s)`);

        if (result.status === 'completed') {
          if (result.result) {
            console.log(`✅ Task completed successfully in ${Math.round(elapsedTime/1000)}s`);
            resolve(result.result);
          } else {
            reject(new Error('Task completed but no result data'));
          }
        } else if (result.status === 'failed') {
          reject(new Error(`OpenAI generation failed: ${result.error}`));
        } else if (result.status === 'not_found') {
          reject(new Error('Task not found or expired'));
        } else if (result.status === 'processing') {
          // 계속 대기
          if (attempts >= maxAttempts) {
            reject(new Error(`Timeout: No result after ${Math.round(elapsedTime/1000)}s`));
          } else {
            setTimeout(checkResult, pollInterval);
          }
        }
      } catch (error) {
        reject(error);
      }
    };

    // 첫 번째 체크 시작
    checkResult();
  });
};

/**
 * 원스텝 비동기 생성 (시작 + 대기)
 */
export const generateImageAsync = async (
  imageFile: ImageFile,
  prompt: string,
  maxWaitTime?: number
): Promise<ImageFile> => {
  try {
    console.log('🎯 Starting full async generation process...');
    
    // 1. 작업 시작
    const taskId = await startAsyncGeneration(imageFile, prompt);
    
    // 2. 결과 대기
    const result = await waitForResult(taskId, maxWaitTime);
    
    console.log('🎉 Async generation completed successfully');
    return result;
    
  } catch (error) {
    console.error('❌ Async generation failed:', error);
    throw error;
  }
};

/**
 * 진행 상황 추적용 헬퍼
 */
export const createProgressTracker = (
  taskId: string,
  onProgress: (status: string, elapsedTime: number) => void
) => {
  const startTime = Date.now();
  let intervalId: NodeJS.Timeout;

  const start = () => {
    intervalId = setInterval(async () => {
      try {
        const result = await checkTaskResult(taskId);
        const elapsedTime = Date.now() - startTime;
        
        let statusText = '';
        switch (result.status) {
          case 'processing':
            statusText = `OpenAI에서 처리 중... (${Math.round(elapsedTime/1000)}초)`;
            break;
          case 'completed':
            statusText = '완료!';
            stop();
            break;
          case 'failed':
            statusText = '실패';
            stop();
            break;
          case 'not_found':
            statusText = '작업을 찾을 수 없음';
            stop();
            break;
        }
        
        onProgress(statusText, elapsedTime);
      } catch (error) {
        console.error('Progress tracking error:', error);
      }
    }, 3000); // 3초마다 진행상황 업데이트
  };

  const stop = () => {
    if (intervalId) {
      clearInterval(intervalId);
    }
  };

  return { start, stop };
};
