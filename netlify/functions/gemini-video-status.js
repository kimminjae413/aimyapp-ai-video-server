/**
 * Netlify Function: Check Veo Video Generation Status
 * Polls operation status and returns video URL when complete
 * ✅ Direct API call (SDK operations.get() has issues)
 */

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

    // ✅ 직접 REST API 호출 (SDK 우회)
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/${operationId}`;
    
    console.log('📡 Calling API:', {
      url: apiUrl.substring(0, 80) + '...',
      method: 'GET'
    });

    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'x-goog-api-key': apiKey,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ API call failed:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText
      });
      
      if (response.status === 404) {
        throw new Error('Operation not found');
      } else if (response.status === 429) {
        throw new Error('API rate limit exceeded');
      } else {
        throw new Error(`API call failed: ${response.status} ${response.statusText}`);
      }
    }

    const operation = await response.json();

    if (!operation) {
      throw new Error('Empty operation response');
    }

    console.log('📊 Operation status:', {
      done: operation.done,
      hasResponse: !!operation.response,
      hasError: !!operation.error,
      metadata: operation.metadata ? 'present' : 'none'
    });

    // Check for errors
    if (operation.error) {
      console.error('❌ Operation failed with error:', operation.error);
      throw new Error(operation.error.message || 'Video generation failed');
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
    console.log('✅ Operation completed, extracting video...');
    
    if (!operation.response) {
      console.error('❌ No response in completed operation:', operation);
      throw new Error('No response in completed operation');
    }

    // ✅ 응답 구조 확인: generateVideoResponse 사용
    const videoResponse = operation.response.generateVideoResponse || operation.response;
    const generatedVideos = videoResponse.generatedVideos;
    
    if (!generatedVideos || !Array.isArray(generatedVideos) || generatedVideos.length === 0) {
      console.error('❌ No generated videos:', {
        hasResponse: !!operation.response,
        responseKeys: operation.response ? Object.keys(operation.response) : [],
        hasVideoResponse: !!videoResponse,
        videoResponseKeys: videoResponse ? Object.keys(videoResponse) : [],
        generatedVideos: generatedVideos
      });
      throw new Error('No generated videos in response');
    }

    const firstVideo = generatedVideos[0];
    const videoUrl = firstVideo.video?.uri || firstVideo.uri;

    if (!videoUrl) {
      console.error('❌ No video URL in first video:', firstVideo);
      throw new Error('Video URL not found in response');
    }

    console.log('📦 Video ready:', {
      videoUrl: videoUrl.substring(0, 60) + '...',
      duration: duration || 'unknown',
      videoCount: generatedVideos.length
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        status: 'completed',
        done: true,
        videoUrl: videoUrl,
        duration: duration || 8,
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
    } else if (error.message && (error.message.includes('429') || error.message.includes('rate limit'))) {
      errorMessage = 'API 요청 한도 초과. 잠시 후 다시 시도해주세요.';
      statusCode = 429;
    } else if (error.message && error.message.includes('API call failed')) {
      errorMessage = 'Gemini API 호출 실패. 잠시 후 다시 시도해주세요.';
      statusCode = 503;
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
