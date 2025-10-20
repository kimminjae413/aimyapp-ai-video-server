/**
 * Netlify Function: Check Veo Video Generation Status (Veo 2)
 * ✅ 극도로 상세한 디버깅 버전
 */

exports.config = {
  timeout: 60
};

exports.handler = async (event, context) => {
  const requestId = Math.random().toString(36).substring(7);
  
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
    console.log(`[${requestId}] 📥 폴링 요청:`, { 
      operationId: operationId?.substring(0, 50) + '...', 
      duration 
    });

    if (!operationId) {
      throw new Error('operationId is required');
    }

    const apiKey = process.env.GEMINI_VIDEO_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('API key not configured');
    }

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

    console.log(`[${requestId}] 📡 API 응답:`, response.status, response.statusText);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[${requestId}] ❌ API 에러:`, errorText);
      throw new Error(`API failed: ${response.status}`);
    }

    const operation = await response.json();
    
    // ✅ 핵심: 전체 응답 구조 로깅
    console.log(`[${requestId}] 📦 Operation 구조:`, JSON.stringify({
      hasError: !!operation.error,
      done: operation.done,
      hasResponse: !!operation.response,
      responseKeys: operation.response ? Object.keys(operation.response) : [],
      fullOperation: operation
    }, null, 2));

    if (operation.error) {
      console.error(`[${requestId}] ❌ Operation error:`, operation.error);
      throw new Error(operation.error.message || 'Generation failed');
    }

    // Still processing
    if (!operation.done) {
      console.log(`[${requestId}] ⏳ 아직 처리 중...`);
      
      let progressMessage = '영상 생성 중...';
      if (duration === 5) {
        progressMessage = '5초 영상 생성 중... (~3-4분 소요)';
      } else if (duration === 8) {
        progressMessage = '8초 영상 생성 중... (~4-5분 소요)';
      }
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          status: 'processing',
          done: false,
          message: progressMessage,
          duration: duration || 5
        })
      };
    }

    // ✅ Operation completed
    console.log(`[${requestId}] ✅ Operation 완료됨`);
    
    const videoResponse = operation.response?.generateVideoResponse;
    
    console.log(`[${requestId}] 📦 videoResponse 구조:`, JSON.stringify({
      hasVideoResponse: !!videoResponse,
      videoResponseKeys: videoResponse ? Object.keys(videoResponse) : [],
      raiMediaFilteredCount: videoResponse?.raiMediaFilteredCount,
      hasGeneratedSamples: !!videoResponse?.generatedSamples,
      samplesLength: videoResponse?.generatedSamples?.length,
      fullVideoResponse: videoResponse
    }, null, 2));
    
    // ⚠️ RAI 필터 체크
    if (videoResponse?.raiMediaFilteredCount > 0) {
      const reasons = videoResponse.raiMediaFilteredReasons || [];
      console.warn(`[${requestId}] ⚠️ RAI 필터 감지:`, reasons);
      
      let errorMessage = '이미지가 Google의 안전 정책에 의해 차단되었습니다.';
      
      if (reasons.length > 0) {
        const reason = reasons[0].toLowerCase();
        
        if (reason.includes('children') || reason.includes('minor')) {
          errorMessage = '⚠️ 미성년자로 보이는 인물이 감지되어 영상 생성이 제한되었습니다.\n\n성인 인물의 이미지를 사용해주세요.';
        } else if (reason.includes('celebrity') || reason.includes('likeness')) {
          errorMessage = '⚠️ 유명인 또는 유명인과 유사한 인물이 감지되었습니다.\n\n일반인의 이미지를 사용해주세요.';
        } else if (reason.includes('violence') || reason.includes('harmful')) {
          errorMessage = '⚠️ 부적절한 콘텐츠가 감지되었습니다.\n\n다른 이미지를 사용해주세요.';
        } else if (reason.includes('sexual')) {
          errorMessage = '⚠️ 부적절한 콘텐츠가 감지되었습니다.\n\n다른 이미지를 사용해주세요.';
        } else {
          errorMessage = `⚠️ ${reasons[0]}`;
        }
      }
      
      console.error(`[${requestId}] 🚫 RAI 필터로 차단됨:`, errorMessage);
      
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          status: 'filtered',
          error: errorMessage,
          raiFiltered: true,
          raiReasons: reasons
        })
      };
    }
    
    // ✅ 정상 완료 - 비디오 URL 찾기
    const samples = videoResponse?.generatedSamples;
    
    if (!samples || !Array.isArray(samples) || samples.length === 0) {
      console.error(`[${requestId}] ❌ generatedSamples 없음`);
      console.error(`[${requestId}] videoResponse 전체:`, JSON.stringify(videoResponse, null, 2));
      
      // ⚠️ 여기서 400 반환하지 말고 더 자세히 확인
      console.error(`[${requestId}] ⚠️ 이것은 RAI 필터가 아닐 수도 있음 - API 응답 구조 확인 필요`);
      
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          status: 'error',
          error: '⚠️ API 응답에 영상 데이터가 없습니다. Netlify Functions 로그를 확인해주세요.',
          debug: {
            hasVideoResponse: !!videoResponse,
            videoResponseKeys: videoResponse ? Object.keys(videoResponse) : [],
            raiFilteredCount: videoResponse?.raiMediaFilteredCount || 0
          }
        })
      };
    }

    console.log(`[${requestId}] 📦 samples[0] 구조:`, JSON.stringify(samples[0], null, 2));

    const videoUrl = samples[0].video?.uri || samples[0].uri || samples[0].url;

    if (!videoUrl) {
      console.error(`[${requestId}] ❌ 비디오 URL을 찾을 수 없음`);
      console.error(`[${requestId}] sample[0]:`, JSON.stringify(samples[0], null, 2));
      
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          success: false,
          status: 'error',
          error: '영상 URL을 찾을 수 없습니다. Netlify Functions 로그를 확인해주세요.',
          debug: {
            sampleKeys: Object.keys(samples[0])
          }
        })
      };
    }

    console.log(`[${requestId}] 🎉 비디오 URL 찾음:`, videoUrl.substring(0, 60) + '...');

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        status: 'completed',
        done: true,
        videoUrl: videoUrl,
        duration: duration || 5,
        message: `${duration || 5}초 영상 생성 완료!`
      })
    };

  } catch (error) {
    console.error(`[${requestId}] ❌ 에러 발생:`, error.message);
    console.error(`[${requestId}] Stack:`, error.stack);
    
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
        error: errorMessage
      })
    };
  }
};
