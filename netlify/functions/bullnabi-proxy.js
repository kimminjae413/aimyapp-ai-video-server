// netlify/functions/bullnabi-proxy.js - 이메일 로그인 토큰 자동 갱신 최종 버전

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
    const timestamp = new Date().toISOString().slice(11, 19);
    
    console.log(`[${timestamp}] [Bullnabi Proxy] 요청 받음:`, { 
      action: requestBody.action,
      hasToken: !!requestBody.token,
      userId: requestBody.userId?.substring(0, 8) + '...' || 'N/A'
    });
    
    const { action, metaCode, collectionName, documentJson, token, userId, data } = requestBody;
    
    // 🆕 토큰 자동 갱신 시스템
    if (action === 'refreshToken') {
      return await handleRefreshToken(headers);
    }
    
    // 동적 토큰 시스템: 사용자 토큰 발급
    if (action === 'getUserToken') {
      return await handleGetUserToken(userId, headers);
    }
    
    // 동적 토큰 시스템: 사용자 토큰 기반 액션들
    if (token && (action === 'getUserData' || action === 'createCreditHistory' || 
                  action === 'updateUserCredits' || action === 'saveGenerationResult')) {
      return await handleUserTokenAction(action, token, userId, data, headers);
    }
    
    // 기존 관리자 토큰 시스템
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
 * 🆕 이메일 로그인으로 토큰 자동 갱신
 */
async function handleRefreshToken(headers) {
  try {
    const loginId = process.env.BULLNABI_LOGIN_ID; // 관리자 이메일
    const loginPw = process.env.BULLNABI_LOGIN_PW; // 관리자 비밀번호
    
    if (!loginId || !loginPw) {
      console.error('[Token Refresh] BULLNABI_LOGIN_ID 또는 BULLNABI_LOGIN_PW 없음');
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Login credentials not configured',
          timestamp: new Date().toISOString()
        })
      };
    }
    
    console.log('[Token Refresh] 이메일 로그인으로 토큰 갱신 시작:', loginId);
    
    // 이메일 로그인 API 호출
    const loginFormData = new URLSearchParams();
    loginFormData.append('documentJson', JSON.stringify({
      loginId: loginId,
      loginPw: loginPw,
      isShortToken: true // 짧은 토큰 발급
    }));
    
    const loginResponse = await fetch('https://drylink.ohmyapp.io/bnb/user/token/loginByEmail', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: loginFormData.toString()
    });
    
    const loginResponseText = await loginResponse.text();
    console.log('[Token Refresh] 로그인 응답:', {
      status: loginResponse.status,
      length: loginResponseText.length,
      preview: loginResponseText.substring(0, 200)
    });
    
    if (!loginResponse.ok) {
      throw new Error(`Login API error: ${loginResponse.status}`);
    }
    
    let loginData;
    try {
      loginData = JSON.parse(loginResponseText);
    } catch (e) {
      throw new Error('Login response parsing failed');
    }
    
    if (loginData.code === '1' && loginData.accessToken) {
      const newToken = `Bearer ${loginData.accessToken}`;
      console.log('[Token Refresh] 새 토큰 발급 성공:', newToken.substring(0, 30) + '...');
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          token: newToken,
          accessToken: loginData.accessToken,
          userInfo: loginData.message, // 사용자 정보가 message에 JSON으로 들어있음
          expiresIn: 3600,
          refreshedAt: new Date().toISOString()
        })
      };
    } else {
      throw new Error(`Login failed: ${loginData.message || 'Unknown error'}`);
    }
    
  } catch (error) {
    console.error('[Token Refresh] 토큰 갱신 실패:', error);
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
 * 사용자 토큰 발급 (동적 토큰 시스템) - 자동 갱신 추가
 */
async function handleGetUserToken(userId, headers) {
  try {
    let adminToken = process.env.BULLNABI_TOKEN;
    
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
    
    // 먼저 기존 토큰으로 시도
    console.log('[Dynamic Token] 기존 관리자 토큰 사용 시도');
    
    // 🆕 토큰이 만료되었을 때 자동 갱신 시도
    const testResponse = await fetch('https://drylink.ohmyapp.io/bnb/aggregateForTableWithDocTimeline', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': adminToken
      },
      body: new URLSearchParams({
        metaCode: '_users',
        collectionName: '_users',
        documentJson: JSON.stringify({
          "pipeline": {
            "$match": {},
            "$limit": 1
          }
        })
      }).toString()
    });
    
    const testResponseText = await testResponse.text();
    let testData;
    try {
      testData = JSON.parse(testResponseText);
    } catch (e) {
      testData = { code: -1, message: 'Parse error' };
    }
    
    // 토큰 만료 감지
    if (testData.code === -110 || testData.code === '-110' || 
        (testData.message && testData.message.includes('만료된 토큰'))) {
      
      console.log('[Dynamic Token] 토큰 만료 감지 - 자동 갱신 시도');
      
      // 자동 토큰 갱신
      const refreshResult = await handleRefreshToken(headers);
      const refreshBody = JSON.parse(refreshResult.body);
      
      if (refreshResult.statusCode === 200 && refreshBody.success) {
        adminToken = refreshBody.token;
        console.log('[Dynamic Token] 토큰 자동 갱신 성공');
        
        // 환경변수도 업데이트 (런타임에서만 유효)
        process.env.BULLNABI_TOKEN = adminToken;
      } else {
        console.error('[Dynamic Token] 토큰 자동 갱신 실패');
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({
            success: false,
            error: 'Token auto-refresh failed',
            refreshError: refreshBody.error,
            timestamp: new Date().toISOString()
          })
        };
      }
    }
    
    // 갱신된 토큰 또는 기존 유효한 토큰 반환
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        token: adminToken,
        expiresIn: 3600,
        issuedAt: new Date().toISOString(),
        userId: userId,
        autoRefreshed: testData.code === -110 || testData.code === '-110',
        note: 'Using admin token as user token with auto-refresh'
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
 * 사용자 토큰 기반 액션 처리 - 토큰 만료시 데이터 반환 및 자동 갱신
 */
