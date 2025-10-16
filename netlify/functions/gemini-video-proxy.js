/**
 * Netlify Function: Gemini Veo Video Generation Proxy
 * 
 * 이미지 1개: Veo 3 → 8초
 * 이미지 2개: Veo 3.1 (last_frame) → 8초 전환
 */

const { GoogleGenAI } = require('@google/genai');

// ⚠️ 중요: Netlify Functions 타임아웃 설정 (5분)
exports.config = {
  timeout: 300
};

/**
 * Netlify Function Handler
 */
exports.handler = async (event, context) => {
  // CORS 헤더
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Preflight 요청 처리
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  // Health Check
  if (event.httpMethod === 'GET' && event.path.endsWith('/health')) {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() })
    };
  }

  // POST만 허용
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    // 요청 파싱
    const { images, prompt, aspectRatio = '9:16' } = JSON.parse(event.body);

    // 검증
    if (!images || !Array.isArray(images) || images.length === 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: '이미지가 필요합니다.' })
      };
    }

    if (images.length > 2) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: '최대 2개의 이미지만 지원됩니다.' })
      };
    }

    if (!prompt) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: '프롬프트가 필요합니다.' })
      };
    }

    console.log('🎬 Veo Video 생성 시작:', {
      imageCount: images.length,
      model: images.length === 2 ? 'Veo 3.1' : 'Veo 3',
      promptLength: prompt.length,
      aspectRatio
    });

    // Google GenAI Client 초기화
    const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    // 모델 선택
    const modelName = 'veo-3.1-generate-preview';
    
    // 이미지 처리
    const firstImageData = images[0].split(',')[1]; // base64 부분만
    const firstImageBuffer = Buffer.from(firstImageData, 'base64');
    
    let operation;
    
    if (images.length === 2) {
      // 2개 이미지: last_frame 사용
      console.log('📸📸 Veo 3.1 모드: 첫 프레임 + 마지막 프레임');
      
      const lastImageData = images[1].split(',')[1];
      const lastImageBuffer = Buffer.from(lastImageData, 'base64');
      
      operation = await client.models.generateVideos({
        model: modelName,
        prompt: prompt,
        image: {
          mimeType: 'image/jpeg',
          data: firstImageBuffer
        },
        config: {
          lastFrame: {
            mimeType: 'image/jpeg',
            data: lastImageBuffer
          },
          aspectRatio: aspectRatio,
          durationSeconds: '8',
          personGeneration: 'allow_adult'
        }
      });
      
    } else {
      // 1개 이미지: 일반 생성
      console.log('📸 Veo 3 모드: 단일 이미지');
      
      operation = await client.models.generateVideos({
        model: modelName,
        prompt: prompt,
        image: {
          mimeType: 'image/jpeg',
          data: firstImageBuffer
        },
        config: {
          aspectRatio: aspectRatio,
          durationSeconds: '8',
          personGeneration: 'allow_adult'
        }
      });
    }

    // 비동기 작업 폴링
    console.log('⏳ 비디오 생성 대기 중... (최대 5분 소요)');
    
    let attempts = 0;
    const maxAttempts = 30; // 5분 (10초 * 30)
    
    while (!operation.done && attempts < maxAttempts) {
      console.log(`⏱️ 폴링 ${attempts + 1}/${maxAttempts}...`);
      
      await new Promise(resolve => setTimeout(resolve, 10000)); // 10초 대기
      
      // 작업 상태 갱신
      operation = await client.operations.get({ name: operation.name });
      attempts++;
    }

    if (!operation.done) {
      throw new Error('비디오 생성 시간이 초과되었습니다. (5분)');
    }

    // 결과 확인
    const generatedVideos = operation.response?.generatedVideos;
    
    if (!generatedVideos || generatedVideos.length === 0) {
      throw new Error('생성된 비디오가 없습니다.');
    }

    const video = generatedVideos[0];
    const videoFile = video.video;
    
    if (!videoFile || !videoFile.uri) {
      throw new Error('비디오 URI를 찾을 수 없습니다.');
    }

    // 비디오 다운로드 URL 생성
    const videoUrl = videoFile.uri;

    console.log('✅ 비디오 생성 완료:', {
      videoUrl: videoUrl.substring(0, 80) + '...',
      duration: images.length === 2 ? '8s (transition)' : '8s',
      creditsUsed: images.length === 2 ? 3 : 1
    });

    // 성공 응답
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        videoUrl,
        duration: 8,
        creditsUsed: images.length === 2 ? 3 : 1,
        model: modelName
      })
    };

  } catch (error) {
    console.error('❌ Veo Video 생성 오류:', error);

    // 에러 응답
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: error.message || '영상 생성 중 오류가 발생했습니다.',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      })
    };
  }
};
