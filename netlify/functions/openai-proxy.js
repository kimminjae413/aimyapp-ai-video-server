// netlify/functions/openai-proxy.js - 타임아웃 해결 + 강력한 얼굴 변환

exports.config = { timeout: 26 };

exports.handler = async (event, context) => {
  console.log('[OpenAI Proxy] 🎯 SIMPLE & POWERFUL - 타임아웃 해결 버전');
  
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
    
    console.log('[OpenAI Proxy] 📊 단순화된 처리 시작:', {
      hasImage: !!imageBase64,
      imageSize: Math.round(imageBase64?.length / 1024) + 'KB',
      promptLength: prompt?.length,
      remainingTime: context.getRemainingTimeInMillis()
    });

    // 🔥 극대화된 얼굴 변환 프롬프트 (복잡한 분석 없이 바로 적용)
    const extremePrompt = `
EXTREME FACE REPLACEMENT MISSION:

Transform the face to: ${prompt}

CRITICAL RULES:
- OBLITERATE original facial features completely
- CREATE entirely different person with MAXIMUM intensity
- ZERO resemblance to original face
- Make transformation DRAMATIC and OBVIOUS

SPECIFIC CHANGES:
- Face shape: Complete reconstruction
- Eyes: Totally different size and shape  
- Nose: Completely different structure
- Mouth: Different lips and expression
- Skin: Different texture and tone

PRESERVE EXACTLY:
- Hair style and color (100% identical)
- Background (100% identical)  
- Clothing (100% identical)
- Pose (100% identical)

TRANSFORMATION LEVEL: MAXIMUM
    `.trim();

    console.log('[OpenAI Proxy] 🎯 극대화된 프롬프트 생성:', extremePrompt.length, '자');

    const imageBuffer = Buffer.from(imageBase64, 'base64');
    console.log('[OpenAI Proxy] 📷 이미지 처리:', Math.round(imageBuffer.length / 1024) + 'KB');
    
    const boundary = '----extreme-face-' + Math.random().toString(36).substring(2, 15);
    const formData = createExtremeFormData(boundary, imageBase64, extremePrompt);
    
    const startTime = Date.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 23000); // 23초로 단축
    
    try {
      // 🚀 단순하고 강력한 Edit API 호출
      const response = await fetch('https://api.openai.com/v1/images/edits', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'User-Agent': 'extreme-face-transform/1.0'
        },
        body: formData,
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      const responseTime = Date.now() - startTime;
      
      console.log('[OpenAI Proxy] ⚡ API 응답:', {
        status: response.status,
        responseTime: responseTime + 'ms',
        remaining: context.getRemainingTimeInMillis()
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[OpenAI Proxy] ❌ API 오류:', {
          status: response.status,
          error: errorText.substring(0, 200)
        });
        
        return {
          statusCode: response.status,
          headers: corsHeaders,
          body: JSON.stringify({ 
            error: `OpenAI API Error: ${response.status}`,
            details: errorText.substring(0, 100),
            useGeminiFallback: true
          })
        };
      }

      const data = await response.json();
      
      // 🔍 결과 검증
      console.log('[OpenAI Proxy] 🔬 결과 분석:', {
        hasData: !!data.data,
        dataLength: data.data?.length || 0,
        hasB64Json: !!(data.data?.[0]?.b64_json),
        b64Length: data.data?.[0]?.b64_json?.length || 0
      });
      
      // 실제 변환 검증
      if (data.data && data.data[0] && data.data[0].b64_json) {
        const resultBase64 = data.data[0].b64_json;
        const originalSize = imageBase64.length;
        const resultSize = resultBase64.length;
        const sizeDiff = Math.abs(resultSize - originalSize);
        const changePercent = ((sizeDiff / originalSize) * 100).toFixed(1);
        
        console.log('[OpenAI Proxy] 📊 변환 검증:', {
          originalSize: Math.round(originalSize / 1024) + 'KB',
          resultSize: Math.round(resultSize / 1024) + 'KB',
          changePercent: changePercent + '%',
          likely_transformed: sizeDiff > 1000 ? '✅ 변환됨' : '⚠️ 미미한 변화',
          totalTime: responseTime + 'ms'
        });
        
        // URL 응답을 base64로 변환 (필요시)
        if (data.data[0].url && !data.data[0].b64_json) {
          console.log('[OpenAI Proxy] 🔄 URL을 base64로 변환 중...');
          try {
            const imageResponse = await fetch(data.data[0].url);
            const imageBuffer = await imageResponse.arrayBuffer();
            const base64Data = Buffer.from(imageBuffer).toString('base64');
            
            data.data[0].b64_json = base64Data;
            console.log('[OpenAI Proxy] ✅ URL → base64 변환 완료');
          } catch (conversionError) {
            console.error('[OpenAI Proxy] ❌ URL 변환 실패:', conversionError.message);
          }
        }
      }
      
      console.log('[OpenAI Proxy] ✅ 처리 완료 - 총 소요시간:', responseTime + 'ms');
      
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          ...data,
          processing_method: 'Extreme_Face_Edit_API',
          response_time: responseTime + 'ms'
        })
      };
      
    } catch (fetchError) {
      clearTimeout(timeoutId);
      
      if (fetchError.name === 'AbortError') {
        console.log('[OpenAI Proxy] ⏰ 23초 타임아웃');
        return {
          statusCode: 408,
          headers: corsHeaders,
          body: JSON.stringify({ 
            error: 'TIMEOUT',
            message: 'OpenAI request timeout after 23 seconds',
            useGeminiFallback: true
          })
        };
      }
      
      throw fetchError;
    }
    
  } catch (error) {
    console.error('[OpenAI Proxy] 💥 치명적 오류:', {
      message: error.message,
      type: error.constructor.name,
      remaining: context.getRemainingTimeInMillis()
    });
    
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ 
        error: error.message,
        type: error.constructor.name,
        useGeminiFallback: true
      })
    };
  }
};

