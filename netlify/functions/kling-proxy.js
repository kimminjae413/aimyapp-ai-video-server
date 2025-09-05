// netlify/functions/kling-proxy.js
exports.handler = async (event, context) => {
  // CORS 헤더
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  };

  // OPTIONS 요청 처리
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  const KLING_API_KEY = process.env.KLING_ACCESS_KEY;
  
  if (!KLING_API_KEY) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'KLING_ACCESS_KEY not configured' })
    };
  }

  try {
    const { method, endpoint, body } = JSON.parse(event.body);
    const url = `https://api-singapore.klingai.com/v1/videos/image2video${endpoint || ''}`;
    
    const response = await fetch(url, {
      method: method || 'POST',
      headers: {
        'Authorization': `Bearer ${KLING_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined
    });

    const data = await response.text();
    
    return {
      statusCode: response.status,
      headers,
      body: data
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
};
