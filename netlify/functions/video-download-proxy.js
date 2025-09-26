// netlify/functions/video-download-proxy.js - 클링 URL 최적화 버전
exports.handler = async (event, context) => {
  // CORS 헤더
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Range',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Accept-Ranges'
  };
  
  // OPTIONS 요청 처리 (CORS preflight)
  if (event.httpMethod === 'OPTIONS') {
    return { 
      statusCode: 200, 
      headers: corsHeaders,
      body: '' 
    };
  }

  // GET 요청만 허용
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Method not allowed. Use GET.' })
    };
  }

  try {
    // URL 파라미터에서 원본 비디오 URL 가져오기
    const videoUrl = event.queryStringParameters?.url;
    
    if (!videoUrl) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ 
          error: 'Video URL parameter is required',
          usage: 'GET /.netlify/functions/video-download-proxy?url=<encoded_video_url>'
        })
      };
    }

    console.log('🎥 [Download Proxy] 요청 시작:', {
      url: videoUrl.substring(0, 80) + '...',
      userAgent: event.headers['user-agent'],
      origin: event.headers.origin
    });

    // 🆕 클링 URL 검증 및 복구
    let workingUrl = videoUrl;
    
    // URL이 잘려있는 경우 복구 시도
    if (videoUrl.includes('...[truncated]')) {
      console.log('🔧 [Download Proxy] 잘린 URL 감지, 복구 시도...');
      workingUrl = videoUrl.replace('...[truncated]', '');
      if (!workingUrl.endsWith('.mp4')) {
        workingUrl += '.mp4';
      }
    }

    // Range 헤더 지원 (스트리밍용)
    const rangeHeader = event.headers.range;
    const fetchHeaders = {
      'User-Agent': 'Mozilla/5.0 (compatible; VideoDownloadProxy/1.0)',
      'Accept': 'video/*',
      'Cache-Control': 'no-cache'
    };

    // Range 요청이 있으면 전달
    if (rangeHeader) {
      fetchHeaders['Range'] = rangeHeader;
      console.log('📊 [Download Proxy] Range 요청:', rangeHeader);
    }

    // 🆕 먼저 HEAD 요청으로 URL 검증
    try {
      const headResponse = await fetch(workingUrl, {
        method: 'HEAD',
        headers: {
          'User-Agent': fetchHeaders['User-Agent']
        }
      });

      if (!headResponse.ok) {
        console.warn('⚠️ [Download Proxy] HEAD 요청 실패:', headResponse.status);
        
        // 클링 URL의 경우 여러 패턴 시도
        if (workingUrl.includes('kling')) {
          const urlParts = workingUrl.split('/');
          const possibleVideoId = urlParts.find(part => part.includes('-') && part.length > 30);
          
          if (possibleVideoId) {
            const alternativeUrls = [
              `https://v15-kling.klingai.com/bs2/upload-ylab-stunt-sgp/se/stream_lake_m2v_img2video_v21_std_v36_v2/${possibleVideoId}_raw_video.mp4`,
              `https://v15-kling.klingai.com/bs2/upload/${possibleVideoId}.mp4`
            ];
            
            for (const altUrl of alternativeUrls) {
              console.log('🔄 [Download Proxy] 대체 URL 시도:', altUrl.substring(0, 80) + '...');
              const altHeadResponse = await fetch(altUrl, { method: 'HEAD', headers: { 'User-Agent': fetchHeaders['User-Agent'] } });
              
              if (altHeadResponse.ok) {
                console.log('✅ [Download Proxy] 대체 URL 성공');
                workingUrl = altUrl;
                break;
              }
            }
          }
        }
      } else {
        console.log('✅ [Download Proxy] URL 검증 성공');
      }
    } catch (headError) {
      console.warn('⚠️ [Download Proxy] HEAD 요청 실패:', headError.message);
      // HEAD 실패해도 GET 시도 계속
    }

    // 원본 비디오 fetch
    const response = await fetch(workingUrl, {
      method: 'GET',
      headers: fetchHeaders
    });

    if (!response.ok) {
      console.error('❌ [Download Proxy] Video fetch failed:', response.status, response.statusText);
      
      // 404인 경우 상세 오류 정보 제공
      if (response.status === 404) {
        return {
          statusCode: 404,
          headers: corsHeaders,
          body: JSON.stringify({ 
            error: 'Video not found',
            details: 'The video URL may have expired or been moved',
            originalUrl: videoUrl,
            attemptedUrl: workingUrl,
            suggestion: 'Try generating the video again',
            timestamp: new Date().toISOString()
          })
        };
      }
      
      throw new Error(`Failed to fetch video: ${response.status} ${response.statusText}`);
    }

    console.log('✅ [Download Proxy] Video fetch successful:', {
      status: response.status,
      contentType: response.headers.get('content-type'),
      contentLength: response.headers.get('content-length')
    });

    // 응답 헤더 구성
    const responseHeaders = {
      ...corsHeaders,
      'Content-Type': response.headers.get('content-type') || 'video/mp4',
      'Cache-Control': 'public, max-age=1800', // 30분 캐시 (클링 URL 특성상 짧게)
      'Accept-Ranges': 'bytes'
    };

    // Content-Length 전달
    const contentLength = response.headers.get('content-length');
    if (contentLength) {
      responseHeaders['Content-Length'] = contentLength;
    }

    // Range 응답 처리
    if (response.status === 206) {
      responseHeaders['Content-Range'] = response.headers.get('content-range') || '';
    }

    // iOS Safari를 위한 추가 헤더
    const userAgent = event.headers['user-agent'] || '';
    if (userAgent.includes('iPhone') || userAgent.includes('iPad')) {
      responseHeaders['Content-Disposition'] = 'attachment; filename="hairgator-video.mp4"';
      responseHeaders['X-Content-Type-Options'] = 'nosniff';
    }

    // 비디오 데이터 처리
    const videoArrayBuffer = await response.arrayBuffer();
    
    console.log('📊 [Download Proxy] Response:', {
      status: response.status,
      size: videoArrayBuffer.byteLength,
      sizeKB: Math.round(videoArrayBuffer.byteLength / 1024),
      headers: Object.keys(responseHeaders)
    });

    return {
      statusCode: response.status,
      headers: responseHeaders,
      body: Buffer.from(videoArrayBuffer).toString('base64'),
      isBase64Encoded: true
    };

  } catch (error) {
    console.error('❌ [Download Proxy] Error:', {
      message: error.message,
      stack: error.stack,
      url: event.queryStringParameters?.url
    });
    
    // 에러 타입별 상세 응답
    let statusCode = 500;
    let errorMessage = 'Internal server error';
    let errorDetails = {};
    
    if (error.message.includes('Failed to fetch')) {
      statusCode = 502;
      errorMessage = 'Bad gateway: Unable to fetch video from source';
      errorDetails = {
        reason: 'Source server unreachable',
        suggestion: 'The video may have been moved or deleted'
      };
    } else if (error.message.includes('timeout')) {
      statusCode = 504;
      errorMessage = 'Gateway timeout: Video source is too slow';
      errorDetails = {
        reason: 'Download timeout',
        suggestion: 'Try again in a few moments'
      };
    } else if (error.message.includes('404')) {
      statusCode = 404;
      errorMessage = 'Video not found';
      errorDetails = {
        reason: 'Video URL expired or invalid',
        suggestion: 'Generate the video again'
      };
    }
    
    return {
      statusCode,
      headers: corsHeaders,
      body: JSON.stringify({ 
        error: errorMessage,
        details: errorDetails,
        originalUrl: event.queryStringParameters?.url,
        timestamp: new Date().toISOString(),
        requestId: context.awsRequestId,
        developmentInfo: process.env.NODE_ENV === 'development' ? error.message : undefined
      })
    };
  }
};
