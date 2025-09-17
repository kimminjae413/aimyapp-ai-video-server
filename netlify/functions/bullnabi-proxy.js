// netlify/functions/bullnabi-proxy.js - 기존 코드 + 동적 토큰 지원 추가

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

/**
 * 🆕 사용자 토큰 발급 (동적 토큰 시스템)
 */
async function handleGetUserToken(userId, headers) {
  try {
    const adminToken = process.env.BULLNABI_TOKEN;
    
    if (!adminToken) {
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
    
    // 현재는 관리자 토큰을 반환 (실제 구현시 개별 토큰 발급)
    // TODO: Bullnabi API에 사용자별 토큰 발급 기능이 추가되면 수정
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
 * 🆕 사용자 토큰 기반 액션 처리 (동적 토큰 시스템)
 */
async function handleUserTokenAction(action, token, userId, data, headers) {
  try {
    console.log('[User Token] 액션 처리:', { action, userId, hasToken: !!token });
    
    let apiUrl = 'https://drylink.ohmyapp.io/bnb';
    let formData = new URLSearchParams();
    
    switch (action) {
      case 'getUserData':
        apiUrl += '/aggregateForTableWithDocTimeline';
        formData.append('metaCode', '_users');
        formData.append('collectionName', '_users');
        formData.append('documentJson', JSON.stringify({
          "pipeline": {
            "$match": { "_id": { "$eq": { "$oid": userId } } },
            "$limit": 1
          }
        }));
        break;
        
      case 'createCreditHistory':
        apiUrl += '/create';
        formData.append('metaCode', '_users');
        formData.append('collectionName', 'aiTicketHistory');
        formData.append('documentJson', JSON.stringify(data));
        break;
        
      case 'updateUserCredits':
        apiUrl += '/update';
        formData.append('metaCode', '_users');
        formData.append('collectionName', '_users');
        formData.append('documentJson', JSON.stringify({
          "_id": { "$oid": userId },
          "remainCount": data.newCount
        }));
        break;
        
      case 'saveGenerationResult':
        apiUrl += '/create';
        formData.append('metaCode', '_users');
        formData.append('collectionName', 'aiGenerationHistory');
        formData.append('documentJson', JSON.stringify(data));
        break;
        
      default:
        throw new Error(`Unknown user action: ${action}`);
    }
    
    // API 요청
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': token
      },
      body: formData.toString()
    });
    
    const responseText = await response.text();
    
    console.log('[User Token] Response:', {
      action,
      status: response.status,
      length: responseText.length,
      preview: responseText.substring(0, 200)
    });
    
    let jsonData;
    try {
      jsonData = JSON.parse(responseText);
    } catch (e) {
      throw new Error('Invalid response format');
    }
    
    // 토큰 만료 확인
    if (jsonData.code === -110 || jsonData.code === '-110' || jsonData.message?.includes('만료된 토큰')) {
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
    
    // 성공 응답
    if (jsonData.code === '1' || jsonData.code === 1) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          data: jsonData.data,
          recordsTotal: jsonData.recordsTotal
        })
      };
    }
    
    // 기타 에러
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({
        success: false,
        error: jsonData.message || 'Unknown error'
      })
    };
    
  } catch (error) {
    console.error('[User Token] 처리 실패:', error);
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
 * 🔧 기존 관리자 토큰 시스템 (기존 코드 그대로 유지)
 */
async function handleAdminTokenAction(action, metaCode, collectionName, documentJson, headers) {
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
}
