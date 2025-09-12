// 맨 위에 수정
console.log('[OpenAI Proxy] VERSION 2.1 - FIXED PARAMS - CACHE BUSTED');
console.log('[OpenAI Proxy] BUILD: 2025-09-12-18:00');

// netlify/functions/openai-proxy.js - 파라미터 수정 버전
exports.config = { timeout: 26 };

exports.handler = async (event, context) => {
  const startTime = Date.now();
  console.log('[OpenAI Proxy] PURE gpt-image-1 Edit API - VERSION 2.1 (FIXED)');
  console.log('[OpenAI Proxy] Remaining time:', context.getRemainingTimeInMillis(), 'ms');
  
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
    console.error('[OpenAI Proxy] Missing API key');
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

    if (!imageBase64 || !prompt) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Missing imageBase64 or prompt' })
      };
    }

    // 🛡️ 24초 타임아웃 보호
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      console.log('[gpt-image-1] ⚠️ 24초 타임아웃 - 강제 중단');
      controller.abort();
    }, 24000);

    try {
      const imageBuffer = Buffer.from(imageBase64, 'base64');
      const boundary = '----gpt1edit' + Date.now();
      
      console.log('[gpt-image-1] FormData created, calling API...');
      
      // 🔧 **수정: response_format 제거** - gpt-image-1 Edit API에서 미지원
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
        'hd',
        // ❌ response_format 제거됨 (Edit API에서 미지원)
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

      const apiStartTime = Date.now();
      
      const response = await fetch('https://api.openai.com/v1/images/edits', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'User-Agent': 'HairGator-gpt-image-1/2.1'
        },
        body: formData,
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      
      const responseTime = Date.now() - apiStartTime;
      const totalTime = Date.now() - startTime;
      
      console.log('[gpt-image-1] API responded in:', responseTime + 'ms');
      console.log('[gpt-image-1] Total time:', totalTime + 'ms');
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
      
      // gpt-image-1 Edit API는 기본적으로 URL로 응답하지만, b64_json도 가능
      if (data.data && data.data[0]) {
        if (data.data[0].b64_json) {
          const resultSize = data.data[0].b64_json.length;
          console.log('[gpt-image-1] Result image size (base64):', Math.round(resultSize / 1024) + 'KB');
        } else if (data.data[0].url) {
          console.log('[gpt-image-1] Result image URL:', data.data[0].url.substring(0, 50) + '...');
        }
      }
      
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          ...data,
          _metadata: {
            processing_method: 'gpt-image-1_Direct_Edit_V2.1_FIXED',
            api_response_time_ms: responseTime,
            total_time_ms: totalTime,
            version: '2.1'
          }
        })
      };

    } catch (fetchError) {
      clearTimeout(timeoutId);
      
      if (fetchError.name === 'AbortError') {
        const totalTime = Date.now() - startTime;
        console.log('[gpt-image-1] ⏰ 24초 타임아웃 도달, total:', totalTime + 'ms');
        return {
          statusCode: 408,
          headers: corsHeaders,
          body: JSON.stringify({ 
            error: 'TIMEOUT',
            message: 'gpt-image-1 request timeout after 24 seconds',
            useGeminiFallback: true,
            total_time_ms: totalTime
          })
        };
      }
      
      throw fetchError;
    }
    
  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error('[gpt-image-1] Error:', error.message);
    console.error('[gpt-image-1] Total time before error:', totalTime + 'ms');
    
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ 
        error: error.message,
        useGeminiFallback: true,
        total_time_ms: totalTime
      })
    };
  }
};
