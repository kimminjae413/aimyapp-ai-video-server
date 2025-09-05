// netlify/functions/kling-proxy.js
const crypto = require('crypto');

// JWT 토큰 생성 함수
function generateJWT(accessKey, secretKey) {
  const header = {
    alg: 'HS256',
    typ: 'JWT'
  };
  
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: accessKey,
    exp: now + 1800, // 30분 후 만료
    nbf: now - 5     // 5초 전부터 유효
  };
  
  const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  
  const signature = crypto
    .createHmac('sha256', secretKey)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64url');
  
  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

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
  
  const KLING_ACCESS_KEY = process.env.KLING_ACCESS_KEY;
  const KLING_SECRET_KEY = process.env.KLING_SECRET_KEY;
  
  if (!KLING_ACCESS_KEY || !KLING_SECRET_KEY) {
    console.error('Missing API keys:', {
      access: !!KLING_ACCESS_KEY,
      secret: !!KLING_SECRET_KEY
    });
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        code: -1,
        message: 'API keys not configured properly' 
      })
    };
  }
  
  try {
    // JWT 토큰 생성
    const jwtToken = generateJWT(KLING_ACCESS_KEY, KLING_SECRET_KEY);
    console.log('JWT token generated successfully');
    
    const { method, endpoint, body } = JSON.parse(event.body);
    const url = `https://api-singapore.klingai.com/v1/videos/image2video${endpoint || ''}`;
    
    console.log(`Proxying ${method} request to:`, url);
    
    const response = await fetch(url, {
      method: method || 'POST',
      headers: {
        'Authorization': `Bearer ${jwtToken}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined
    });
    
    const data = await response.text();
    console.log('Response status:', response.status);
    
    return {
      statusCode: response.status,
      headers,
      body: data
    };
  } catch (error) {
    console.error('Proxy error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        code: -1,
        message: error.message 
      })
    };
  }
};
