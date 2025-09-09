// netlify/functions/bullnabi-proxy.js
const http = require('http');

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
    formData.append('metaCode', metaCode || '_users');
    formData.append('collectionName', collectionName);
    
    if (typeof documentJson === 'string') {
      formData.append('documentJson', documentJson);
    } else {
      formData.append('documentJson', JSON.stringify(documentJson));
    }
    
    const postData = formData.toString();
    
    console.log('[Bullnabi Proxy] Request to: http://drylink.ohmyapp.io' + path);
    console.log('[Bullnabi Proxy] Data:', postData);
    
    // HTTP 요청 Promise로 감싸기
    const makeRequest = () => {
      return new Promise((resolve, reject) => {
        const options = {
          hostname: 'drylink.ohmyapp.io',
          port: 80,
          path: path,
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': Buffer.byteLength(postData)
          }
        };
        
        // JWT 토큰이 있으면 추가
        if (token) {
          options.headers['Authorization'] = `Bearer ${token}`;
        }
        
        const req = http.request(options, (res) => {
          let data = '';
          
          res.on('data', (chunk) => {
            data += chunk;
          });
          
          res.on('end', () => {
            console.log('[Bullnabi Proxy] Response status:', res.statusCode);
            console.log('[Bullnabi Proxy] Response:', data.substring(0, 500));
            
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
        
        req.setTimeout(10000, () => {
          req.destroy();
          reject(new Error('Request timeout'));
        });
        
        req.write(postData);
        req.end();
      });
    };
    
    const result = await makeRequest();
    
    // JSON 파싱 시도
    let jsonData;
    try {
      jsonData = JSON.parse(result.data);
    } catch (e) {
      console.error('[Bullnabi Proxy] Parse error:', e);
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
