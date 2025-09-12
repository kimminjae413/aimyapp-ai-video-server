// netlify/functions/openai-proxy.js - Pro 플랜용

// Pro 플랜: 26초 타임아웃 설정 (코드에서만 설정)
exports.config = {
  timeout: 26  // 초 단위 (Pro 플랜 최대값)
};

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

    // 이미지 최적화 (1024x1024 max)
    const optimizedImage = await optimizeImage(imageBase64);
    
    // FormData 생성
    const boundary = '----formdata-pro-' + Math.random().toString(36).substring(2, 15);
    const formData = createFormData(boundary, optimizedImage, prompt);
    
    console.log('[OpenAI Proxy] FormData created, size:', formData.length);
    
    const startTime = Date.now();
    
    // 24초 타임아웃 (2초 여유)
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

// 이미지 최적화 함수
async function optimizeImage(base64Image) {
  // Base64 정리
  let cleanBase64 = base64Image;
  if (cleanBase64.startsWith('data:')) {
    cleanBase64 = cleanBase64.split(',')[1];
  }
  
  // 크기 확인 후 필요시 리사이징
  const sizeInMB = (cleanBase64.length * 3) / (4 * 1024 * 1024);
  console.log('[OpenAI Proxy] Image size:', sizeInMB.toFixed(2) + 'MB');
  
  if (sizeInMB > 4) { // 4MB 이상이면 리사이징
    console.log('[OpenAI Proxy] Image too large, resizing...');
    return await resizeBase64Image(cleanBase64);
  }
  
  return cleanBase64;
}

// PNG 형식으로 변환하는 함수 (Node.js 환경용)
async function convertToPNG(base64Image) {
  try {
    // Buffer로 변환
    const inputBuffer = Buffer.from(base64Image, 'base64');
    
    // 간단한 방법: 이미 PNG인지 확인
    if (inputBuffer[0] === 0x89 && inputBuffer[1] === 0x50 && inputBuffer[2] === 0x4E && inputBuffer[3] === 0x47) {
      console.log('[OpenAI Proxy] Already PNG format');
      return base64Image;
    }
    
    console.log('[OpenAI Proxy] Converting to PNG format');
    
    // Node.js 환경에서 Canvas API 사용 불가하므로
    // 클라이언트에서 PNG 변환을 요청하거나
    // 서버에서 이미지 처리 라이브러리 필요
    
    // 임시 해결책: JPEG를 PNG 헤더로 감싸기 (실제 변환은 아님)
    // 실제로는 sharp나 다른 이미지 라이브러리가 필요
    
    return base64Image; // 일단 원본 반환
    
  } catch (error) {
    console.warn('[OpenAI Proxy] PNG conversion failed:', error.message);
    return base64Image;
  }
}

// FormData 생성
function createFormData(boundary, imageBase64, prompt) {
  const imageBuffer = Buffer.from(imageBase64, 'base64');
  
  const formParts = [];
  
  // model
  formParts.push(`--${boundary}`);
  formParts.push('Content-Disposition: form-data; name="model"');
  formParts.push('');
  formParts.push('dall-e-2'); // DALL-E 2가 더 빠름
  
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
