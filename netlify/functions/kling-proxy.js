// netlify/functions/kling-proxy.js - URL 검증 및 복구 기능 추가
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

// 🆕 URL 유효성 검증 함수
async function validateVideoUrl(videoUrl) {
  try {
    console.log('🔍 [Proxy] URL 검증:', videoUrl.substring(0, 80) + '...');
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // 8초 타임아웃
    
    try {
      const response = await fetch(videoUrl, {
        method: 'HEAD',
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; KlingProxy/1.0)'
        }
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        console.log('✅ [Proxy] URL 유효함');
        return { isValid: true };
      } else {
        console.warn('⚠️ [Proxy] URL 무효:', response.status);
        return { isValid: false, error: `HTTP ${response.status}` };
      }
    } catch (fetchError) {
      clearTimeout(timeoutId);
      throw fetchError;
    }
  } catch (error) {
    console.error('❌ [Proxy] URL 검증 실패:', error.message);
    return { isValid: false, error: error.message };
  }
}

// 🆕 URL 복구 시도 함수
async function attemptUrlRecovery(originalUrl, taskId) {
  try {
    console.log('🔧 [Proxy] URL 복구 시도...');
    
    // 1. 잘린 URL 복구
    let cleanedUrl = originalUrl.replace('...[truncated]', '');
    if (!cleanedUrl.endsWith('.mp4')) {
      cleanedUrl += '.mp4';
    }
    
    const urlsToTry = [cleanedUrl];
    
    // 2. taskId 기반 URL 패턴들
    if (taskId) {
      urlsToTry.push(
        `https://v15-kling.klingai.com/bs2/upload-ylab-stunt-sgp/se/stream_lake_m2v_img2video_v21_std_v36_v2/${taskId}_raw_video.mp4`,
        `https://v15-kling.klingai.com/bs2/upload/${taskId}.mp4`,
        `https://v15-kling.klingai.com/bs2/${taskId}_video.mp4`
      );
    }
    
    // 3. 각 URL 테스트
    for (const testUrl of urlsToTry) {
      const validation = await validateVideoUrl(testUrl);
      if (validation.isValid) {
        console.log('✅ [Proxy] URL 복구 성공:', testUrl);
        return testUrl;
      }
    }
    
    console.warn('❌ [Proxy] 모든 URL 복구 시도 실패');
    return null;
  } catch (error) {
    console.error('❌ [Proxy] URL 복구 중 오류:', error);
    return null;
  }
}

// 🆕 응답 후처리 함수 (URL 검증 포함)
async function processVideoResponse(responseData, taskId) {
  try {
    const data = JSON.parse(responseData);
    
    // 성공적으로 완료된 비디오 작업인지 확인
    if (data.data && 
        data.data.task_status === 'succeed' && 
        data.data.task_result && 
        data.data.task_result.videos && 
        data.data.task_result.videos.length > 0) {
      
      const originalUrl = data.data.task_result.videos[0].url;
      console.log('🎬 [Proxy] 비디오 URL 받음:', originalUrl.substring(0, 80) + '...');
      
      // URL 검증
      const validation = await validateVideoUrl(originalUrl);
      
      if (validation.isValid) {
        console.log('✅ [Proxy] URL 검증 성공');
        return responseData; // 원본 응답 그대로 반환
      } else {
        console.warn('⚠️ [Proxy] URL 검증 실패, 복구 시도');
        
        // URL 복구 시도
        const recoveredUrl = await attemptUrlRecovery(originalUrl, taskId);
        
        if (recoveredUrl) {
          // 응답 데이터에서 URL 교체
          data.data.task_result.videos[0].url = recoveredUrl;
          console.log('✅ [Proxy] 복구된 URL로 교체 완료');
          return JSON.stringify(data);
        } else {
          console.warn('⚠️ [Proxy] URL 복구 실패, 원본 URL 유지');
          return responseData; // 복구 실패시 원본 반환
        }
      }
    }
    
    return responseData; // 비디오 결과가 아니면 원본 반환
  } catch (error) {
    console.error('❌ [Proxy] 응답 후처리 실패:', error);
    return responseData; // 에러 시 원본 반환
  }
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
    console.error('❌ [Proxy] Missing API keys:', {
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
    console.log('✅ [Proxy] JWT token generated successfully');
    
    const { method, endpoint, body } = JSON.parse(event.body);
    
    // endpoint가 account로 시작하면 account API 사용
    let url;
    if (endpoint && endpoint.includes('account')) {
      url = `https://api-singapore.klingai.com/v1${endpoint}`;
    } else {
      url = `https://api-singapore.klingai.com/v1/videos/image2video${endpoint || ''}`;
    }
    
    console.log(`🚀 [Proxy] ${method} request to:`, url);
    
    // TaskID 추출 (URL 복구용)
    const taskId = endpoint ? endpoint.replace('/', '') : (body && body.external_task_id);
    
    const response = await fetch(url, {
      method: method || 'POST',
      headers: {
        'Authorization': `Bearer ${jwtToken}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined
    });
    
    const responseData = await response.text();
    console.log(`📊 [Proxy] Response status: ${response.status}, size: ${responseData.length}`);
    
    // 🆕 GET 요청 (상태 확인)이고 성공 응답인 경우 URL 검증 및 복구
    if (method === 'GET' && response.ok) {
      const processedData = await processVideoResponse(responseData, taskId);
      return {
        statusCode: response.status,
        headers,
        body: processedData
      };
    }
    
    // 일반 응답
    return {
      statusCode: response.status,
      headers,
      body: responseData
    };
  } catch (error) {
    console.error('❌ [Proxy] Error:', error);
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
