// netlify/functions/openai-proxy.js - 공식 문서 기준 완전 수정
exports.config = { timeout: 26 };

exports.handler = async (event, context) => {
  const startTime = Date.now();
  console.log('[OpenAI Proxy] 공식 문서 기준 gpt-image-1 Edit API - VERSION 3.0');
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
    
    console.log('[gpt-image-1] 공식 문서 방식 호출 시작');
    console.log('[gpt-image-1] Image size:', Math.round(imageBase64?.length / 1024) + 'KB');
    console.log('[gpt-image-1] Prompt length:', prompt?.length);

    if (!imageBase64 || !prompt) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Missing imageBase64 or prompt' })
      };
    }

    // 타임아웃 보호 (24초)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      console.log('[gpt-image-1] ⚠️ 24초 타임아웃 - 강제 중단');
      controller.abort();
    }, 24000);

    try {
      const imageBuffer = Buffer.from(imageBase64, 'base64');
      const boundary = '----OpenAIFormBoundary' + Date.now();
      
      // 🔥 공식 문서 기준 FormData 생성
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
        'Content-Disposition: form-data; name="output_format"',
        '',
        'png',
        `--${boundary}`,
        // 🆕 공식 문서: image[] 배열 형태
        'Content-Disposition: form-data; name="image[]"; filename="input.png"',
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

      console.log('[gpt-image-1] 공식 문서 기준 FormData 생성 완료, API 호출...');
      const apiStartTime = Date.now();
      
      const response = await fetch('https://api.openai.com/v1/images/edits', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': `multipart/form-data; boundary=${boundary}`
        },
        body: formData,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      const responseTime = Date.now() - apiStartTime;
      const totalTime = Date.now() - startTime;
      
      console.log('[gpt-image-1] API 응답:', responseTime + 'ms');
      console.log('[gpt-image-1] Total time:', totalTime + 'ms');
      console.log('[gpt-image-1] Status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[gpt-image-1] API Error:', response.status, errorText.substring(0, 300));
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
      
      console.log('[gpt-image-1] 성공! Response has data:', !!data.data);
      console.log('[gpt-image-1] Has b64_json:', !!(data.data?.[0]?.b64_json));
      
      if (data.data && data.data[0] && data.data[0].b64_json) {
        const resultSize = data.data[0].b64_json.length;
        console.log('[gpt-image-1] Result image size:', Math.round(resultSize / 1024) + 'KB');
      }
      
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          ...data,
          _metadata: {
            processing_method: 'gpt-image-1_Official_Spec_V3.0',
            api_response_time_ms: responseTime,
            total_time_ms: totalTime,
            version: '3.0-OFFICIAL'
          }
        })
      };

    } catch (fetchError) {
      clearTimeout(timeoutId);
      
      if (fetchError.name === 'AbortError') {
        const totalTime = Date.now() - startTime;
        console.log('[gpt-image-1] ⏰ 24초 타임아웃');
        return {
          statusCode: 408,
          headers: corsHeaders,
          body: JSON.stringify({ 
            error: 'TIMEOUT',
            message: 'gpt-image-1 timeout after 24 seconds',
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
