// netlify/functions/bullnabi-proxy.js
const http = require('http');

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
    
    // API 엔드포인트 설정
    let path = '/bnb';
    if (action === 'aggregate') {
      path += '/aggregateForTableWithDocTimeline';
    } else if (action === 'create') {
      path += '/create';
    } else if (action === 'update') {
      path += '/update';
    } else {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid action' })
      };
    }
    
    // FormData 생성
    const formData = new URLSearchParams();
    formData.append('metaCode', metaCode || 'community');
    formData.append('collectionName', collectionName);
    
    // documentJson 처리
    if (typeof documentJson === 'string') {
      formData.append('documentJson', documentJson);
    } else {
      formData.append('documentJson', JSON.stringify(documentJson));
    }
    
    const postData = formData.toString();
    
    console.log('[Bullnabi Proxy] Request details:');
    console.log('- Path:', path);
    console.log('- Collection:', collectionName);
    console.log('- DocumentJson:', documentJson);
    console.log('- FormData:', postData);
    
    // HTTP 요청을 Promise로 감싸기
    const makeRequest = () => {
      return new Promise((resolve, reject) => {
        const options = {
          hostname: 'jihwanworld.ohmyapp.io',
          port: 80,
          path: path,
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': Buffer.byteLength(postData)
          }
        };
        
        const req = http.request(options, (res) => {
          let data = '';
          
          res.on('data', (chunk) => {
            data += chunk;
          });
          
          res.on('end', () => {
            console.log('[Bullnabi Proxy] Response received:');
            console.log('- Status:', res.statusCode);
            console.log('- Data:', data);
            
            resolve({
              statusCode: res.statusCode,
              data: data
            });
          });
        });
        
        req.on('error', (error) => {
          console.error('[Bullnabi Proxy] Request error:', error);
          reject(error);
        });
        
        // 요청 본문 전송
        req.write(postData);
        req.end();
      });
    };
    
    // 요청 실행
    const result = await makeRequest();
    
    // JSON 파싱 시도
    let jsonData;
    try {
      jsonData = JSON.parse(result.data);
      console.log('[Bullnabi Proxy] Parsed JSON:', jsonData);
    } catch (e) {
      console.error('[Bullnabi Proxy] JSON parse failed:', e);
      // 파싱 실패시 원본 반환
      jsonData = { 
        code: "0", 
        message: "Response parsing failed", 
        rawData: result.data 
      };
    }
    
    return {
      statusCode: result.statusCode || 200,
      headers,
      body: JSON.stringify(jsonData)
    };
    
  } catch (error) {
    console.error('[Bullnabi Proxy] Handler error:', error);
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
