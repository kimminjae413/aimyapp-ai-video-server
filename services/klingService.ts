import type { ImageFile } from '../types';

// Netlify Function 프록시 사용
const USE_NETLIFY_PROXY = true;
const PROXY_URL = '/.netlify/functions/kling-proxy';

interface KlingCreateTaskResponse {
  code: number;
  message: string;
  request_id: string;
  data: {
    task_id: string;
    task_status: 'submitted' | 'processing' | 'succeed' | 'failed';
    task_info: {
      external_task_id?: string;
    };
    created_at: number;
    updated_at: number;
  };
}

interface KlingQueryTaskResponse {
  code: number;
  message: string;
  request_id: string;
  data: {
    task_id: string;
    task_status: 'submitted' | 'processing' | 'succeed' | 'failed';
    task_status_msg?: string;
    task_info: {
      external_task_id?: string;
    };
    created_at: number;
    updated_at: number;
    task_result?: {
      videos: Array<{
        id: string;
        url: string;
        duration: string;
      }>;
    };
  };
}

// 영상 길이별 필요 크레딧 계산
export const getRequiredCredits = (duration: number): number => {
  if (duration <= 5) {
    return 2;
  } else if (duration <= 10) {
    return 3;
  } else {
    return Math.ceil(duration / 5) + 1;
  }
};

// 🆕 URL 유효성 검증 함수
export const validateVideoUrl = async (videoUrl: string): Promise<{ isValid: boolean; error?: string }> => {
  try {
    console.log('🔍 비디오 URL 검증:', videoUrl.substring(0, 80) + '...');
    
    // HEAD 요청으로 URL 확인 (데이터 다운로드 없이)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10초 타임아웃
    
    try {
      const response = await fetch(videoUrl, {
        method: 'HEAD',
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; VideoValidator/1.0)',
          'Accept': 'video/*'
        }
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const contentType = response.headers.get('content-type');
        console.log('✅ URL 유효 - Content-Type:', contentType);
        return { isValid: true };
      } else {
        console.warn('⚠️ URL 응답 오류:', response.status, response.statusText);
        return { 
          isValid: false, 
          error: `HTTP ${response.status}: ${response.statusText}` 
        };
      }
    } catch (fetchError) {
      clearTimeout(timeoutId);
      throw fetchError;
    }
    
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.error('❌ URL 검증 타임아웃');
      return { isValid: false, error: 'Request timeout' };
    }
    
    console.error('❌ URL 검증 실패:', error);
    return { 
      isValid: false, 
      error: error instanceof Error ? error.message : 'Network error' 
    };
  }
};

// 🆕 URL 복구 시도 함수
export const attemptUrlRecovery = async (originalUrl: string, taskId?: string): Promise<string | null> => {
  try {
    console.log('🔧 URL 복구 시도 시작...');
    
    // 1. URL에서 [...truncated] 제거
    let cleanedUrl = originalUrl.replace('...[truncated]', '');
    
    // 2. URL이 완전하지 않은 경우 복구 시도
    if (!cleanedUrl.endsWith('.mp4')) {
      cleanedUrl += '.mp4';
    }
    
    const urlsToTry = [cleanedUrl];
    
    // 3. taskId가 있으면 추가 URL 패턴 시도
    if (taskId) {
      const baseUrls = [
        `https://v15-kling.klingai.com/bs2/upload-ylab-stunt-sgp/se/stream_lake_m2v_img2video_v21_std_v36_v2/${taskId}_raw_video.mp4`,
        `https://v15-kling.klingai.com/bs2/upload/${taskId}.mp4`,
        `https://v15-kling.klingai.com/bs2/${taskId}_video.mp4`
      ];
      urlsToTry.push(...baseUrls);
    }
    
    // 4. 각 URL 시도
    for (const testUrl of urlsToTry) {
      console.log('🔄 URL 테스트:', testUrl.substring(0, 80) + '...');
      
      const validation = await validateVideoUrl(testUrl);
      if (validation.isValid) {
        console.log('✅ URL 복구 성공:', testUrl);
        return testUrl;
      } else {
        console.log('❌ URL 실패:', validation.error);
      }
    }
    
    console.warn('❌ 모든 URL 복구 시도 실패');
    return null;
    
  } catch (error) {
    console.error('❌ URL 복구 중 오류:', error);
    return null;
  }
};

// 🆕 비디오 다운로드 및 임시 저장 (옵션)
export const downloadAndStoreVideo = async (videoUrl: string): Promise<string | null> => {
  try {
    console.log('📥 비디오 다운로드 및 임시 저장 시도...');
    
    const response = await fetch(videoUrl);
    if (!response.ok) {
      throw new Error(`Download failed: ${response.status}`);
    }
    
    const blob = await response.blob();
    const tempUrl = URL.createObjectURL(blob);
    
    console.log('✅ 임시 URL 생성 완료');
    return tempUrl;
    
  } catch (error) {
    console.error('❌ 비디오 다운로드 실패:', error);
    return null;
  }
};

