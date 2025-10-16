/**
 * Netlify Function: Gemini Veo Video Generation
 * @google/genai SDK 사용 (공식 방법)
 */

const { GoogleGenAI } = require('@google/genai');

exports.config = {
  timeout: 300  // 5분
};

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { images, prompt } = JSON.parse(event.body);

    // 검증
    if (!images || images.length === 0 || images.length > 2) {
      throw new Error('이미지는 1~2개만 지원됩니다.');
    }

    if (!prompt || prompt.trim() === '') {
      throw new Error('프롬프트가 필요합니다.');
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY not configured');
    }

    console.log('🎬 Veo SDK 호출:', {
      imageCount: images.length,
      model: images.length === 2 ? 'veo-3.1' : 'veo-3',
      promptLength: prompt.length
    });

    // SDK 클라이언트 초기화
    const client = new GoogleGenAI({ apiKey });

    // Base64 추출 (data:image/jpeg;base64, 제거)
    const firstImageBase64 = images[0].includes(',') 
      ? images[0].split(',')[1] 
      : images[0];

    // 이미지 객체 생성
    const firstImage = {
      inlineData: {
        data: firstImageBase64,
        mimeType: 'image/jpeg'
      }
    };

    // 모델 및 config 설정
    let model = 'veo-3-generate-preview';
    let requestParams = {
      model: model,
      prompt: prompt,
      image: firstImage,
      config: {
        aspectRatio: '9:16',
        durationSeconds: '8',
        personGeneration: 'allow_adult',
        resolution: '720p'
      }
    };

    // 2개 이미지: Veo 3.1 + lastFrame
    if (images.length === 2) {
      model = 'veo-3.1-generate-preview';
      requestParams.model = model;
      
      const lastImageBase64 = images[1].includes(',')
        ? images[1].split(',')[1]
        : images[1];
      
      // ⚠️ lastFrame은 config 밖에 최상위로!
      requestParams.lastFrame = {
        inlineData: {
          data: lastImageBase64,
          mimeType: 'image/jpeg'
        }
      };

      console.log('📸📸 Veo 3.1 + lastFrame 모드');
    } else {
      console.log('📸 Veo 3 단일 이미지 모드');
    }

    // 🎬 동영상 생성 시작
    console.log('▶️ generate_videos 호출...');
    console.log('📋 요청 구조:', JSON.stringify({
      model: requestParams.model,
      hasImage: !!requestParams.image,
      hasLastFrame: !!requestParams.lastFrame,
      config: requestParams.config
    }, null, 2));
    
    const operation = await client.models.generateVideos(requestParams);

    console.log('✅ Operation 시작:', operation.name);

    // 🔄 폴링 (최대 5분)
    let completedOperation = operation;
    let attempts = 0;
    const maxAttempts = 30;

    while (!completedOperation.done && attempts < maxAttempts) {
      console.log(`⏱️ 폴링 ${attempts + 1}/${maxAttempts}...`);
      await new Promise(resolve => setTimeout(resolve, 10000)); // 10초 대기
      
      completedOperation = await client.operations.get({
        name: operation.name
      });
      
      attempts++;
    }

    if (!completedOperation.done) {
      throw new Error('동영상 생성 타임아웃 (5분 초과)');
    }

    // 📦 결과 추출
    const generatedVideos = completedOperation.response?.generatedVideos;
    
    if (!generatedVideos || generatedVideos.length === 0) {
      throw new Error('생성된 동영상이 없습니다.');
    }

    const videoUrl = generatedVideos[0].video.uri;

    if (!videoUrl) {
      throw new Error('동영상 URL을 찾을 수 없습니다.');
    }

    console.log('✅ 완료:', videoUrl.substring(0, 60) + '...');

    // 성공 응답
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        videoUrl: videoUrl,
        duration: 8,
        creditsUsed: images.length === 2 ? 3 : 1,
        model: model
      })
    };

  } catch (error) {
    console.error('❌ Veo 생성 실패:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: error.message || '동영상 생성 중 오류가 발생했습니다.',
        details: error.stack
      })
    };
  }
};
