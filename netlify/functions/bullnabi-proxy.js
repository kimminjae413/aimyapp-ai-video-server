// netlify/functions/bullnabi-proxy.js - 토큰 만료시 데이터 반환 최종 버전

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
      userId: requestBody.userId,
      timestamp: new Date().toISOString()
    });
    
    const { action, metaCode, collectionName, documentJson, token, userId, data, query } = requestBody;
    
    // 동적 토큰 시스템: 사용자 토큰 발급
    if (action === 'getUserToken') {
      return await handleGetUserToken(userId, headers);
    }
    
    // 동적 토큰 시스템: 사용자 토큰 기반 액션들
    if (token && (action === 'getUserData' || action === 'createCreditHistory' || 
                  action === 'updateUserCredits' || action === 'saveGenerationResult')) {
      return await handleUserTokenAction(action, token, userId, data, headers);
    }
    
    // 기존 관리자 토큰 시스템 (기존 코드 그대로)
    return await handleAdminTokenAction(action, metaCode, collectionName, documentJson, headers);
    
  } catch (error) {
    console.error('[Bullnabi Proxy] Fatal error:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        code: "-1",
        message: error.message,
        error: error.toString(),
        timestamp: new Date().toISOString()
      })
    };
  }
};

/**
 * 사용자 토큰 발급 (동적 토큰 시스템)
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
          error: 'BULLNABI_TOKEN not configured',
          timestamp: new Date().toISOString()
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
        expiresIn: 3600, // 1시간
        issuedAt: new Date().toISOString(),
        userId: userId,
        note: 'Using admin token as user token'
      })
    };
    
  } catch (error) {
    console.error('[Dynamic Token] 발급 실패:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      })
    };
  }
}

/**
 * 사용자 토큰 기반 액션 처리 - 토큰 만료시 데이터 반환 로직
 */
