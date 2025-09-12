// netlify/functions/openai-proxy.js (디버깅 버전)
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

  console.log('[OpenAI Proxy] Environment check:', {
    hasAPIKey: !!process.env.OPENAI_API_KEY,
    keyPrefix: process.env.OPENAI_API_KEY?.substring(0, 10) + '...',
    httpMethod: event.httpMethod,
    bodyLength: event.body?.length
  });

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
    console.log('[OpenAI Proxy] Parsing request body...');
    const requestBody = JSON.parse(event.body);
    const { imageBase64, prompt } = requestBody;
    
    console.log('[OpenAI Proxy] Request parsed:', {
      hasImage: !!imageBase64,
      imageLength: imageBase64?.length,
      promptLength: prompt?.length,
      promptPreview: prompt?.substring(0, 50) + '...'
    });

    // Base64 유효성 검사
    if (!imageBase64 || imageBase64.length < 100) {
      console.error('[OpenAI Proxy] Invalid image data');
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Invalid image data' })
      };
    }

    console.log('[OpenAI Proxy] Creating FormData...');
    
    // Base64를 Buffer로 변환
    const imageBuffer = Buffer.from(imageBase64, 'base64');
    console.log('[OpenAI Proxy] Image buffer created:', imageBuffer.length, 'bytes');
    
    // FormData 생성
    const FormData = require('form-data');
    const formData = new FormData();
    
    formData.append('model', 'gpt-image-1');
    formData.append('prompt', prompt);
    formData.append('input_fidelity', 'high');
    formData.append('quality', 'high');
    formData.append('size', 'auto');
    formData.append('output_format', 'png');
    formData.append('image', imageBuffer, {
      filename: 'image.png',
      contentType: 'image/png'
    });

    console.log('[OpenAI Proxy] FormData created, making API request...');
    
    const startTime = Date.now();
    
    const response = await fetch('https://api.openai.com/v1/images/edits', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        ...formData.getHeaders()
      },
      body: formData
    });

    const responseTime = Date.now() - startTime;
    console.log('[OpenAI Proxy] API response received:', {
      status: response.status,
      statusText: response.statusText,
      responseTime: responseTime + 'ms',
      headers: Object.fromEntries(response.headers.entries())
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[OpenAI Proxy] API Error Response:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText
      });
      
      return {
        statusCode: response.status,
        headers: corsHeaders,
        body: JSON.stringify({ 
          error: `OpenAI API Error: ${response.status} ${response.statusText}`,
          details: errorText
        })
      };
    }

    console.log('[OpenAI Proxy] Parsing JSON response...');
    const data = await response.json();
    
    console.log('[OpenAI Proxy] Success:', {
      hasData: !!data.data,
      dataLength: data.data?.length,
      hasImage: !!(data.data?.[0]?.b64_json),
      imageLength: data.data?.[0]?.b64_json?.length
    });

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify(data)
    };
    
  } catch (error) {
    console.error('[OpenAI Proxy] Fatal Error:', {
      name: error.name,
      message: error.message,
      stack: error.stack
    });
    
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ 
        error: 'Internal server error',
        details: error.message,
        type: error.name
      })
    };
  }
};
