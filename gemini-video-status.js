/**
 * Netlify Function: Check Veo Video Generation Status
 * Polls operation status and returns video URL when complete
 * ✅ Supports 5s and 8s durations (API 제한: 4~8초)
 */
const { GoogleGenAI } = require('@google/genai');

exports.config = {
  timeout: 60  // 1분
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
    const { operationId, duration } = JSON.parse(event.body);

    if (!operationId) {
      throw new Error('operationId is required');
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY not configured');
    }

    console.log('🔍 Checking operation status:', {
      operationId: operationId.substring(0, 50) + '...',
      duration: duration ? `${duration}초` : 'unknown'
    });

    const client = new GoogleGenAI({ apiKey });

    // Get operation status
    const operation = await client.operations.get({
      name: operationId
    });

    if (!operation) {
      throw new Error('Operation not found');
    }

    // Still processing
    if (!operation.done) {
      console.log('⏳ Still processing...');
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          status: 'processing',
          done: false,
          message: duration ? `${duration}초 영상 생성 중...` : '영상 생성 중...'
        })
      };
    }

    // Completed - extract video URL
    console.log('✅ Operation completed');
    
    const generatedVideos = operation.response?.generatedVideos;
    
    if (!generatedVideos || generatedVideos.length === 0) {
      throw new Error('No generated videos in response');
    }

    const videoUrl = generatedVideos[0].video?.uri;

    if (!videoUrl) {
      throw new Error('Video URL not found in response');
    }

    console.log('📦 Video ready:', {
      videoUrl: videoUrl.substring(0, 60) + '...',
      duration: duration || 'unknown'
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        status: 'completed',
        done: true,
        videoUrl: videoUrl,
        duration: duration || 8,  // ✅ fallback to 8s (API 최대값)
        message: '영상 생성 완료!'
      })
    };

  } catch (error) {
    console.error('❌ Status check failed:', error.message);
    console.error('Stack:', error.stack);
    
    // Handle specific error cases
    let errorMessage = error.message || 'Status check failed';
    let statusCode = 500;

    if (error.message && error.message.includes('Operation not found')) {
      errorMessage = 'Operation ID가 잘못되었거나 만료되었습니다.';
      statusCode = 404;
    } else if (error.message && error.message.includes('429')) {
      errorMessage = 'API 요청 한도 초과. 잠시 후 다시 시도해주세요.';
      statusCode = 429;
    }
    
    return {
      statusCode: statusCode,
      headers,
      body: JSON.stringify({
        success: false,
        status: 'error',
        error: errorMessage,
        details: error.stack
      })
    };
  }
};
