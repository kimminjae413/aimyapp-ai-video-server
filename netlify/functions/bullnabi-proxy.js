// netlify/functions/bullnabi-proxy.js - 디버깅 강화 버전

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
    console.log('[Bullnabi Proxy] 요청 받음:', { 
      action: requestBody.action,
      hasToken: !!requestBody.token,
      userId: requestBody.userId 
    });
    
    const { action, metaCode, collectionName, documentJson, token, userId, data, query } = requestBody;
    
    // 🆕 동적 토큰 시스템: 사용자 토큰 발급
    if (action === 'getUserToken') {
      return await handleGetUserToken(userId, headers);
    }
    
    // 🆕 동적 토큰 시스템: 사용자 토큰 기반 액션들
    if (token && (action === 'getUserData' || action === 'createCreditHistory' || 
                  action === 'updateUserCredits' || action === 'saveGenerationResult')) {
      return await handleUserTokenAction(action, token, userId, data, headers);
    }
    
    // 🔧 기존 관리자 토큰 시스템 (기존 코드 그대로)
    return await handleAdminTokenAction(action, metaCode, collectionName, documentJson, headers);
    
  } catch (error) {
    console.error('[Bullnabi Proxy] Fatal error:', error);
    
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

/**
 * 🆕 사용자 토큰 발급 (동적 토큰 시스템)
 */
async function handleGetUserToken(userId, headers) {
  try {
    const adminToken = process.env.BULLNABI_TOKEN;
    
    if (!adminToken) {
      console.error('[Dynamic Token] BULLNABI_TOKEN 없음');
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'BULLNABI_TOKEN not configured'
        })
      };
    }
    
    console.log('[Dynamic Token] 사용자 토큰 발급 요청:', userId);
    console.log('[Dynamic Token] 관리자 토큰 사용:', adminToken.substring(0, 20) + '...');
    
    // 현재는 관리자 토큰을 반환 (임시 방식)
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        token: adminToken,
        expiresIn: 3600,
        note: 'Using admin token as user token (temporary)'
      })
    };
    
  } catch (error) {
    console.error('[Dynamic Token] 발급 실패:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error.message
      })
    };
  }
}

/**
 * 🆕 사용자 토큰 기반 액션 처리 (디버깅 강화)
 */
