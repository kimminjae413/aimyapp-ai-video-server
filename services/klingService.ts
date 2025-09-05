import type { ImageFile } from '../types';

// Kling API configuration
const KLING_API_KEY = process.env.KLING_ACCESS_KEY || ''; // 환경변수명 통일
const KLING_API_BASE_URL = 'https://api-singapore.klingai.com/v1/videos/image2video';

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
  duration: number = 5 // 기본 5초 영상
): Promise<string> => {
  if (!KLING_API_KEY) {
    throw new Error('KLING_ACCESS_KEY 환경 변수가 설정되지 않았습니다.');
  }

  try {
    // Base64 문자열에서 data: 접두사 제거 (API 요구사항)
    let cleanBase64 = image.base64;
    // 이미 data: 접두사가 포함된 경우 제거
    if (cleanBase64.includes(',')) {
      cleanBase64 = cleanBase64.split(',')[1];
    }
    // data:image/jpeg;base64, 형식이 아닌 경우도 처리
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

    // Step 1: Create Image to Video Task
    const createTaskResponse = await fetch(KLING_API_BASE_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${KLING_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model_name: 'kling-v1', // 기본 모델
        mode: 'std', // standard 모드 (비용 효율적)
        duration: duration.toString(),
        image: cleanBase64, // 접두사 없는 순수 Base64
        prompt: prompt || 'Create a natural and smooth video movement', // 프롬프트 기본값
        cfg_scale: 0.5, // 프롬프트 준수 강도 (0-1)
        negative_prompt: '', // 부정 프롬프트 (선택)
        callback_url: '', // 콜백 URL (선택)
        external_task_id: `task_${Date.now()}` // 커스텀 태스크 ID
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
      // Query single task status
      const response = await fetch(`${KLING_API_BASE_URL}/${taskId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${KLING_API_KEY}`, // Bearer 토큰 사용
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
        // 비디오 생성 완료
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

      // 아직 처리 중이면 대기
      await new Promise(resolve => setTimeout(resolve, pollInterval));
      attempts++;
    } catch (error) {
      console.error('❌ 비디오 상태 확인 중 오류:', error);
      throw error;
    }
  }

  throw new Error('비디오 생성 시간 초과 - 5분 이상 소요되고 있습니다. 나중에 다시 시도해주세요.');
};

// 헤어살롱 전문 모션 템플릿
export const motionTemplates = {
  // 헤어 모델 포즈
  hairModelPose1: '머리를 천천히 좌우로 돌리며 헤어스타일을 보여주는 전문 모델 포즈 / Professional hair model slowly turning head left and right to showcase hairstyle from multiple angles',
  hairModelPose2: '한 손으로 머리카락을 부드럽게 쓸어올리며 스타일을 보여주는 우아한 포즈 / Elegant pose gently sweeping hair up with one hand to show the hairstyle',
  hairModelPose3: '고개를 뒤로 젖히며 머리카락을 흔드는 다이나믹한 헤어 모델 포즈 / Dynamic hair model pose tilting head back and shaking hair gracefully',
  
  // 헤어 리뷰 모션
  hairReview1: '새로운 헤어스타일에 만족하며 거울을 보듯 좌우로 확인하는 모습 / Customer checking new hairstyle in mirror-like motion, looking satisfied left and right',
  hairReview2: '머리를 만지며 "너무 마음에 들어요"라고 말하는 듯한 행복한 표정 / Happy expression touching hair as if saying "I love my new hairstyle"',
  hairReview3: '앞머리를 정리하며 수줍게 미소 짓는 자연스러운 모습 / Natural shy smile while adjusting bangs with fingers',
  
  // 자연스러운 일반인 포즈
  naturalPose1: '처음엔 수줍어하다가 점점 자신감 있게 웃는 자연스러운 변화 / Natural transition from shy to confident smile',
  naturalPose2: '부끄러워하며 손으로 얼굴을 살짝 가렸다가 활짝 웃는 모습 / Shyly covering face with hand then breaking into genuine laugh',
  naturalPose3: '머리를 귀 뒤로 넘기며 수줍게 웃는 일상적인 모습 / Everyday gesture tucking hair behind ear with shy smile',
  
  // 헤어 디테일 보여주기
  showDetail1: '뒷머리를 보여주기 위해 천천히 180도 회전하는 모습 / Slowly rotating 180 degrees to show back of hairstyle',
  showDetail2: '머리를 숙였다가 올리며 레이어드컷이나 펌의 움직임을 보여주는 모습 / Lowering and raising head to show layered cut or perm movement',
  showDetail3: '바람에 자연스럽게 날리는 것처럼 머리를 흔들어 질감을 보여주는 모습 / Shaking hair as if in breeze to show texture and flow',
  
  // 비포&애프터 느낌
  transformation1: '놀란 표정으로 자신의 변화된 모습을 확인하는 리액션 / Surprised reaction discovering their transformation',
  transformation2: '거울을 보며 새로운 헤어스타일에 감탄하는 자연스러운 표정 / Natural admiration expression looking at new hairstyle in mirror',
  
  // 살롱 분위기
  salonVibe1: '헤어 시술 후 만족스럽게 일어나며 머리를 정리하는 모습 / Getting up satisfied after hair treatment while arranging hair',
  salonVibe2: '디자이너와 하이파이브하는 듯한 즐거운 모습 / Happy gesture as if high-fiving with hairstylist'
};

// 카메라 무브먼트 타입
export const cameraMovements = {
  simple: '기본 카메라 움직임',
  down_back: '카메라 내려가며 뒤로 이동 (Pan down and zoom out)',
  forward_up: '카메라 앞으로 이동하며 위로 (Zoom in and pan up)',
  right_turn_forward: '오른쪽으로 회전하며 앞으로 (Rotate right and advance)',
  left_turn_forward: '왼쪽으로 회전하며 앞으로 (Rotate left and advance)'
};
