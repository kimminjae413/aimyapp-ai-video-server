/**
 * Netlify Function: Gemini Video Generation Proxy
 * 
 * 이미지 1개: Veo 2 (veo-2.0-generate-001) → 5초
 * 이미지 2개: Veo 3.1 (veo-3.1-generate-preview) → 10초 전환
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');

// Gemini API 초기화
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

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

    console.log('🎬 Gemini Video 생성 시작:', {
      imageCount: images.length,
      model: images.length === 2 ? 'Veo 3.1' : 'Veo 2',
      promptLength: prompt.length,
      aspectRatio
    });

    // 모델 선택 및 파라미터 설정
    const isMultipleImages = images.length === 2;
    const modelName = isMultipleImages 
      ? 'veo-3.1-generate-preview'  // 2개 이미지 → Veo 3.1
      : 'veo-2.0-generate-001';      // 1개 이미지 → Veo 2

    const model = genAI.getGenerativeModel({ model: modelName });

    // 이미지 파트 준비
    const imageParts = images.map((imageData, index) => {
      // data:image/jpeg;base64,/9j/4AAQ... 형식
      const [header, base64Data] = imageData.split(',');
      const mimeType = header.match(/:(.*?);/)[1];

      return {
        inlineData: {
          mimeType,
          data: base64Data
        }
      };
    });

    // 요청 구성
    let generationConfig = {
      temperature: 1.0,
      topP: 0.95,
      topK: 40,
      maxOutputTokens: 8192,
      aspectRatio: aspectRatio
    };

    let requestParts = [];

    if (isMultipleImages) {
      // 2개 이미지: last_frame 사용 (Veo 3.1)
      console.log('📸📸 Veo 3.1 모드: 10초 전환 영상');
      
      requestParts = [
        { text: prompt },
        { text: 'Start frame:' },
        imageParts[0],
        { text: 'Last frame:' },
        imageParts[1]
      ];

      generationConfig.duration = '10s';
      
    } else {
      // 1개 이미지: 일반 생성 (Veo 2)
      console.log('📸 Veo 2 모드: 5초 영상');
      
      requestParts = [
        { text: prompt },
        imageParts[0]
      ];

      generationConfig.duration = '5s';
    }

    // 영상 생성 요청
    console.log('⏳ Gemini API 호출 중...');
    
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: requestParts }],
      generationConfig
    });

    // 응답 처리
    const response = await result.response;
    
    if (!response || !response.candidates || response.candidates.length === 0) {
      throw new Error('영상 생성 응답이 없습니다.');
    }

    const candidate = response.candidates[0];
    
    if (!candidate.content || !candidate.content.parts || candidate.content.parts.length === 0) {
      throw new Error('영상 데이터가 없습니다.');
    }

    // 비디오 URL 추출
    let videoUrl = null;
    
    for (const part of candidate.content.parts) {
      if (part.fileData && part.fileData.fileUri) {
        videoUrl = part.fileData.fileUri;
        break;
      }
      
      // 혹은 inlineData로 올 수도 있음
      if (part.inlineData && part.inlineData.data) {
        // base64 비디오 데이터를 blob URL로 변환 필요
        // 하지만 보통 fileUri로 옴
        console.warn('⚠️ inlineData 형식의 비디오 응답');
      }
    }

    if (!videoUrl) {
      console.error('❌ 응답 구조:', JSON.stringify(candidate, null, 2));
      throw new Error('비디오 URL을 찾을 수 없습니다.');
    }

    console.log('✅ 영상 생성 완료:', {
      videoUrl: videoUrl.substring(0, 80) + '...',
      duration: isMultipleImages ? '10s' : '5s',
      creditsUsed: isMultipleImages ? 3 : 1
    });

    // 성공 응답
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        videoUrl,
        duration: isMultipleImages ? 10 : 5,
        creditsUsed: isMultipleImages ? 3 : 1,
        model: modelName
      })
    };

  } catch (error) {
    console.error('❌ Gemini Video 생성 오류:', error);

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

/**
 * 이미지 데이터 검증
 */
function validateImageData(imageData) {
  if (!imageData || typeof imageData !== 'string') {
    return false;
  }

  // data:image/...;base64,... 형식 확인
  if (!imageData.startsWith('data:image/')) {
    return false;
  }

  if (!imageData.includes(';base64,')) {
    return false;
  }

  return true;
}
