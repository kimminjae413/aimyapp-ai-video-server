// ═══════════════════════════════════════════════════════════
// FILE 1: netlify/functions/gemini-video-proxy.js
// ═══════════════════════════════════════════════════════════
/**
 * Netlify Function: Gemini Veo Video Generation (Final Version)
 * 5초 = 5 크레딧, 8초 = 8 크레딧
 * Veo 3 Fast / Veo 3.1 Fast 사용
 * 
 * 환경변수:
 * - GEMINI_VIDEO_API_KEY (우선순위 1)
 * - GEMINI_API_KEY (폴백)
 */

const { GoogleGenAI } = require('@google/genai');

exports.config = {
  timeout: 300  // 5분 (비동기 처리용)
};

exports.handler = async (event, context) => {
  const startTime = Date.now();
  
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
    console.log('═══════════════════════════════════════════════════════════');
    console.log('🎬 Gemini Veo Video Generation Request Started');
    console.log('═══════════════════════════════════════════════════════════');
    
    // Parse request
    const data = JSON.parse(event.body);
    const { images, prompt, duration = 5 } = data;

    // ✅ Validation
    if (!images || !Array.isArray(images) || images.length === 0 || images.length > 2) {
      throw new Error('이미지는 1~2개만 지원됩니다.');
    }

    if (!prompt || typeof prompt !== 'string' || prompt.trim() === '') {
      throw new Error('프롬프트가 필요합니다.');
    }

    // ⏱️ Duration validation (5초 또는 8초만 허용 - API 제한)
    if (![5, 8].includes(duration)) {
      throw new Error('영상 길이는 5초 또는 8초만 가능합니다.');
    }

    // 🔑 API Key - 우선순위: GEMINI_VIDEO_API_KEY > GEMINI_API_KEY
    const apiKey = process.env.GEMINI_VIDEO_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_VIDEO_API_KEY or GEMINI_API_KEY not configured');
    }

    console.log('🔑 API Key source:', process.env.GEMINI_VIDEO_API_KEY ? 'GEMINI_VIDEO_API_KEY' : 'GEMINI_API_KEY (fallback)');

    // 💰 크레딧 계산
    const isTwoImages = images.length === 2;
    const creditsRequired = duration === 5 ? 5 : 8;  // 5초=5크레딧, 8초=8크레딧

    // 🎬 모델 선택 (Veo 3.1 Fast - 항상 사용)
    const selectedModel = 'veo-3.1-fast-generate-preview';  // 1개/2개 이미지 모두 Veo 3.1 Fast

    console.log('📊 Request Parameters:', {
      imageCount: images.length,
      model: selectedModel,
      duration: `${duration}초`,
      promptLength: prompt.length,
      creditsRequired: creditsRequired
    });

    // 🔧 Initialize SDK
    console.log('🔧 Initializing Google GenAI SDK...');
    const client = new GoogleGenAI({ apiKey });

    // 📸 Process first image
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

    // 🎨 Build request parameters
    const requestParams = {
      model: selectedModel,
      prompt: prompt,
      image: {
        imageBytes: firstImageBase64,  // base64 string
        mimeType: 'image/jpeg'
      },
      config: {
        aspectRatio: '9:16',
        durationSeconds: duration,  // 5 or 8
        personGeneration: 'allow_adult',
        resolution: '720p'
      }
    };

    // 📸 Add second image for Veo 3.1 (lastFrame)
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
      
      console.log(`🎬 Mode: Veo 3.1 Fast Frame Interpolation (${duration}초)`);
    } else {
      console.log(`🎬 Mode: Veo 3 Fast Image-to-Video (${duration}초)`);
    }

    // ▶️  Generate video
    console.log('▶️  Calling generateVideos API...');
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

    // 🎯 Return operation ID immediately (avoid timeout)
    // Client will poll for completion using gemini-video-status endpoint
    const responseTime = Date.now() - startTime;
    
    console.log('═══════════════════════════════════════════════════════════');
    console.log('✅ Video Generation Started Successfully');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📊 Response:', {
      operationId: operation.name.substring(0, 50) + '...',
      duration: `${duration}초`,
      creditsUsed: creditsRequired,
      responseTime: `${responseTime}ms`
    });

    return {
      statusCode: 202,  // Accepted
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
    
    // Handle specific error cases
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
    }
    
    return {
      statusCode: statusCode,
      headers,
      body: JSON.stringify({
        success: false,
        error: errorMessage,
        details: error.stack
      })
    };
  }
};


// ═══════════════════════════════════════════════════════════
// FILE 2: netlify/functions/video-download-proxy.js
// ═══════════════════════════════════════════════════════════
/**
 * Netlify Function: Gemini Video Download Proxy
 * Gemini API의 인증이 필요한 비디오 URL을 프록시하여 다운로드 가능하게 만듦
 * 
 * 환경변수:
 * - GEMINI_API_KEY (필수)
 */

exports.config = {
  timeout: 60  // 1분
};

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Accept',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
  };

  // CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: {
        ...headers,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    // URL 파라미터에서 비디오 URL 가져오기
    const videoUrl = event.queryStringParameters?.url;

    if (!videoUrl) {
      throw new Error('Video URL parameter is required');
    }

    console.log('📥 비디오 다운로드 요청:', {
      url: videoUrl.substring(0, 80) + '...',
      userAgent: event.headers['user-agent']
    });

    // Gemini API Key 가져오기
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY not configured');
    }

    // Gemini API로 비디오 다운로드 (인증 포함)
    const response = await fetch(videoUrl, {
      method: 'GET',
      headers: {
        'x-goog-api-key': apiKey,
      }
    });

    if (!response.ok) {
      console.error('❌ Gemini API 응답 오류:', {
        status: response.status,
        statusText: response.statusText
      });
      throw new Error(`Failed to download video: ${response.status} ${response.statusText}`);
    }

    // 비디오 데이터를 Buffer로 읽기
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    console.log('✅ 비디오 다운로드 성공:', {
      size: buffer.length,
      sizeMB: (buffer.length / 1024 / 1024).toFixed(2) + 'MB'
    });

    // Base64로 인코딩하여 반환
    return {
      statusCode: 200,
      headers: {
        ...headers,
        'Content-Type': 'video/mp4',
        'Content-Length': buffer.length.toString(),
        'Cache-Control': 'public, max-age=3600'
      },
      body: buffer.toString('base64'),
      isBase64Encoded: true
    };

  } catch (error) {
    console.error('❌ 비디오 다운로드 프록시 오류:', error);
    
    let statusCode = 500;
    let errorMessage = 'Video download failed';

    if (error.message?.includes('not configured')) {
      statusCode = 500;
      errorMessage = 'Server configuration error';
    } else if (error.message?.includes('required')) {
      statusCode = 400;
      errorMessage = 'Missing video URL parameter';
    } else if (error.message?.includes('Failed to download')) {
      statusCode = 502;
      errorMessage = 'Failed to fetch video from source';
    }

    return {
      statusCode,
      headers: {
        ...headers,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        error: errorMessage,
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      })
    };
  }
};