// 메인 비디오 생성 함수 (URL 검증 강화)
export const generateVideoWithKling = async (
  image: ImageFile,
  prompt: string,
  duration: number = 5
): Promise<string> => {
  try {
    // Base64 정리
    let cleanBase64 = image.base64;
    if (cleanBase64.includes(',')) {
      cleanBase64 = cleanBase64.split(',')[1];
    }
    if (cleanBase64.startsWith('data:')) {
      const commaIndex = cleanBase64.indexOf(',');
      if (commaIndex !== -1) {
        cleanBase64 = cleanBase64.substring(commaIndex + 1);
      }
    }

    console.log('🎬 Kling 비디오 생성 시작 (URL 검증 강화)');
    console.log('- Prompt:', prompt);
    console.log('- Duration:', duration, '초');
    console.log('- Required Credits:', getRequiredCredits(duration), '회');
    console.log('- Image base64 length:', cleanBase64.length);

    if (USE_NETLIFY_PROXY) {
      const createTaskResponse = await fetch(PROXY_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          method: 'POST',
          endpoint: '',
          body: {
            model_name: 'kling-v2-1',
            mode: 'std',
            duration: duration.toString(),
            image: cleanBase64,
            prompt: prompt || 'Create a natural and smooth video movement',
            cfg_scale: 0.5,
            negative_prompt: '',
            callback_url: '',
            external_task_id: `task_${Date.now()}`
          }
        }),
      });

      const responseText = await createTaskResponse.text();
      let createData: KlingCreateTaskResponse;
      
      try {
        createData = JSON.parse(responseText);
      } catch (parseError) {
        console.error('응답 파싱 실패:', responseText);
        throw new Error('API 응답을 파싱할 수 없습니다.');
      }

      if (!createTaskResponse.ok || createData.code !== 0) {
        throw new Error(`비디오 생성 요청 실패: ${createData.message || 'Unknown error'}`);
      }

      const taskId = createData.data.task_id;
      console.log('✅ 비디오 작업 생성 완료. Task ID:', taskId);

      // 🆕 URL 검증이 포함된 폴링
      return await pollVideoStatusWithValidation(taskId);
    } else {
      throw new Error('직접 API 호출은 CORS 정책으로 차단됩니다.');
    }
  } catch (error) {
    console.error('❌ Kling API 호출 중 오류:', error);
    
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      throw new Error('네트워크 오류가 발생했습니다. Netlify Function을 확인하세요.');
    }
    
    if (error instanceof Error) {
      throw new Error(`비디오 생성 실패: ${error.message}`);
    }
    throw new Error('Kling API를 사용한 비디오 생성에 실패했습니다.');
  }
};

// 🆕 URL 검증이 포함된 폴링
const pollVideoStatusWithValidation = async (taskId: string, maxAttempts: number = 60): Promise<string> => {
  const pollInterval = 5000;
  let attempts = 0;

  while (attempts < maxAttempts) {
    try {
      if (USE_NETLIFY_PROXY) {
        const response = await fetch(PROXY_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            method: 'GET',
            endpoint: `/${taskId}`
          }),
        });

        const responseText = await response.text();
        let data: KlingQueryTaskResponse;
        
        try {
          data = JSON.parse(responseText);
        } catch (parseError) {
          console.error('상태 응답 파싱 실패:', responseText);
          throw new Error('상태 확인 응답을 파싱할 수 없습니다.');
        }

        if (!response.ok || data.code !== 0) {
          throw new Error(`상태 확인 실패: ${data.message || 'Unknown error'}`);
        }

        const status = data.data.task_status;
        console.log(`🔄 비디오 생성 상태: ${status} (${attempts + 1}/${maxAttempts})`);

        if (status === 'succeed') {
          if (data.data.task_result && data.data.task_result.videos.length > 0) {
            const originalVideoUrl = data.data.task_result.videos[0].url;
            console.log('🎉 비디오 생성 완료!');
            console.log('📹 원본 URL:', originalVideoUrl);
            
            // 🆕 URL 검증 및 복구 프로세스
            console.log('🔍 URL 유효성 검증 시작...');
            
            const validation = await validateVideoUrl(originalVideoUrl);
            
            if (validation.isValid) {
              console.log('✅ URL 검증 성공 - 바로 반환');
              return originalVideoUrl;
            } else {
              console.warn('⚠️ URL 검증 실패, 복구 시도:', validation.error);
              
              // URL 복구 시도
              const recoveredUrl = await attemptUrlRecovery(originalVideoUrl, taskId);
              
              if (recoveredUrl) {
                console.log('✅ URL 복구 성공:', recoveredUrl);
                return recoveredUrl;
              } else {
                console.error('❌ URL 복구 실패');
                
                // 🆕 최후 수단: 비디오 다운로드 후 임시 URL 생성
                console.log('📥 최후 수단: 비디오 다운로드 시도...');
                const tempUrl = await downloadAndStoreVideo(originalVideoUrl);
                
                if (tempUrl) {
                  console.log('✅ 임시 URL 생성 성공');
                  return tempUrl;
                } else {
                  // 그래도 원본 URL 반환 (사용자가 직접 시도할 수 있도록)
                  console.warn('⚠️ 모든 복구 방법 실패, 원본 URL 반환');
                  return originalVideoUrl;
                }
              }
            }
          } else {
            throw new Error('비디오 URL을 찾을 수 없습니다.');
          }
        }

        if (status === 'failed') {
          const errorMsg = data.data.task_status_msg || '알 수 없는 오류';
          throw new Error(`비디오 생성 실패: ${errorMsg}`);
        }
      } else {
        throw new Error('직접 API 호출은 지원되지 않습니다.');
      }

      await new Promise(resolve => setTimeout(resolve, pollInterval));
      attempts++;
    } catch (error) {
      console.error('❌ 비디오 상태 확인 중 오류:', error);
      throw error;
    }
  }

  throw new Error('비디오 생성 시간 초과 - 5분 이상 소요되고 있습니다.');
};

