// 30초 타임아웃 설정
exports.config = {
  timeout: 30000
};

exports.handler = async (event, context) => {
  console.log('[OpenAI Proxy] Function started');
  
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };
  
  if (event.httpMethod === 'OPTIONS') {
    console.log('[OpenAI Proxy] OPTIONS request');
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('[OpenAI Proxy] API key not found');
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'OpenAI API key not configured' })
    };
  }

  try {
    const { imageBase64, prompt } = JSON.parse(event.body);
    console.log('[OpenAI Proxy] Request parsed:', {
      hasImage: !!imageBase64,
      imageLength: imageBase64?.length,
      promptLength: prompt?.length
    });

    // Base64를 Buffer로 변환
    const imageBuffer = Buffer.from(imageBase64, 'base64');
    console.log('[OpenAI Proxy] Image buffer created:', imageBuffer.length, 'bytes');
    
    // 수동으로 multipart/form-data 생성
    const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
    
    let body = '';
    body += `--${boundary}\r\n`;
    body += 'Content-Disposition: form-data; name="model"\r\n\r\n';
    body += 'gpt-image-1\r\n';
    
    body += `--${boundary}\r\n`;
    body += 'Content-Disposition: form-data; name="prompt"\r\n\r\n';
    body += `${prompt}\r\n`;
    
    body += `--${boundary}\r\n`;
    body += 'Content-Disposition: form-data; name="input_fidelity"\r\n\r\n';
    body += 'high\r\n';
    
    body += `--${boundary}\r\n`;
    body += 'Content-Disposition: form-data; name="quality"\r\n\r\n';
    body += 'high\r\n';
    
    body += `--${boundary}\r\n`;
    body += 'Content-Disposition: form-data; name="size"\r\n\r\n';
    body += 'auto\r\n';
    
    body += `--${boundary}\r\n`;
    body += 'Content-Disposition: form-data; name="image"; filename="image.png"\r\n';
    body += 'Content-Type: image/png\r\n\r\n';
    
    // 텍스트 부분을 Buffer로 변환
    const textBuffer = Buffer.from(body, 'utf8');
    const endBuffer = Buffer.from(`\r\n--${boundary}--\r\n`, 'utf8');
    
    // 전체 body 조합
    const fullBody = Buffer.concat([textBuffer, imageBuffer, endBuffer]);
    
    console.log('[OpenAI Proxy] Manual FormData created, size:', fullBody.length);

    const startTime = Date.now();
    
    // 타임아웃 제어를 위한 AbortController 추가
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      console.log('[OpenAI Proxy] Request timeout after 25 seconds');
      controller.abort();
    }, 25000); // 25초 후 중단 (Function 타임아웃 30초보다 짧게)
    
    const response = await fetch('https://api.openai.com/v1/images/edits', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': fullBody.length.toString()
      },
      body: fullBody,
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    
    const responseTime = Date.now() - startTime;
    console.log('[OpenAI Proxy] API response received:', {
      status: response.status,
      responseTime: responseTime + 'ms'
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[OpenAI Proxy] API Error:', errorText);
      
      return {
        statusCode: response.status,
        headers: corsHeaders,
        body: JSON.stringify({ 
          error: `OpenAI API Error: ${response.status}`,
          details: errorText
        })
      };
    }

    const data = await response.json();
    console.log('[OpenAI Proxy] Success');

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify(data)
    };
    
  } catch (error) {
    console.error('[OpenAI Proxy] Error:', error.message);
    
    if (error.name === 'AbortError') {
      return {
        statusCode: 408,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Request timeout' })
      };
    }
    
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: error.message })
    };
  }
};