async function handleUserTokenAction(action, token, userId, data, headers) {
  try {
    console.log('[User Token] 액션 처리 시작:', { 
      action, 
      userId, 
      hasToken: !!token,
      tokenPreview: token ? token.substring(0, 20) + '...' : 'none',
      timestamp: new Date().toISOString()
    });
    
    let apiUrl = 'https://drylink.ohmyapp.io/bnb';
    let formData = new URLSearchParams();
    
    // 액션별 처리
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
        console.log('[User Token] createCreditHistory 데이터 크기:', JSON.stringify(data).length);
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
        console.log('[User Token] updateUserCredits 새 카운트:', data.newCount);
        break;
        
      case 'saveGenerationResult':
        apiUrl += '/create';
        formData.append('metaCode', '_users');
        formData.append('collectionName', 'aiGenerationHistory');
        formData.append('documentJson', JSON.stringify(data));
        console.log('[User Token] saveGenerationResult 데이터 크기:', JSON.stringify(data).length);
        break;
        
      default:
        console.error('[User Token] 알 수 없는 액션:', action);
        throw new Error(`Unknown user action: ${action}`);
    }
    
    console.log('[User Token] API 호출 준비:', {
      url: apiUrl,
      formDataSize: formData.toString().length,
      hasAuth: !!token
    });
    
    // API 요청 실행
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': token
      },
      body: formData.toString()
    });
    
    const responseText = await response.text();
    
    console.log('[User Token] 응답 받음:', {
      action,
      status: response.status,
      statusText: response.statusText,
      contentLength: responseText.length,
      preview: responseText.substring(0, 150) + (responseText.length > 150 ? '...' : ''),
      timestamp: new Date().toISOString()
    });
    
    // HTTP 에러 처리
    if (!response.ok) {
      console.error('[User Token] HTTP 에러:', response.status, response.statusText);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: false,
          error: `HTTP ${response.status}: ${response.statusText}`,
          needRefresh: false, // HTTP 에러는 토큰 갱신으로 해결되지 않음
          rawResponse: responseText.substring(0, 300),
          timestamp: new Date().toISOString()
        })
      };
    }
    
    // JSON 파싱
    let jsonData;
    try {
      jsonData = JSON.parse(responseText);
      console.log('[User Token] JSON 파싱 성공:', { 
        code: jsonData.code, 
        message: jsonData.message ? jsonData.message.substring(0, 100) : 'none',
        hasData: !!jsonData.data,
        dataLength: jsonData.data ? jsonData.data.length : 0,
        recordsTotal: jsonData.recordsTotal || 0
      });
    } catch (parseError) {
      console.error('[User Token] JSON 파싱 실패:', parseError.message);
      console.error('[User Token] Raw response preview:', responseText.substring(0, 200));
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Invalid JSON response from API',
          needRefresh: false,
          rawResponse: responseText.substring(0, 300),
          timestamp: new Date().toISOString()
        })
      };
    }
    
    // 🎯 핵심 수정: 토큰 만료 감지 시 데이터가 있으면 성공으로 처리
    const tokenExpiredConditions = [
      jsonData.code === -110,
      jsonData.code === '-110',
      jsonData.code === -111,
      jsonData.code === '-111',
      jsonData.message && (
        jsonData.message.includes('만료된 토큰') ||
        jsonData.message.includes('토큰이 만료') ||
        jsonData.message.includes('token expired') ||
        jsonData.message.includes('unauthorized') ||
        jsonData.message.includes('invalid token')
      )
    ];
    
    if (tokenExpiredConditions.some(condition => condition)) {
      console.warn('[User Token] 토큰 만료 감지, 데이터 확인 중:', {
        code: jsonData.code,
        message: jsonData.message,
        hasData: !!jsonData.data,
        dataLength: jsonData.data ? jsonData.data.length : 0,
        action: action,
        userId: userId
      });
      
      // 🔥 핵심: 토큰이 만료되어도 데이터가 있으면 성공으로 처리
      if (jsonData.data && jsonData.data.length > 0) {
        console.log('[User Token] 토큰 만료되었지만 데이터 조회 성공 - 성공으로 처리');
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            data: jsonData.data,
            recordsTotal: jsonData.recordsTotal || jsonData.data.length,
            recordsFiltered: jsonData.recordsFiltered || jsonData.data.length,
            metaVersion: jsonData.metaVersion,
            code: 'expired_but_data_available',
            message: '토큰 만료되었지만 데이터 조회 성공',
            tokenExpired: true, // 토큰 만료 표시 (참고용)
            timestamp: new Date().toISOString()
          })
        };
      }
      
      // 데이터도 없으면 실제 실패 (무한루프 방지)
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Token expired and no data available',
          needRefresh: false, // 🔥 무한루프 방지 - 토큰 갱신 시도 안함
          code: jsonData.code,
          message: jsonData.message,
          tokenExpired: true,
          timestamp: new Date().toISOString()
        })
      };
    }
    
    // 일반적인 성공 조건 확인
    const successConditions = [
      jsonData.code === '1',
      jsonData.code === 1,
      jsonData.data && Array.isArray(jsonData.data) && jsonData.data.length > 0,
      jsonData.recordsTotal > 0,
      // 특별한 경우: 데이터가 없어도 성공인 경우들
      (action === 'updateUserCredits' && !jsonData.error),
      (action === 'createCreditHistory' && !jsonData.error),
      (action === 'saveGenerationResult' && !jsonData.error)
    ];
    
    if (successConditions.some(condition => condition)) {
      console.log('[User Token] 성공 응답:', {
        action,
        code: jsonData.code,
        dataCount: jsonData.data ? jsonData.data.length : 0,
        recordsTotal: jsonData.recordsTotal || 0,
        hasError: !!jsonData.error
      });
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          data: jsonData.data || [],
          recordsTotal: jsonData.recordsTotal || 0,
          recordsFiltered: jsonData.recordsFiltered || 0,
          metaVersion: jsonData.metaVersion,
          code: jsonData.code || 'success',
          message: jsonData.message,
          timestamp: new Date().toISOString()
        })
      };
    }
    
    // 기타 상황 (성공도 실패도 아닌 경우)
    console.warn('[User Token] 애매한 API 응답:', {
      action,
      code: jsonData.code,
      message: jsonData.message,
      hasData: !!jsonData.data,
      hasError: !!jsonData.error
    });
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: false,
        error: jsonData.message || jsonData.error || 'Unknown API response',
        needRefresh: false, // 애매한 상황에서도 토큰 갱신 시도 안함
        code: jsonData.code,
        rawData: {
          code: jsonData.code,
          message: jsonData.message,
          error: jsonData.error,
          hasData: !!jsonData.data
        },
        timestamp: new Date().toISOString()
      })
    };
    
  } catch (error) {
    console.error('[User Token] 처리 중 예외 발생:', {
      error: error.message,
      stack: error.stack?.substring(0, 300),
      action: action,
      userId: userId
    });
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: false,
        error: error.message,
        needRefresh: false, // 예외 상황에서는 토큰 갱신 시도 안함
        stack: error.stack?.substring(0, 300),
        timestamp: new Date().toISOString()
      })
    };
  }
}

/**
 * 기존 관리자 토큰 시스템 (호환성 유지)
 */
async function handleAdminTokenAction(action, metaCode, collectionName, documentJson, headers) {
  console.log('[Admin Token] 관리자 토큰으로 처리:', { action, metaCode, collectionName });
  
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
          error: `Unknown action: ${action}`,
          timestamp: new Date().toISOString()
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
        message: "BULLNABI_TOKEN not configured",
        timestamp: new Date().toISOString()
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
  
  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': token
      },
      body: formData.toString()
    });
    
    const responseText = await response.text();
    
    console.log('[Admin Token] 응답 받음:', {
      status: response.status,
      length: responseText.length,
      preview: responseText.substring(0, 100)
    });
    
    let jsonData;
    if (!responseText || responseText.length === 0) {
      jsonData = {
        code: "0",
        message: "Empty response from server",
        data: [],
        timestamp: new Date().toISOString()
      };
    } else {
      try {
        jsonData = JSON.parse(responseText);
      } catch (e) {
        if (responseText.includes('<!DOCTYPE') || responseText.includes('<html')) {
          jsonData = {
            code: "0",
            message: "Server returned HTML instead of JSON",
            error: "Invalid response format",
            timestamp: new Date().toISOString()
          };
        } else {
          jsonData = {
            code: "0",
            message: "Response parsing failed",
            rawData: responseText.substring(0, 300),
            timestamp: new Date().toISOString()
          };
        }
      }
    }
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(jsonData)
    };
    
  } catch (error) {
    console.error('[Admin Token] 요청 실패:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        code: "-1",
        message: error.message,
        error: error.toString(),
        timestamp: new Date().toISOString()
      })
    };
  }
}