async function handleUserTokenAction(action, token, userId, data, headers) {
  try {
    console.log('[User Token] 액션 처리 시작:', { 
      action, 
      userId, 
      hasToken: !!token,
      tokenPreview: token ? token.substring(0, 20) + '...' : 'none'
    });
    
    let apiUrl = 'https://drylink.ohmyapp.io/bnb';
    let formData = new URLSearchParams();
    
    // 🔧 액션별 처리 개선
    switch (action) {
      case 'getUserData':
        apiUrl += '/aggregateForTableWithDocTimeline';
        formData.append('metaCode', '_users');
        formData.append('collectionName', '_users');
        const pipeline = {
          "pipeline": {
            "$match": { "_id": { "$eq": { "$oid": userId } } },
            "$limit": 1
          }
        };
        formData.append('documentJson', JSON.stringify(pipeline));
        console.log('[User Token] getUserData 파이프라인:', pipeline);
        break;
        
      case 'createCreditHistory':
        apiUrl += '/create';
        formData.append('metaCode', '_users');
        formData.append('collectionName', 'aiTicketHistory');
        formData.append('documentJson', JSON.stringify(data));
        console.log('[User Token] createCreditHistory 데이터:', data);
        break;
        
      case 'updateUserCredits':
        apiUrl += '/update';
        formData.append('metaCode', '_users');
        formData.append('collectionName', '_users');
        const updateDoc = {
          "_id": { "$oid": userId },
          "remainCount": data.newCount
        };
        formData.append('documentJson', JSON.stringify(updateDoc));
        console.log('[User Token] updateUserCredits 문서:', updateDoc);
        break;
        
      case 'saveGenerationResult':
        apiUrl += '/create';
        formData.append('metaCode', '_users');
        formData.append('collectionName', 'aiGenerationHistory');
        formData.append('documentJson', JSON.stringify(data));
        console.log('[User Token] saveGenerationResult 크기:', JSON.stringify(data).length);
        break;
        
      default:
        console.error('[User Token] 알 수 없는 액션:', action);
        throw new Error(`Unknown user action: ${action}`);
    }
    
    console.log('[User Token] API 호출:', {
      url: apiUrl,
      formDataSize: formData.toString().length,
      hasAuth: !!token
    });
    
    // API 요청
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': token  // Bearer 이미 포함됨
      },
      body: formData.toString()
    });
    
    const responseText = await response.text();
    
    console.log('[User Token] 응답 받음:', {
      action,
      status: response.status,
      statusText: response.statusText,
      length: responseText.length,
      preview: responseText.substring(0, 200)
    });
    
    // 🔧 응답 처리 강화
    if (!response.ok) {
      console.error('[User Token] HTTP 에러:', response.status, response.statusText);
      return {
        statusCode: response.status,
        headers,
        body: JSON.stringify({
          success: false,
          error: `HTTP ${response.status}: ${response.statusText}`,
          rawResponse: responseText.substring(0, 500)
        })
      };
    }
    
    let jsonData;
    try {
      jsonData = JSON.parse(responseText);
      console.log('[User Token] JSON 파싱 성공:', { 
        code: jsonData.code, 
        message: jsonData.message,
        hasData: !!jsonData.data
      });
    } catch (e) {
      console.error('[User Token] JSON 파싱 실패:', e.message);
      console.error('[User Token] Raw response:', responseText);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Invalid JSON response',
          rawResponse: responseText.substring(0, 500)
        })
      };
    }
    
    // 토큰 만료 확인
    if (jsonData.code === -110 || jsonData.code === '-110' || 
        (jsonData.message && jsonData.message.includes('만료된 토큰'))) {
      console.warn('[User Token] 토큰 만료 감지:', jsonData.message);
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'User token expired',
          needRefresh: true
        })
      };
    }
    
    // 🔧 성공 응답 조건 개선 - code 필드 없어도 data나 recordsTotal 있으면 성공으로 판단
    if (jsonData.code === '1' || jsonData.code === 1 || 
        jsonData.data || jsonData.recordsTotal > 0) {
      console.log('[User Token] 성공:', {
        action,
        dataCount: jsonData.data ? jsonData.data.length : 0,
        recordsTotal: jsonData.recordsTotal,
        hasCode: !!jsonData.code
      });
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          data: jsonData.data,
          recordsTotal: jsonData.recordsTotal,
          recordsFiltered: jsonData.recordsFiltered,
          metaVersion: jsonData.metaVersion,
          code: jsonData.code || 'success'
        })
      };
    }
    
    // 기타 에러
    console.warn('[User Token] API 에러 응답:', {
      code: jsonData.code,
      message: jsonData.message
    });
    
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({
        success: false,
        error: jsonData.message || 'API error',
        code: jsonData.code,
        rawData: jsonData
      })
    };
    
  } catch (error) {
    console.error('[User Token] 처리 실패:', error);
    console.error('[User Token] Stack trace:', error.stack);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error.message,
        stack: error.stack?.substring(0, 500)
      })
    };
  }
}

/**
 * 🔧 기존 관리자 토큰 시스템 (기존 코드 그대로 유지)
 */
async function handleAdminTokenAction(action, metaCode, collectionName, documentJson, headers) {
  // [기존 코드와 동일]
  let apiUrl = 'https://drylink.ohmyapp.io/bnb';
  
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
  
  const formData = new URLSearchParams();
  formData.append('metaCode', metaCode || '_users');
  formData.append('collectionName', collectionName);
  
  if (typeof documentJson === 'string') {
    formData.append('documentJson', documentJson);
  } else {
    formData.append('documentJson', JSON.stringify(documentJson));
  }
  
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': token
    },
    body: formData.toString()
  });
  
  const responseText = await response.text();
  
  let jsonData;
  if (!responseText || responseText.length === 0) {
    jsonData = {
      code: "0",
      message: "Empty response from server",
      data: []
    };
  } else {
    try {
      jsonData = JSON.parse(responseText);
    } catch (e) {
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
  
  return {
    statusCode: 200,
    headers,
    body: JSON.stringify(jsonData)
  };
}