// 🔧 극대화된 얼굴 변환 전용 FormData 생성
function createExtremeFormData(boundary, imageBase64, prompt) {
  const imageBuffer = Buffer.from(imageBase64, 'base64');
  
  const formParts = [];
  
  // DALL-E 2 모델 (Edit API에 최적)
  formParts.push(`--${boundary}`);
  formParts.push('Content-Disposition: form-data; name="model"');
  formParts.push('');
  formParts.push('dall-e-2');
  
  // 극대화된 변환 프롬프트
  formParts.push(`--${boundary}`);
  formParts.push('Content-Disposition: form-data; name="prompt"');
  formParts.push('');
  formParts.push(prompt);
  
  // 크기 설정
  formParts.push(`--${boundary}`);
  formParts.push('Content-Disposition: form-data; name="size"');
  formParts.push('');
  formParts.push('1024x1024');
  
  // 1개 생성
  formParts.push(`--${boundary}`);
  formParts.push('Content-Disposition: form-data; name="n"');
  formParts.push('');
  formParts.push('1');
  
  // base64 응답 형식
  formParts.push(`--${boundary}`);
  formParts.push('Content-Disposition: form-data; name="response_format"');
  formParts.push('');
  formParts.push('b64_json');
  
  // 이미지 파일
  formParts.push(`--${boundary}`);
  formParts.push('Content-Disposition: form-data; name="image"; filename="extreme_face.png"');
  formParts.push('Content-Type: image/png');
  formParts.push('');
  
  // 전체 조합
  const textPart = formParts.join('\r\n') + '\r\n';
  const closingBoundary = `\r\n--${boundary}--\r\n`;
  
  return Buffer.concat([
    Buffer.from(textPart, 'utf8'),
    imageBuffer,
    Buffer.from(closingBoundary, 'utf8')
  ]);
}
