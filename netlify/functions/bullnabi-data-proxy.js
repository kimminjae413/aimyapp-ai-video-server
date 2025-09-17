// netlify/functions/bullnabi-data-proxy.js
// 사용자 토큰으로 데이터 조회 전용 Function

exports.handler = async (event, context) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  };
  
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }
  
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }
  
  try {
    const { action, token, userId, data, query } = JSON.parse(event.body);
    
    if (!token) {
      return {
        statusCode: 401,
        headers: corsHeaders,
        body: JSON.stringify({
          success: false,
          error: 'User token required'
        })
      };
    }
    
    console.log('[Data Proxy] 사용자 데이터 요청:', {
      action,
      userId,
      hasToken: !!token
    });
    
    let apiUrl = '';
    let requestBody = '';
    
    // 요청 타입별 처리
    switch (action) {
      case 'getUserData':
        // 사용자 크레딧 정보 조회
        apiUrl = 'https://drylink.ohmyapp.io/bnb/aggregateForTableWithDocTimeline';
        requestBody = new URLSearchParams({
          metaCode: '_users',
          collectionName: '_users',
          documentJson: JSON.stringify({
            "pipeline": {
              "$match": { 
                "_id": { 
                  "$eq": { 
                    "$oid": userId
                  } 
                } 
              },
              "$limit": 1
            }
          })
        }).toString();
        break;
        
      case 'createCreditHistory':
        // 크레딧 사용 내역 생성
        apiUrl = 'https://drylink.ohmyapp.io/bnb/create';
        requestBody = new URLSearchParams({
          metaCode: '_users',
          collectionName: 'aiTicketHistory',
          documentJson: JSON.stringify(data)
        }).toString();
        break;
        
      case 'updateUserCredits':
        // 사용자 크레딧 업데이트
        apiUrl = 'https://drylink.ohmyapp.io/bnb/update';
        requestBody = new URLSearchParams({
          metaCode: '_users',
          collectionName: '_users',
          documentJson: JSON.stringify({
            "_id": { "$oid": userId },
            "remainCount": data.newCount || 0
          })
        }).toString();
        break;
        
      case 'getCreditHistory':
        // 크레딧 사용 내역 조회
        apiUrl = 'https://drylink.ohmyapp.io/bnb/aggregateForTableWithDocTimeline';
        requestBody = new URLSearchParams({
          metaCode: '_users',
          collectionName: 'aiTicketHistory',
          documentJson: JSON.stringify({
            "pipeline": {
              "$match": { 
                "userJoin": { "$oid": userId }
              },
              "$sort": { "_createTime": -1 },
              "$limit": query?.limit || 10
            }
          })
        }).toString();
        break;
        
      case 'getGenerationHistory':
        // 생성 내역 조회
        apiUrl = 'https://drylink.ohmyapp.io/bnb/aggregateForTableWithDocTimeline';
        const threeDaysAgo = new Date();
        threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
        
        requestBody = new URLSearchParams({
          metaCode: '_users',
          collectionName: 'aiGenerationHistory',
          documentJson: JSON.stringify({
            "pipeline": {
              "$match": { 
                "userId": { "$oid": userId },
                "createdAt": { "$gte": threeDaysAgo.toISOString() }
              },
              "$sort": { "createdAt": -1 },
              "$limit": query?.limit || 50
            }
          })
        }).toString();
        break;
        
      case 'saveGenerationResult':
        // 생성 결과 저장
        apiUrl = 'https://drylink.ohmyapp.io/bnb/create';
        requestBody = new URLSearchParams({
          metaCode: '_users',
          collectionName: 'aiGenerationHistory',
          documentJson: JSON.stringify(data)
        }).toString();
        break;
        
      case 'cleanupExpired':
        // 만료된 데이터 정리
        apiUrl = 'https://drylink.ohmyapp.io/bnb/delete';
        const now = new Date();
        requestBody = new URLSearchParams({
          metaCode: '_users',
          collectionName: 'aiGenerationHistory',
          documentJson: JSON.stringify({
            "userId": { "$oid": userId },
            "expiresAt": { "$lt": now.toISOString() }
          })
        }).toString();
        break;
        
      default:
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({
            success: false,
            error: 'Invalid action'
          })
        };
    }
    
    // Bullnabi API 호출
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': token // 사용자 토큰 사용
      },
      body: requestBody
    });
    
    const responseText = await response.text();
    
    console.log('[Data Proxy] Bullnabi 응답:', {
      action,
      status: response.status,
      length: responseText.length,
      preview: responseText.substring(0, 200)
    });
    
    if (!response.ok) {
      throw new Error(`Bullnabi API error: ${response.status}`);
    }
    
    let jsonData;
    try {
      jsonData = JSON.parse(responseText);
    } catch (parseError) {
      console.error('[Data Proxy] JSON 파싱 실패:', parseError);
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({
          success: false,
          error: 'Invalid response format'
        })
      };
    }
    
    // 토큰 만료 확인
    if (jsonData.code === -110 || jsonData.code === '-110' || jsonData.message?.includes('만료된 토큰')) {
      console.log('[Data Proxy] 사용자 토큰 만료 감지');
      return {
        statusCode: 401,
        headers: corsHeaders,
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
        headers: corsHeaders,
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
      headers: corsHeaders,
      body: JSON.stringify({
        success: false,
        error: jsonData.message || 'Unknown error'
      })
    };
    
  } catch (error) {
    console.error('[Data Proxy] Error:', error);
    
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        success: false,
        error: error.message
      })
    };
  }
};
