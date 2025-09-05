import type { ImageFile } from '../types';

// Kling API configuration
const KLING_API_KEY = process.env.KLING_ACCESS_KEY || '';
const KLING_API_BASE_URL = 'https://api-singapore.klingai.com/v1/videos/image2video';

// CORS 프록시 (필요시 사용)
const CORS_PROXY = 'https://corsproxy.io/?';
const USE_CORS_PROXY = false; // 서버사이드 또는 Netlify Functions 사용시 false

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

export const generateVideoWithKling = async (
  image: ImageFile,
  prompt: string,
  duration: number = 5
): Promise<string> => {
  if (!KLING_API_KEY) {
    throw new Error('KLING_ACCESS_KEY 환경 변수가 설정되지 않았습니다.');
  }

  try {
    // Base64 문자열에서 data: 접두사 제거 (API 요구사항)
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

    console.log('🎬 Kling 비디오 생성 시작');
    console.log('- Prompt:', prompt);
    console.log('- Duration:', duration, '초');
    console.log('- Image base64 length:', cleanBase64.length);

    // API URL 설정 (CORS 프록시 사용 여부에 따라)
    const apiUrl = USE_CORS_PROXY 
      ? CORS_PROXY + encodeURIComponent(KLING_API_BASE_URL)
      : KLING_API_BASE_URL;

    // Step 1: Create Image to Video Task
    const createTaskResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${KLING_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model_name: 'kling-v1',
        mode: 'std', // standard 모드
        duration: duration.toString(),
        image: cleanBase64, // 접두사 없는 순수 Base64
        prompt: prompt || 'Create a natural and smooth video movement',
        cfg_scale: 0.5,
        negative_prompt: '',
        callback_url: '',
        external_task_id: `task_${Date.now()}`
      }),
    });

    const responseText = await createTaskResponse.text();
    let createData: KlingCreateTaskResponse;
    
    try {
      createData = JSON.parse(responseText);
    } catch (parseError) {
      console.error('응답 파싱 실패:', responseText);
      throw new Error('Kling API 응답을 파싱할 수 없습니다.');
    }

    if (!createTaskResponse.ok) {
      throw new Error(`Kling API 요청 실패: ${createData.message || createTaskResponse.statusText}`);
    }
    
    if (createData.code !== 0) {
      throw new Error(`Kling API 에러 (code: ${createData.code}): ${createData.message}`);
    }

    const taskId = createData.data.task_id;
    console.log('✅ Kling 비디오 작업 생성 완료. Task ID:', taskId);

    // Step 2: Poll for task completion
    return await pollVideoStatus(taskId);
  } catch (error) {
    console.error('❌ Kling API 호출 중 오류:', error);
    
    // CORS 에러인 경우
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      throw new Error('CORS 정책으로 인해 직접 API 호출이 차단되었습니다. 서버 측 프록시 구현이 필요합니다.');
    }
    
    if (error instanceof Error) {
      throw new Error(`비디오 생성 실패: ${error.message}`);
    }
    throw new Error('Kling API를 사용한 비디오 생성에 실패했습니다.');
  }
};

// 비디오 생성 상태를 주기적으로 확인
const pollVideoStatus = async (taskId: string, maxAttempts: number = 60): Promise<string> => {
  const pollInterval = 5000; // 5초마다 확인
  let attempts = 0;

  while (attempts < maxAttempts) {
    try {
      const apiUrl = USE_CORS_PROXY 
        ? CORS_PROXY + encodeURIComponent(`${KLING_API_BASE_URL}/${taskId}`)
        : `${KLING_API_BASE_URL}/${taskId}`;

      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${KLING_API_KEY}`,
          'Content-Type': 'application/json',
        },
      });

      const responseText = await response.text();
      let data: KlingQueryTaskResponse;
      
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error('상태 응답 파싱 실패:', responseText);
        throw new Error('상태 확인 응답을 파싱할 수 없습니다.');
      }

      if (!response.ok) {
        throw new Error(`상태 확인 실패: ${data.message || response.statusText}`);
      }
      
      if (data.code !== 0) {
        throw new Error(`Kling API 에러 (code: ${data.code}): ${data.message}`);
      }

      const status = data.data.task_status;
      console.log(`🔄 비디오 생성 상태: ${status} (${attempts + 1}/${maxAttempts})`);

      if (status === 'succeed') {
        if (data.data.task_result && data.data.task_result.videos.length > 0) {
          const videoUrl = data.data.task_result.videos[0].url;
          console.log('✅ 비디오 생성 완료!');
          console.log('📹 비디오 URL:', videoUrl);
          return videoUrl;
        } else {
          throw new Error('비디오 URL을 찾을 수 없습니다.');
        }
      }

      if (status === 'failed') {
        const errorMsg = data.data.task_status_msg || '알 수 없는 오류';
        throw new Error(`비디오 생성 실패: ${errorMsg}`);
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

// 헤어살롱 전문 모션 템플릿 (영어 프롬프트)
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
