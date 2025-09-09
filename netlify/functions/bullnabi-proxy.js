// netlify/functions/bullnabi-proxy.js
const https = require('https');
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
    
    console.log('[Bullnabi Proxy] Trying HTTPS first: https://drylink.ohmyapp.io' + path);
    console.log('[Bullnabi Proxy] Data:', postData);
    
    // HTTPS와 HTTP 둘 다 시도하는 함수
    const makeRequest = (useHttps = true) => {
      return new Promise((resolve, reject) => {
        const protocol = useHttps ? https : http;
        const options = {
          hostname: 'drylink.ohmyapp.io',
          port: useHttps ? 443 : 80,
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
        
        const req = protocol.request(options, (res) => {
          let data = '';
          
          // 301/302 리다이렉트 처리
          if (res.statusCode === 301 || res.statusCode === 302) {
            console.log('[Bullnabi Proxy] Redirect detected:', res.headers.location);
            if (!useHttps) {
              // HTTP에서 리다이렉트되면 HTTPS로 재시도
              console.log('[Bullnabi Proxy] Retrying with HTTPS...');
              makeRequest(true).then(resolve).catch(reject);
              return;
            }
          }
          
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
          console.error(`[Bullnabi Proxy] ${useHttps ? 'HTTPS' : 'HTTP'} error:`, error.message);
          if (useHttps) {
            // HTTPS 실패시 HTTP로 재시도
            console.log('[Bullnabi Proxy] HTTPS failed, trying HTTP...');
            makeRequest(false).then(resolve).catch(reject);
          } else {
            reject(error);
          }
        });
        
        req.setTimeout(10000, () => {
          req.destroy();
          reject(new Error('Request timeout'));
        });
        
        req.write(postData);
        req.end();
      });
    };
    
    // HTTPS부터 시도
    const result = await makeRequest(true);
    
    // JSON 파싱 시도
    let jsonData;
    try {
      if (result.data) {
        jsonData = JSON.parse(result.data);
      } else {
        jsonData = { code: "0", message: "Empty response" };
      }
    } catch (e) {
      console.error('[Bullnabi Proxy] Parse error:', e);
      jsonData = { 
        code: "0", 
        message: "Response parsing failed", 
        rawData: result.data,
        statusCode: result.statusCode
      };
    }
    
    return {
      statusCode: 200,
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
