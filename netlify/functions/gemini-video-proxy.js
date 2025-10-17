/**
 * Netlify Function: Gemini Veo 2 Video Generation (FIXED)
 * Veo 2: 5초/8초
 * 
 * 환경변수:
 * - GEMINI_VIDEO_API_KEY (우선순위 1)
 * - GEMINI_API_KEY (폴백)
 */

const { GoogleGenAI } = require('@google/genai');

exports.config = {
  timeout: 300  // 5분
};

exports.handler = async (event, context) => {
  const startTime = Date.now();
  
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

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
    console.log('═══════════════════════════════════════════════════════════');
    console.log('🎬 Gemini Veo 2 Video Generation Request Started');
    console.log('═══════════════════════════════════════════════════════════');
    
    const data = JSON.parse(event.body);
    const { images, prompt, duration = 5 } = data;

    // Validation
    if (!images || !Array.isArray(images) || images.length === 0 || images.length > 2) {
      throw new Error('이미지는 1~2개만 지원됩니다.');
    }

    if (!prompt || typeof prompt !== 'string' || prompt.trim() === '') {
      throw new Error('프롬프트가 필요합니다.');
    }

    // Duration validation - Veo 2: 5초, 8초만 지원
    const validDurations = [5, 8];
    if (!validDurations.includes(duration)) {
      throw new Error(`영상 길이는 5초, 8초만 가능합니다. (받은 값: ${duration})`);
    }

    // API Key
    const apiKey = process.env.GEMINI_VIDEO_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_VIDEO_API_KEY or GEMINI_API_KEY not configured');
    }

    console.log('🔑 API Key source:', process.env.GEMINI_VIDEO_API_KEY ? 'GEMINI_VIDEO_API_KEY' : 'GEMINI_API_KEY (fallback)');

    // 크레딧 계산
    const isTwoImages = images.length === 2;
    const creditsRequired = duration;

    const selectedModel = 'veo-2.0-generate-001';

    console.log('📊 Request Parameters:', {
      imageCount: images.length,
      model: selectedModel,
      duration: `${duration}초`,
      promptLength: prompt.length,
      creditsRequired: creditsRequired
    });

    // Initialize SDK
    console.log('🔧 Initializing Google GenAI SDK...');
    const client = new GoogleGenAI({ apiKey });

    // Process first image
    console.log('📸 Processing images...');
    const firstImageBase64 = images[0].includes(',') 
      ? images[0].split(',')[1] 
      : images[0];

    if (!firstImageBase64 || firstImageBase64.length === 0) {
      throw new Error('첫 번째 이미지 데이터가 비어있습니다.');
    }

    console.log('✅ First image extracted:', {
      base64Length: firstImageBase64.length,
      preview: firstImageBase64.substring(0, 50) + '...'
    });

    // Build request parameters - ✅ resolution 제거됨!
    const requestParams = {
      model: selectedModel,
      prompt: prompt,
      image: {
        imageBytes: firstImageBase64,
        mimeType: 'image/jpeg'
      },
      config: {
        aspectRatio: '9:16',
        durationSeconds: duration,
        personGeneration: 'allow_adult'
      }
    };

    // Add second image for interpolation
    if (isTwoImages) {
      const lastImageBase64 = images[1].includes(',')
        ? images[1].split(',')[1]
        : images[1];

      if (!lastImageBase64 || lastImageBase64.length === 0) {
        throw new Error('두 번째 이미지 데이터가 비어있습니다.');
      }

      requestParams.lastFrame = {
        imageBytes: lastImageBase64,
        mimeType: 'image/jpeg'
      };

      console.log('✅ Last frame added:', {
        base64Length: lastImageBase64.length,
        preview: lastImageBase64.substring(0, 50) + '...'
      });
      
      console.log(`🎬 Mode: Veo 2 Frame Interpolation (${duration}초)`);
    } else {
      console.log(`🎬 Mode: Veo 2 Image-to-Video (${duration}초)`);
    }

    // Generate video
    console.log('▶️ Calling generateVideos API...');
    console.log('📋 Request structure:', {
      model: requestParams.model,
      hasPrompt: !!requestParams.prompt,
      hasImage: !!requestParams.image?.imageBytes,
      hasLastFrame: !!requestParams.lastFrame?.imageBytes,
      config: requestParams.config
    });

    const operation = await client.models.generateVideos(requestParams);

    if (!operation || !operation.name) {
      throw new Error('Invalid operation response - no operation.name');
    }

    console.log('✅ Operation started:', operation.name);

    const responseTime = Date.now() - startTime;
    
    console.log('═══════════════════════════════════════════════════════════');
    console.log('✅ Veo 2 Video Generation Started Successfully');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📊 Response:', {
      operationId: operation.name.substring(0, 50) + '...',
      duration: `${duration}초`,
      creditsUsed: creditsRequired,
      responseTime: `${responseTime}ms`
    });

    return {
      statusCode: 202,
      headers,
      body: JSON.stringify({
        success: true,
        operationId: operation.name,
        status: 'processing',
        message: `${duration}초 영상 생성이 시작되었습니다. 예상 소요 시간: ${duration === 5 ? '3-4분' : '4-5분'}`,
        duration: duration,
        creditsUsed: creditsRequired,
        estimatedTime: duration === 5 ? '3-4분' : '4-5분'
      })
    };

  } catch (error) {
    console.error('❌ Video generation failed:', error.message);
    console.error('Stack:', error.stack);
    
    let errorMessage = error.message || 'Video generation failed';
    let statusCode = 500;

    if (error.message && error.message.includes('API key')) {
      errorMessage = 'API 키가 설정되지 않았습니다.';
      statusCode = 401;
    } else if (error.message && error.message.includes('quota')) {
      errorMessage = 'API 할당량 초과. 잠시 후 다시 시도해주세요.';
      statusCode = 429;
    } else if (error.message && error.message.includes('429')) {
      errorMessage = 'API 요청 한도 초과. 1분 후 다시 시도해주세요.';
      statusCode = 429;
    } else if (error.message && error.message.includes('not found')) {
      errorMessage = 'Veo 2 모델을 찾을 수 없습니다. API 키 권한을 확인하세요.';
      statusCode = 404;
    } else if (error.message && error.message.includes('resolution')) {
      errorMessage = 'resolution 파라미터는 Veo 2에서 지원되지 않습니다.';
      statusCode = 400;
    }
    
    return {
      statusCode: statusCode,
      headers,
      body: JSON.stringify({
        success: false,
        error: errorMessage,
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      })
    };
  }
};
