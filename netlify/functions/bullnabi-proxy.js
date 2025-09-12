// netlify/functions/bullnabi-proxy.js

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  };
  
  // OPTIONS 요청 처리 (CORS preflight)
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }
  
  // POST 요청만 허용
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }
  
  try {
    const requestBody = JSON.parse(event.body);
    const { action, metaCode, collectionName, documentJson } = requestBody; // token 제거
    
    // API URL 구성
    let apiUrl = 'https://drylink.ohmyapp.io/bnb';
    
    // 액션별 엔드포인트 설정
    switch (action) {
      case 'aggregate':
        apiUrl += '/aggregateForTableWithDocTimeline';
        break;
      case 'create':
        apiUrl += '/create';
        break;
      case 'update':
        apiUrl += '/update';
        break;
      case 'delete':
        apiUrl += '/delete';
        break;
      default:
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ 
            code: "0",
            message: "Invalid action",
            error: `Unknown action: ${action}` 
          })
        };
    }
    
    // 토큰 설정 (환경변수만 사용)
    const token = process.env.BULLNABI_TOKEN;

    if (!token) {
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                code: "-1",
                message: "BULLNABI_TOKEN not configured"
            })
        };
    }
    
    console.log('[Bullnabi Proxy] Request:', {
      url: apiUrl,
      action: action,
      metaCode: metaCode,
      collection: collectionName,
      hasToken: !!token
    });
    
    // FormData 생성
    const formData = new URLSearchParams();
    
    // metaCode 기본값: _users (community 대신)
    formData.append('metaCode', metaCode || '_users');
    formData.append('collectionName', collectionName);
    
    // documentJson 처리
    if (typeof documentJson === 'string') {
      formData.append('documentJson', documentJson);
    } else {
      formData.append('documentJson', JSON.stringify(documentJson));
    }
    
    // 헤더 설정
    const fetchHeaders = {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': token
    };
    
    // API 요청
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: fetchHeaders,
      body: formData.toString()
    });
    
    const responseText = await response.text();
    
    console.log('[Bullnabi Proxy] Response:', {
      status: response.status,
      length: responseText.length,
      preview: responseText.substring(0, 200)
    });
    
    // 응답 처리
    let jsonData;
    
    // 빈 응답 처리
    if (!responseText || responseText.length === 0) {
      console.warn('[Bullnabi Proxy] Empty response received');
      jsonData = {
        code: "0",
        message: "Empty response from server",
        data: []
      };
    } else {
      // JSON 파싱 시도
      try {
        jsonData = JSON.parse(responseText);
        
        // 성공 응답 로깅
        if (jsonData.code === "1" || jsonData.data || jsonData.recordsTotal) {
          console.log('[Bullnabi Proxy] Success:', {
            code: jsonData.code,
            recordsTotal: jsonData.recordsTotal,
            dataLength: jsonData.data ? jsonData.data.length : 0
          });
        }
      } catch (e) {
        console.error('[Bullnabi Proxy] JSON parse error:', e.message);
        
        // HTML 응답인 경우 (에러 페이지 등)
        if (responseText.includes('<!DOCTYPE') || responseText.includes('<html')) {
          jsonData = {
            code: "0",
            message: "Server returned HTML instead of JSON",
            error: "Invalid response format"
          };
        } else {
          jsonData = {
            code: "0",
            message: "Response parsing failed",
            rawData: responseText.substring(0, 500)
          };
        }
      }
    }
    
    // 응답 반환
    return {
      statusCode: 200, // 항상 200 반환 (클라이언트에서 처리)
      headers,
      body: JSON.stringify(jsonData)
    };
    
  } catch (error) {
    console.error('[Bullnabi Proxy] Fatal error:', error);
    
    // 네트워크 에러 처리
    if (error.message.includes('fetch')) {
      return {
        statusCode: 503,
        headers,
        body: JSON.stringify({
          code: "-1",
          message: "Service unavailable",
          error: "Cannot connect to Bullnabi server"
        })
      };
    }
    
    // 기타 에러
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
