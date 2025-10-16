/**
 * Netlify Function: Check Veo Video Generation Status
 * ✅ generatedSamples 사용
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
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const { operationId, duration } = JSON.parse(event.body);

    if (!operationId) throw new Error('operationId is required');

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY not configured');

    console.log('🔍 Checking:', operationId.substring(0, 50));

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/${operationId}`,
      {
        method: 'GET',
        headers: { 'x-goog-api-key': apiKey, 'Content-Type': 'application/json' }
      }
    );

    if (!response.ok) throw new Error(`API failed: ${response.status}`);

    const operation = await response.json();

    if (operation.error) throw new Error(operation.error.message || 'Generation failed');

    if (!operation.done) {
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

    // ✅ Completed - extract video from generatedSamples
    console.log('✅ Completed');
    
    const videoResponse = operation.response?.generateVideoResponse || operation.response;
    const samples = videoResponse?.generatedSamples;
    
    if (!samples || !Array.isArray(samples) || samples.length === 0) {
      console.error('❌ No samples:', { 
        hasResponse: !!operation.response,
        hasVideoResponse: !!videoResponse,
        samples 
      });
      throw new Error('No generated videos');
    }

    const videoUrl = samples[0].video?.uri || samples[0].uri || samples[0].url;

    if (!videoUrl) {
      console.error('❌ No URL:', samples[0]);
      throw new Error('Video URL not found');
    }

    console.log('📦 Video ready:', videoUrl.substring(0, 60));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        status: 'completed',
        done: true,
        videoUrl,
        duration: duration || 8,
        message: '영상 생성 완료!'
      })
    };

  } catch (error) {
    console.error('❌ Failed:', error.message);
    
    let errorMessage = error.message || 'Status check failed';
    let statusCode = 500;

    if (error.message?.includes('Operation not found')) {
      errorMessage = 'Operation ID가 잘못되었거나 만료되었습니다.';
      statusCode = 404;
    } else if (error.message?.includes('429') || error.message?.includes('rate limit')) {
      errorMessage = 'API 요청 한도 초과. 잠시 후 다시 시도해주세요.';
      statusCode = 429;
    }
    
    return {
      statusCode,
      headers,
      body: JSON.stringify({ success: false, status: 'error', error: errorMessage })
    };
  }
};
