/**
 * Netlify Function: Check Veo Video Generation Status
 * ✅ 4초/6초/8초 지원 + 응답 구조 디버깅
 */

exports.config = {
  timeout: 60
};

exports.handler = async (event, context) => {
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
    const { operationId, duration } = JSON.parse(event.body);

    if (!operationId) {
      throw new Error('operationId is required');
    }

    const validDurations = [4, 6, 8];
    if (duration && !validDurations.includes(duration)) {
      console.warn(`⚠️ Invalid duration: ${duration}, using fallback 6`);
    }

    const apiKey = process.env.GEMINI_VIDEO_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('API key not configured');
    }

    console.log('🔍 Checking operation status:', {
      operationId: operationId.substring(0, 50) + '...',
      duration: duration ? `${duration}초` : 'unknown',
      apiKeySource: process.env.GEMINI_VIDEO_API_KEY ? 'GEMINI_VIDEO_API_KEY' : 'GEMINI_API_KEY (fallback)'
    });

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
      const errorText = await response.text();
      console.error('❌ API failed:', {
        status: response.status,
        body: errorText
      });
      throw new Error(`API failed: ${response.status}`);
    }

    const operation = await response.json();

    if (operation.error) {
      console.error('❌ Operation error:', operation.error);
      throw new Error(operation.error.message || 'Generation failed');
    }

    // Still processing
    if (!operation.done) {
      console.log('⏳ Still processing...');
      
      let progressMessage = '영상 생성 중...';
      if (duration === 4) {
        progressMessage = '4초 영상 생성 중... (~3분 소요)';
      } else if (duration === 6) {
        progressMessage = '6초 영상 생성 중... (~4분 소요)';
      } else if (duration === 8) {
        progressMessage = '8초 영상 생성 중... (~5분 소요)';
      }
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          status: 'processing',
          done: false,
          message: progressMessage,
          duration: duration || 6
        })
      };
    }

    // ✅ Completed - 전체 응답 구조 로깅
    console.log('✅ Operation completed');
    console.log('📦 Full operation response:', JSON.stringify(operation, null, 2));
    
    // 다양한 경로에서 비디오 URL 찾기 시도
    let videoUrl = null;
    
    // 경로 1: operation.response.generatedSamples[0]
    const samples = operation.response?.generatedSamples;
    if (samples && Array.isArray(samples) && samples.length > 0) {
      videoUrl = samples[0].video?.uri || samples[0].uri || samples[0].url;
      console.log('✅ Found video in generatedSamples:', videoUrl?.substring(0, 60));
    }
    
    // 경로 2: operation.response.generateVideoResponse.generatedSamples
    if (!videoUrl) {
      const videoResponse = operation.response?.generateVideoResponse;
      const altSamples = videoResponse?.generatedSamples;
      if (altSamples && Array.isArray(altSamples) && altSamples.length > 0) {
        videoUrl = altSamples[0].video?.uri || altSamples[0].uri || altSamples[0].url;
        console.log('✅ Found video in generateVideoResponse:', videoUrl?.substring(0, 60));
      }
    }
    
    // 경로 3: operation.response.video
    if (!videoUrl) {
      videoUrl = operation.response?.video?.uri || operation.response?.video;
      if (videoUrl) {
        console.log('✅ Found video in response.video:', videoUrl.substring(0, 60));
      }
    }
    
    // 경로 4: operation.response.result
    if (!videoUrl) {
      videoUrl = operation.response?.result?.uri || operation.response?.result?.url;
      if (videoUrl) {
        console.log('✅ Found video in response.result:', videoUrl.substring(0, 60));
      }
    }

    // 경로 5: 최상위 response가 문자열인 경우
    if (!videoUrl && typeof operation.response === 'string') {
      videoUrl = operation.response;
      console.log('✅ response is string (video URL):', videoUrl.substring(0, 60));
    }

    if (!videoUrl) {
      console.error('❌ No video URL found in operation response');
      console.error('Available keys in operation:', Object.keys(operation));
      console.error('Available keys in operation.response:', Object.keys(operation.response || {}));
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
        duration: duration || 6,
        message: `${duration || 6}초 영상 생성 완료!`
      })
    };

  } catch (error) {
    console.error('❌ Status check failed:', error.message);
    console.error('Stack:', error.stack);
    
    let errorMessage = error.message || 'Status check failed';
    let statusCode = 500;

    if (error.message && error.message.includes('Operation not found')) {
      errorMessage = 'Operation ID가 잘못되었거나 만료되었습니다.';
      statusCode = 404;
    } else if (error.message && (error.message.includes('429') || error.message.includes('rate limit'))) {
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
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      })
    };
  }
};
