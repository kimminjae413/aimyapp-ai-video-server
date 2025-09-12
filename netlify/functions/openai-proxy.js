// netlify/functions/openai-proxy.js - 응답 디버깅 추가

exports.config = { timeout: 26 };

exports.handler = async (event, context) => {
  console.log('[OpenAI Proxy] Pro Plan - Function started');
  
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
      body: JSON.stringify({ error: 'OpenAI API key not configured' })
    };
  }

  try {
    const { imageBase64, prompt } = JSON.parse(event.body);
    
    console.log('[OpenAI Proxy] Processing request:', {
      hasImage: !!imageBase64,
      imageSize: imageBase64?.length,
      promptLength: prompt?.length,
      remainingTime: context.getRemainingTimeInMillis()
    });

    const imageBuffer = Buffer.from(imageBase64, 'base64');
    const sizeInMB = (imageBase64.length * 3) / (4 * 1024 * 1024);
    console.log('[OpenAI Proxy] Image size:', sizeInMB.toFixed(2) + 'MB');
    
    // FormData 생성
    const boundary = '----formdata-pro-' + Math.random().toString(36).substring(2, 15);
    const formData = createFormData(boundary, imageBase64, prompt);
    
    console.log('[OpenAI Proxy] FormData created, size:', formData.length);
    
    const startTime = Date.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 24000);
    
    try {
      const response = await fetch('https://api.openai.com/v1/images/edits', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'User-Agent': 'Netlify-Pro/1.0'
        },
        body: formData,
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      const responseTime = Date.now() - startTime;
      console.log('[OpenAI Proxy] API response:', {
        status: response.status,
        responseTime: responseTime + 'ms',
        remaining: context.getRemainingTimeInMillis()
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[OpenAI Proxy] API Error:', {
          status: response.status,
          error: errorText.substring(0, 200)
        });
        
        return {
          statusCode: response.status,
          headers: corsHeaders,
          body: JSON.stringify({ 
            error: `OpenAI API Error: ${response.status}`,
            details: errorText,
            useGeminiFallback: true
          })
        };
      }

      const data = await response.json();
      
      // 🔍 상세한 응답 로깅 추가
      console.log('[OpenAI Proxy] Raw API Response Structure:', {
        hasData: !!data.data,
        dataLength: data.data?.length,
        firstItemKeys: data.data?.[0] ? Object.keys(data.data[0]) : 'none',
        hasB64Json: !!(data.data?.[0]?.b64_json),
        hasUrl: !!(data.data?.[0]?.url),
        responseKeys: Object.keys(data)
      });
      
      // 응답 데이터 검증 및 정규화
      if (data.data && data.data.length > 0) {
        const firstImage = data.data[0];
        
        // URL 형태의 응답을 b64_json으로 변환 시도
        if (firstImage.url && !firstImage.b64_json) {
          console.log('[OpenAI Proxy] Converting URL response to b64_json...');
          try {
            const imageResponse = await fetch(firstImage.url);
            const imageBuffer = await imageResponse.arrayBuffer();
            const base64Data = Buffer.from(imageBuffer).toString('base64');
            
            // 응답 형식 정규화
            data.data[0].b64_json = base64Data;
            console.log('[OpenAI Proxy] URL to b64_json conversion successful');
          } catch (conversionError) {
            console.error('[OpenAI Proxy] URL conversion failed:', conversionError.message);
          }
        }
      }
      
      console.log('[OpenAI Proxy] Success - Images:', data?.data?.length);
      
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify(data)
      };
      
    } catch (fetchError) {
      clearTimeout(timeoutId);
      
      if (fetchError.name === 'AbortError') {
        console.log('[OpenAI Proxy] 24s timeout reached');
        return {
          statusCode: 408,
          headers: corsHeaders,
          body: JSON.stringify({ 
            error: 'TIMEOUT',
            message: 'OpenAI request timeout after 24 seconds',
            useGeminiFallback: true
          })
        };
      }
      
      throw fetchError;
    }
    
  } catch (error) {
    console.error('[OpenAI Proxy] Fatal error:', error.message);
    
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

// FormData 생성 함수
function createFormData(boundary, imageBase64, prompt) {
  const imageBuffer = Buffer.from(imageBase64, 'base64');
  
  const formParts = [];
  
  // model
  formParts.push(`--${boundary}`);
  formParts.push('Content-Disposition: form-data; name="model"');
  formParts.push('');
  formParts.push('dall-e-2'); // DALL-E 2가 더 안정적
  
  // prompt
  formParts.push(`--${boundary}`);
  formParts.push('Content-Disposition: form-data; name="prompt"');
  formParts.push('');
  formParts.push(prompt);
  
  // size
  formParts.push(`--${boundary}`);
  formParts.push('Content-Disposition: form-data; name="size"');
  formParts.push('');
  formParts.push('1024x1024');
  
  // n
  formParts.push(`--${boundary}`);
  formParts.push('Content-Disposition: form-data; name="n"');
  formParts.push('');
  formParts.push('1');
  
  // response_format 추가
  formParts.push(`--${boundary}`);
  formParts.push('Content-Disposition: form-data; name="response_format"');
  formParts.push('');
  formParts.push('b64_json');
  
  // image file
  formParts.push(`--${boundary}`);
  formParts.push('Content-Disposition: form-data; name="image"; filename="input.png"');
  formParts.push('Content-Type: image/png');
  formParts.push('');
  
  // 조합
  const textPart = formParts.join('\r\n') + '\r\n';
  const closingBoundary = `\r\n--${boundary}--\r\n`;
  
  return Buffer.concat([
    Buffer.from(textPart, 'utf8'),
    imageBuffer,
    Buffer.from(closingBoundary, 'utf8')
  ]);
}