async function handleUserTokenAction(action, token, userId, data, headers) {
  try {
    console.log(`[User Token] 액션 처리: ${action} for ${userId}`);
    
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
        const updateDoc = {
          "_id": { "$oid": userId },
          "remainCount": data.newCount
        };
        formData.append('documentJson', JSON.stringify(updateDoc));
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
    console.log(`[User Token] ${action} 응답:`, {
      status: response.status,
      length: responseText.length,
      preview: responseText.substring(0, 100) + '...'
    });
    
    if (!response.ok) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: false,
          error: `HTTP ${response.status}: ${response.statusText}`,
          needRefresh: false,
          timestamp: new Date().toISOString()
        })
      };
    }
    
    // JSON 파싱
    let jsonData;
    try {
      jsonData = JSON.parse(responseText);
    } catch (parseError) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Invalid JSON response from API',
          needRefresh: false,
          timestamp: new Date().toISOString()
        })
      };
    }
    
    // 토큰 만료 감지
    const tokenExpired = [
      jsonData.code === -110,
      jsonData.code === '-110',
      jsonData.message && jsonData.message.includes('만료된 토큰')
    ].some(Boolean);
    
    if (tokenExpired) {
      console.warn(`[User Token] ${action} - 토큰 만료 감지:`, {
        code: jsonData.code,
        hasData: !!jsonData.data,
        dataLength: jsonData.data ? jsonData.data.length : 0
      });
      
      // 🔥 핵심: 토큰이 만료되어도 데이터가 있으면 성공으로 처리
      if (jsonData.data && jsonData.data.length > 0) {
        console.log('[User Token] 토큰 만료되었지만 데이터 조회 성공');
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
            tokenExpired: true,
            timestamp: new Date().toISOString()
          })
        };
      }
      
      // 데이터도 없으면 토큰 갱신 필요
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Token expired and no data available',
          needRefresh: true, // 🆕 토큰 갱신 필요 신호
          code: jsonData.code,
          tokenExpired: true,
          timestamp: new Date().toISOString()
        })
      };
    }
    
    // 일반적인 성공 조건
    if (jsonData.code === '1' || jsonData.code === 1 || 
        (jsonData.data && jsonData.data.length > 0) ||
        jsonData.recordsTotal > 0) {
      
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
    
    // 기타 실패
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: false,
        error: jsonData.message || jsonData.error || 'Unknown API response',
        needRefresh: false,
        code: jsonData.code,
        timestamp: new Date().toISOString()
      })
    };
    
  } catch (error) {
    console.error(`[User Token] ${action} 처리 중 예외:`, error);
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: false,
        error: error.message,
        needRefresh: false,
        timestamp: new Date().toISOString()
      })
    };
  }
}

/**
 * 기존 관리자 토큰 시스템 (토큰 자동 갱신 추가)
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
  
  let token = process.env.BULLNABI_TOKEN;
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
  formData.append('documentJson', typeof documentJson === 'string' ? documentJson : JSON.stringify(documentJson));
  
  try {
    // 첫 번째 시도
    let response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': token
      },
      body: formData.toString()
    });
    
    let responseText = await response.text();
    let jsonData;
    
    try {
      jsonData = JSON.parse(responseText);
    } catch (e) {
      jsonData = { code: "0", message: "Response parsing failed" };
    }
    
    // 🆕 토큰 만료시 자동 갱신 후 재시도
    if (jsonData.code === -110 || jsonData.code === '-110' || 
        (jsonData.message && jsonData.message.includes('만료된 토큰'))) {
      
      console.log('[Admin Token] 토큰 만료 감지 - 자동 갱신 후 재시도');
      
      const refreshResult = await handleRefreshToken(headers);
      const refreshBody = JSON.parse(refreshResult.body);
      
      if (refreshResult.statusCode === 200 && refreshBody.success) {
        token = refreshBody.token;
        process.env.BULLNABI_TOKEN = token; // 런타임 업데이트
        
        console.log('[Admin Token] 토큰 갱신 성공 - 요청 재시도');
        
        // 갱신된 토큰으로 재시도
        response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': token
          },
          body: formData.toString()
        });
        
        responseText = await response.text();
        
        try {
          jsonData = JSON.parse(responseText);
        } catch (e) {
          jsonData = { 
            code: "0", 
            message: "Response parsing failed after token refresh",
            autoRefreshed: true 
          };
        }
      } else {
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({
            code: "-1",
            message: "Token expired and auto-refresh failed",
            refreshError: refreshBody.error,
            timestamp: new Date().toISOString()
          })
        };
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
        timestamp: new Date().toISOString()
      })
    };
  }
}
