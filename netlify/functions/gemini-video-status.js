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

    // ✅ 올바른 클라이언트 초기화 방식
    const client = new GoogleGenAI({ 
      apiKey: apiKey,
      // baseUrl 명시 (선택사항)
      baseUrl: 'https://generativelanguage.googleapis.com'
    });

    console.log('✅ Client initialized:', {
      hasOperations: !!client.operations,
      operationsType: typeof client.operations
    });

    // ✅ operation 상태 확인 - 올바른 방식
    let operation;
    try {
      // Method 1: client.operations.get() 사용
      if (client.operations && typeof client.operations.get === 'function') {
        operation = await client.operations.get({ name: operationId });
      } 
      // Method 2: 직접 API 호출 (폴백)
      else {
        console.warn('⚠️ operations.get() not available, using direct API call');
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/${operationId}`,
          {
            method: 'GET',
            headers: {
              'x-goog-api-key': apiKey,
              'Content-Type': 'application/json'
            }
          }
        );

        if (!response.ok) {
          throw new Error(`API call failed: ${response.status}`);
        }

        operation = await response.json();
      }
    } catch (getError) {
      console.error('❌ Failed to get operation:', getError);
      throw getError;
    }

    if (!operation) {
      throw new Error('Operation not found');
    }

    console.log('📊 Operation status:', {
      done: operation.done,
      hasResponse: !!operation.response,
      hasError: !!operation.error
    });

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

    // Check for errors
    if (operation.error) {
      console.error('❌ Operation failed:', operation.error);
      throw new Error(operation.error.message || 'Video generation failed');
    }

    // Completed - extract video URL
    console.log('✅ Operation completed');
    
    const generatedVideos = operation.response?.generatedVideos;
    
    if (!generatedVideos || generatedVideos.length === 0) {
      console.error('❌ No videos in response:', operation.response);
      throw new Error('No generated videos in response');
    }

    const videoUrl = generatedVideos[0].video?.uri;

    if (!videoUrl) {
      console.error('❌ No video URL:', generatedVideos[0]);
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
    } else if (error.message && error.message.includes('API call failed')) {
      errorMessage = 'Gemini API 호출 실패. API 키를 확인해주세요.';
      statusCode = 500;
    }
    
    return {
      statusCode: statusCode,
      headers,
      body: JSON.stringify({
        success: false,
        status: 'error',
        error: errorMessage,
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      })
    };
  }
};
