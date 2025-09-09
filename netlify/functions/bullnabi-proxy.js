// netlify/functions/test-proxy.js
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
  
  // 간단한 테스트 요청
  try {
    const testRequest = () => {
      return new Promise((resolve, reject) => {
        const options = {
          hostname: 'jihwanworld.ohmyapp.io',
          port: 80,
          path: '/bnb/aggregateForTableWithDocTimeline',
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        };
        
        // 테스트 데이터
        const formData = new URLSearchParams();
        formData.append('metaCode', 'community');
        formData.append('collectionName', '_users');
        formData.append('documentJson', '{"_id":"670097361f31a7f31bd87a1b"}');
        const postData = formData.toString();
        
        options.headers['Content-Length'] = Buffer.byteLength(postData);
        
        const req = http.request(options, (res) => {
          let data = '';
          
          res.on('data', (chunk) => {
            data += chunk;
          });
          
          res.on('end', () => {
            resolve({
              success: true,
              statusCode: res.statusCode,
              headers: res.headers,
              data: data
            });
          });
        });
        
        req.on('error', (error) => {
          resolve({
            success: false,
            error: error.message,
            code: error.code
          });
        });
        
        req.write(postData);
        req.end();
      });
    };
    
    const result = await testRequest();
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        test: 'HTTP module test',
        result: result
      })
    };
    
  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        test: 'failed',
        error: error.message
      })
    };
  }
};
