// netlify/functions/bullnabi-proxy.js

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
  
  // POST 요청만 처리
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }
  
  try {
    const requestBody = JSON.parse(event.body);
    const { action, metaCode, collectionName, documentJson } = requestBody;
    
    // Bullnabi API URL 결정
    let apiUrl = 'https://jihwanworld.ohmyapp.io/bnb';
    
    if (action === 'aggregate') {
      apiUrl += '/aggregateForTableWithDocTimeline';
    } else if (action === 'create') {
      apiUrl += '/create';
    } else if (action === 'update') {
      apiUrl += '/update';
    } else {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid action' })
      };
    }
    
    console.log(`Proxying ${action} request to:`, apiUrl);
    console.log('Collection:', collectionName);
    
    // Bullnabi API 호출
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // User-Agent에 토큰이 필요한 경우 여기에 추가
        // 'User-Agent': 'your-token-here'
      },
      body: JSON.stringify({
        metaCode,
        collectionName,
        documentJson: typeof documentJson === 'string' 
          ? documentJson 
          : JSON.stringify(documentJson)
      })
    });
    
    const data = await response.text();
    console.log('Response status:', response.status);
    
    // JSON 파싱 시도
    let jsonData;
    try {
      jsonData = JSON.parse(data);
    } catch (e) {
      console.error('Failed to parse response as JSON:', data);
      jsonData = { code: "0", message: "Response parsing failed", rawData: data };
    }
    
    return {
      statusCode: response.status,
      headers,
      body: JSON.stringify(jsonData)
    };
  } catch (error) {
    console.error('Proxy error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        code: "-1",
        message: error.message 
      })
    };
  }
};
