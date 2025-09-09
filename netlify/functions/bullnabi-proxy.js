// netlify/functions/bullnabi-proxy.js

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
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
    const requestBody = JSON.parse(event.body);
    const { action, metaCode, collectionName, documentJson, token } = requestBody;
    
    // API URL 구성 - drylink.ohmyapp.io 사용
    let apiUrl = 'http://drylink.ohmyapp.io/bnb';
    
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
    
    console.log('[Bullnabi Proxy] Request to:', apiUrl);
    console.log('[Bullnabi Proxy] Collection:', collectionName);
    console.log('[Bullnabi Proxy] DocumentJson:', documentJson);
    
    // FormData 생성
    const formData = new URLSearchParams();
    formData.append('metaCode', metaCode || '_users');
    formData.append('collectionName', collectionName);
    
    if (typeof documentJson === 'string') {
      formData.append('documentJson', documentJson);
    } else {
      formData.append('documentJson', JSON.stringify(documentJson));
    }
    
    // fetch 요청 (Node 18+)
    const fetchHeaders = {
      'Content-Type': 'application/x-www-form-urlencoded'
    };
    
    // JWT 토큰이 있으면 추가
    if (token) {
      fetchHeaders['Authorization'] = `Bearer ${token}`;
    }
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: fetchHeaders,
      body: formData.toString()
    });
    
    const responseText = await response.text();
    console.log('[Bullnabi Proxy] Response status:', response.status);
    console.log('[Bullnabi Proxy] Response:', responseText.substring(0, 500));
    
    // JSON 파싱 시도
    let jsonData;
    try {
      jsonData = JSON.parse(responseText);
    } catch (e) {
      console.error('[Bullnabi Proxy] Parse error:', e);
      jsonData = { 
        code: "0", 
        message: "Response parsing failed", 
        rawData: responseText 
      };
    }
    
    return {
      statusCode: response.status,
      headers,
      body: JSON.stringify(jsonData)
    };
    
  } catch (error) {
    console.error('[Bullnabi Proxy] Error:', error);
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
