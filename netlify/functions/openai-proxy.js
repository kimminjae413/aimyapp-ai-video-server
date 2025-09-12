// netlify/functions/openai-proxy.js - 순수 gpt-image-1 Edit API

exports.config = { timeout: 26 };

exports.handler = async (event, context) => {
  console.log('[OpenAI Proxy] PURE gpt-image-1 Edit API - NO GPT4V - VERSION 2.0');
  
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };
  
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'API key missing' })
    };
  }

  try {
    const { imageBase64, prompt } = JSON.parse(event.body);
    
    console.log('[gpt-image-1] Direct Edit API call starting');
    console.log('[gpt-image-1] Image size:', Math.round(imageBase64?.length / 1024) + 'KB');
    console.log('[gpt-image-1] Prompt length:', prompt?.length);

    const imageBuffer = Buffer.from(imageBase64, 'base64');
    const boundary = '----gpt1edit' + Date.now();
    
    // gpt-image-1 Edit API FormData
    const formParts = [
      `--${boundary}`,
      'Content-Disposition: form-data; name="model"',
      '',
      'gpt-image-1',
      `--${boundary}`,
      'Content-Disposition: form-data; name="prompt"',
      '',
      prompt,
      `--${boundary}`,
      'Content-Disposition: form-data; name="size"',
      '',
      'auto',
      `--${boundary}`,
      'Content-Disposition: form-data; name="input_fidelity"',
      '',
      'high',
      `--${boundary}`,
      'Content-Disposition: form-data; name="quality"',
      '',
      'high',
      `--${boundary}`,
      'Content-Disposition: form-data; name="image"; filename="input.png"',
      'Content-Type: image/png',
      ''
    ];
    
    const textPart = formParts.join('\r\n') + '\r\n';
    const closingBoundary = `\r\n--${boundary}--\r\n`;
    
    const formData = Buffer.concat([
      Buffer.from(textPart, 'utf8'),
      imageBuffer,
      Buffer.from(closingBoundary, 'utf8')
    ]);

    console.log('[gpt-image-1] FormData created, calling API...');
    const startTime = Date.now();
    
    // 직접 gpt-image-1 Edit API 호출
    const response = await fetch('https://api.openai.com/v1/images/edits', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`
      },
      body: formData
    });

    const responseTime = Date.now() - startTime;
    console.log('[gpt-image-1] API responded in:', responseTime + 'ms');
    console.log('[gpt-image-1] Status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[gpt-image-1] API Error:', response.status, errorText.substring(0, 200));
      return {
        statusCode: response.status,
        headers: corsHeaders,
        body: JSON.stringify({ 
          error: `gpt-image-1 API Error: ${response.status}`,
          details: errorText.substring(0, 100),
          useGeminiFallback: true
        })
      };
    }

    const data = await response.json();
    
    console.log('[gpt-image-1] Success! Response has data:', !!data.data);
    console.log('[gpt-image-1] Has b64_json:', !!(data.data?.[0]?.b64_json));
    
    // gpt-image-1은 항상 base64로 응답
    if (data.data && data.data[0] && data.data[0].b64_json) {
      const resultSize = data.data[0].b64_json.length;
      console.log('[gpt-image-1] Result image size:', Math.round(resultSize / 1024) + 'KB');
    }
    
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        ...data,
        processing_method: 'gpt-image-1_Direct_Edit',
        response_time_ms: responseTime
      })
    };
    
  } catch (error) {
    console.error('[gpt-image-1] Error:', error.message);
    
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ 
        error: error.message,
        useGeminiFallback: true
      })
    };
  }
};
