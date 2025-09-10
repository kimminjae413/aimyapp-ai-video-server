// netlify/functions/video-download-proxy.js - 개선된 버전
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

    console.log('🎥 Video proxy request:', {
      url: videoUrl,
      userAgent: event.headers['user-agent'],
      origin: event.headers.origin
    });

    // Range 헤더 지원 (스트리밍용)
    const rangeHeader = event.headers.range;
    const fetchHeaders = {
      'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1'
    };

    // Range 요청이 있으면 전달
    if (rangeHeader) {
      fetchHeaders['Range'] = rangeHeader;
    }

    // 원본 비디오 fetch
    const response = await fetch(videoUrl, {
      method: 'GET',
      headers: fetchHeaders
    });

    if (!response.ok) {
      console.error('❌ Video fetch failed:', response.status, response.statusText);
      throw new Error(`Failed to fetch video: ${response.status} ${response.statusText}`);
    }

    console.log('✅ Video fetch successful:', {
      status: response.status,
      contentType: response.headers.get('content-type'),
      contentLength: response.headers.get('content-length')
    });

    // 응답 헤더 구성
    const responseHeaders = {
      ...corsHeaders,
      'Content-Type': response.headers.get('content-type') || 'video/mp4',
      'Cache-Control': 'public, max-age=3600', // 1시간 캐시
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

    // 비디오 데이터를 스트림으로 처리 (base64 인코딩 제거!)
    const videoArrayBuffer = await response.arrayBuffer();
    
    console.log('📊 Proxy response:', {
      status: response.status,
      size: videoArrayBuffer.byteLength,
      headers: Object.keys(responseHeaders)
    });

    return {
      statusCode: response.status,
      headers: responseHeaders,
      body: Buffer.from(videoArrayBuffer).toString('base64'),
      isBase64Encoded: true
    };

  } catch (error) {
    console.error('❌ Video proxy error:', {
      message: error.message,
      stack: error.stack,
      url: event.queryStringParameters?.url
    });
    
    // 에러 타입별 상태 코드
    let statusCode = 500;
    let errorMessage = 'Internal server error';
    
    if (error.message.includes('Failed to fetch')) {
      statusCode = 502;
      errorMessage = 'Bad gateway: Unable to fetch video from source';
    } else if (error.message.includes('timeout')) {
      statusCode = 504;
      errorMessage = 'Gateway timeout: Video source is too slow';
    }
    
    return {
      statusCode,
      headers: corsHeaders,
      body: JSON.stringify({ 
        error: errorMessage,
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
        timestamp: new Date().toISOString(),
        requestId: context.awsRequestId
      })
    };
  }
};