// 기존 템플릿들 유지
export const motionTemplates = {
  // 헤어 모델 포즈
  hairModelPose1: 'Professional hair model slowly turning head left and right to showcase hairstyle from multiple angles with confident expression',
  hairModelPose2: 'Elegant model gently sweeping hair upward with one hand, showing hair texture and style with graceful movement',
  hairModelPose3: 'Dynamic hair model tilting head back and shaking hair gracefully to show volume and movement',
  
  // 헤어 리뷰 모션
  hairReview1: 'Customer checking new hairstyle like looking in mirror, turning head left and right with satisfied smile',
  hairReview2: 'Happy person touching their hair gently while smiling, expressing satisfaction with their new hairstyle',
  hairReview3: 'Natural shy smile while adjusting bangs with fingers, showing cute and satisfied expression',
  
  // 자연스러운 일반인 포즈
  naturalPose1: 'Person starting with shy expression then gradually showing confident bright smile, natural emotional transition',
  naturalPose2: 'Shyly covering face with hands then breaking into genuine happy laugh, showing natural embarrassed reaction',
  naturalPose3: 'Casual everyday gesture tucking hair behind ear with gentle shy smile and natural movement',
  
  // 헤어 디테일 보여주기
  showDetail1: 'Slowly rotating full 180 degrees to display back of hairstyle, showing all angles of haircut',
  showDetail2: 'Lowering and raising head smoothly to demonstrate layered cut movement and hair flow dynamics',
  showDetail3: 'Natural hair movement as if in gentle breeze, showing hair texture, shine and natural flow',
  
  // 비포&애프터 느낌
  transformation1: 'Surprised and amazed reaction discovering their new transformed appearance, eyes widening with delight',
  transformation2: 'Looking at reflection with natural admiration and wonder at new hairstyle transformation',
  
  // 살롱 분위기
  salonVibe1: 'Standing up satisfied after hair treatment, arranging hair with hands and checking final result',
  salonVibe2: 'Happy celebratory gesture as if high-fiving with hairstylist, showing excitement and satisfaction'
};

// 카메라 무브먼트 타입
export const cameraMovements = {
  simple: 'Basic camera movement',
  down_back: 'Pan down and zoom out',
  forward_up: 'Zoom in and pan up',
  right_turn_forward: 'Rotate right and advance',
  left_turn_forward: 'Rotate left and advance'
};

// 🆕 URL 문제 진단 함수 (디버깅용)
export const diagnoseVideoUrl = async (videoUrl: string): Promise<void> => {
  console.log('🔍 === URL 진단 시작 ===');
  console.log('URL:', videoUrl);
  console.log('길이:', videoUrl.length);
  console.log('잘림 여부:', videoUrl.includes('...[truncated]'));
  console.log('확장자:', videoUrl.split('.').pop());
  
  const validation = await validateVideoUrl(videoUrl);
  console.log('유효성:', validation.isValid ? '✅ 유효' : '❌ 무효');
  if (!validation.isValid) {
    console.log('오류:', validation.error);
  }
  
  console.log('🔍 === URL 진단 완료 ===');
};
