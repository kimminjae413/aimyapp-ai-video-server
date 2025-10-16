/**
 * Netlify Function: Gemini Video Download Proxy
 * Gemini API의 인증이 필요한 비디오 URL을 프록시하여 다운로드 가능하게 만듦
 * 
 * 환경변수:
 * - GEMINI_API_KEY (필수)
 */

exports.config = {
  timeout: 60  // 1분
};

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Accept',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
  };

  // CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: {
        ...headers,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    // URL 파라미터에서 비디오 URL 가져오기
    const videoUrl = event.queryStringParameters?.url;

    if (!videoUrl) {
      throw new Error('Video URL parameter is required');
    }

    console.log('📥 비디오 다운로드 요청:', {
      url: videoUrl.substring(0, 80) + '...',
      userAgent: event.headers['user-agent']
    });

    // Gemini API Key 가져오기
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY not configured');
    }

    // Gemini API로 비디오 다운로드 (인증 포함)
    const response = await fetch(videoUrl, {
      method: 'GET',
      headers: {
        'x-goog-api-key': apiKey,
      }
    });

    if (!response.ok) {
      console.error('❌ Gemini API 응답 오류:', {
        status: response.status,
        statusText: response.statusText
      });
      throw new Error(`Failed to download video: ${response.status} ${response.statusText}`);
    }

    // 비디오 데이터를 Buffer로 읽기
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    console.log('✅ 비디오 다운로드 성공:', {
      size: buffer.length,
      sizeMB: (buffer.length / 1024 / 1024).toFixed(2) + 'MB'
    });

    // Base64로 인코딩하여 반환
    return {
      statusCode: 200,
      headers: {
        ...headers,
        'Content-Type': 'video/mp4',
        'Content-Length': buffer.length.toString(),
        'Cache-Control': 'public, max-age=3600'
      },
      body: buffer.toString('base64'),
      isBase64Encoded: true
    };

  } catch (error) {
    console.error('❌ 비디오 다운로드 프록시 오류:', error);
    
    let statusCode = 500;
    let errorMessage = 'Video download failed';

    if (error.message?.includes('not configured')) {
      statusCode = 500;
      errorMessage = 'Server configuration error';
    } else if (error.message?.includes('required')) {
      statusCode = 400;
      errorMessage = 'Missing video URL parameter';
    } else if (error.message?.includes('Failed to download')) {
      statusCode = 502;
      errorMessage = 'Failed to fetch video from source';
    }

    return {
      statusCode,
      headers: {
        ...headers,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        error: errorMessage,
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      })
    };
  }
};
