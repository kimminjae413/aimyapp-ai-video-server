// netlify/functions/video-download-proxy.js
exports.handler = async (event, context) => {
  // OPTIONS 요청 처리
  if (event.httpMethod === 'OPTIONS') {
    return { 
      statusCode: 200, 
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, OPTIONS'
      },
      body: '' 
    };
  }

  try {
    // URL 파라미터에서 원본 비디오 URL 가져오기
    const videoUrl = event.queryStringParameters?.url;
    
    if (!videoUrl) {
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ error: 'Video URL parameter is required' })
      };
    }

    console.log('Proxying video download:', videoUrl);

    // 원본 비디오 가져오기
    const response = await fetch(videoUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch video: ${response.status} ${response.statusText}`);
    }

    // 비디오 데이터를 스트림으로 가져오기
    const videoBuffer = await response.arrayBuffer();
    
    // 파일명 생성
    const timestamp = Date.now();
    const filename = `hairgator-video-${timestamp}.mp4`;

    // iOS에서 다운로드 가능하도록 적절한 헤더 설정
    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'video/mp4',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': videoBuffer.byteLength.toString(),
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
      // iOS Safari에서 비디오 저장 옵션을 활성화하기 위한 추가 헤더
      'X-Content-Type-Options': 'nosniff',
      'Accept-Ranges': 'bytes'
    };

    console.log(`Video proxy successful: ${videoBuffer.byteLength} bytes`);

    return {
      statusCode: 200,
      headers,
      body: Buffer.from(videoBuffer).toString('base64'),
      isBase64Encoded: true
    };

  } catch (error) {
    console.error('Video proxy error:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        error: 'Failed to proxy video download',
        message: error.message 
      })
    };
  }
};
