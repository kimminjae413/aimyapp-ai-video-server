/**
 * Netlify Function: Check Veo Video Generation Status
 * ✅ 완전한 RAI 필터 처리 (미성년자, 유명인 등)
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

    const apiKey = process.env.GEMINI_VIDEO_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('API key not configured');
    }

    console.log('🔍 Checking operation status:', {
      operationId: operationId.substring(0, 50) + '...',
      duration: duration ? `${duration}초` : 'unknown'
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
      throw new Error(`API failed: ${response.status}`);
    }

    const operation = await response.json();

    if (operation.error) {
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

    // ✅ Operation completed
    console.log('✅ Operation completed');
    console.log('📦 Full operation response:', JSON.stringify(operation, null, 2));
    
    const videoResponse = operation.response?.generateVideoResponse;
    
    // ⚠️ RAI 필터 체크 - 모든 케이스 처리
    if (videoResponse?.raiMediaFilteredCount > 0) {
      const reasons = videoResponse.raiMediaFilteredReasons || [];
      console.warn('⚠️ RAI 필터 감지:', reasons);
      
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
          // 원본 메시지 그대로 전달
          errorMessage = `⚠️ ${reasons[0]}`;
        }
      }
      
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
      console.error('❌ No samples - might be RAI filtered without explicit flag');
      console.error('Full videoResponse:', JSON.stringify(videoResponse, null, 2));
      
      // generatedSamples가 없으면 RAI 필터일 가능성이 높음
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          status: 'filtered',
          error: '⚠️ 이미지가 Google의 안전 정책에 의해 차단되었을 수 있습니다.\n\n• 성인 인물의 이미지를 사용해주세요\n• 일반인의 이미지를 사용해주세요\n• 부적절한 콘텐츠가 포함되지 않았는지 확인해주세요',
          raiFiltered: true
        })
      };
    }

    const videoUrl = samples[0].video?.uri || samples[0].uri || samples[0].url;

    if (!videoUrl) {
      console.error('❌ No URL in sample:', samples[0]);
      throw new Error('영상 URL을 찾을 수 없습니다.');
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
        error: errorMessage
      })
    };
  }
};
