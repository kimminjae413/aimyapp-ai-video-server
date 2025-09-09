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
    
    // Bullnabi API URL 결정 (http 사용)
    let apiUrl = 'http://jihwanworld.ohmyapp.io/bnb';
    
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
    
    console.log(`[Bullnabi Proxy] ${action} request to:`, apiUrl);
    console.log('[Bullnabi Proxy] Collection:', collectionName);
    console.log('[Bullnabi Proxy] MetaCode:', metaCode);
    console.log('[Bullnabi Proxy] DocumentJson:', documentJson);
    
    // FormData 형식으로 변환 (application/x-www-form-urlencoded)
    const formData = new URLSearchParams();
    formData.append('metaCode', metaCode || 'community');
    formData.append('collectionName', collectionName);
    
    // documentJson 처리 - 이미 문자열이면 그대로, 객체면 stringify
    if (typeof documentJson === 'string') {
      formData.append('documentJson', documentJson);
    } else {
      formData.append('documentJson', JSON.stringify(documentJson));
    }
    
    console.log('[Bullnabi Proxy] FormData being sent:', formData.toString());
    
    // Bullnabi API 호출 - FormData 형식으로
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        // 추가 헤더가 필요한 경우
        // 'User-Agent': 'your-token-here'
      },
      body: formData.toString()
    });
    
    const responseText = await response.text();
    console.log('[Bullnabi Proxy] Response status:', response.status);
    console.log('[Bullnabi Proxy] Response text:', responseText);
    
    // JSON 파싱 시도
    let jsonData;
    try {
      jsonData = JSON.parse(responseText);
      console.log('[Bullnabi Proxy] Parsed response:', JSON.stringify(jsonData, null, 2));
    } catch (e) {
      console.error('[Bullnabi Proxy] Failed to parse response as JSON:', responseText);
      // 파싱 실패 시 원본 텍스트 반환
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
        message: error.message,
        error: error.toString()
      })
    };
  }
};
