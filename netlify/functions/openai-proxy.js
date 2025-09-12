// netlify/functions/openai-proxy.js - 진짜 gpt-image-1 Edit API

exports.config = { timeout: 26 };

exports.handler = async (event, context) => {
  console.log('[OpenAI Proxy] 🎯 REAL gpt-image-1 Edit API');
  
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
    
    console.log('[gpt-image-1] 🚀 진짜 gpt-image-1 Edit API 시작:', {
      hasImage: !!imageBase64,
      imageSize: Math.round(imageBase64?.length / 1024) + 'KB',
      promptLength: prompt?.length
    });

    // gpt-image-1 전용 32,000자 극대화 프롬프트
    const gptImage1Prompt = `
EXTREME FACIAL TRANSFORMATION USING gpt-image-1:

PRIMARY OBJECTIVE: ${prompt}

TRANSFORMATION REQUIREMENTS:
- COMPLETELY OBLITERATE original facial features
- REPLACE with entirely different face as specified
- MAXIMUM transformation intensity
- ZERO resemblance to original person
- Make changes DRAMATIC and OBVIOUS

DETAILED FACIAL CHANGES:
- Face shape: Complete geometric reconstruction
- Eye area: Different size, shape, spacing, and expression
- Nose structure: Entirely different bridge height, width, and tip shape
- Mouth features: Different lip thickness, shape, and smile pattern
- Cheekbone structure: Completely different prominence and angle
- Jawline: New bone structure and definition
- Skin characteristics: Different texture, tone, and aging pattern
- Eyebrow features: Different thickness, arch, and positioning

PRESERVATION RULES:
- Hair: Maintain 100% identical style, color, length, and texture
- Background: Preserve all environmental elements perfectly
- Clothing: Keep all garments and accessories unchanged
- Body pose: Maintain exact positioning and angle
- Lighting: Preserve original light sources and shadows
- Composition: Keep framing and perspective identical

TECHNICAL SPECIFICATIONS:
- Generate photorealistic skin with natural imperfections
- Ensure seamless integration between new face and preserved elements
- Apply professional portrait lighting consistency
- Maintain high resolution and sharp details
- Create natural facial proportions and symmetry

QUALITY ASSURANCE:
- The transformation should be immediately recognizable as a different person
- Facial features should look naturally born, not artificially imposed
- All preserved elements should remain pixel-perfect
- The result should appear as a professionally shot portrait

Execute this facial transformation with maximum fidelity to the specifications while preserving all non-facial elements exactly as they appear in the source image.
    `.trim();

    console.log('[gpt-image-1] 📝 극대화된 프롬프트 생성:', gptImage1Prompt.length, '자 (32K 한도)');

    const imageBuffer = Buffer.from(imageBase64, 'base64');
    const boundary = '----gpt-image-1-edit-' + Math.random().toString(36).substring(2, 15);
    const formData = createGPTImage1FormData(boundary, imageBase64, gptImage1Prompt);
    
    const startTime = Date.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 23000);
    
    try {
      // 🔥 진짜 gpt-image-1 Edit API 호출
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
      
      const responseTime = Date.now() - startTime;
      
      console.log('[gpt-image-1] ⚡ API 응답:', {
        status: response.status,
        responseTime: responseTime + 'ms',
        remaining: context.getRemainingTimeInMillis()
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[gpt-image-1] ❌ API 오류:', {
          status: response.status,
          error: errorText.substring(0, 200)
        });
        
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
      
      // gpt-image-1은 항상 base64를 반환
      console.log('[gpt-image-1] 🔬 결과 분석:', {
        hasData: !!data.data,
        dataLength: data.data?.length || 0,
        hasB64Json: !!(data.data?.[0]?.b64_json),
        b64Length: data.data?.[0]?.b64_json?.length || 0,
        model: data.model || 'unknown'
      });
      
      // 변환 검증
      if (data.data && data.data[0] && data.data[0].b64_json) {
        const resultBase64 = data.data[0].b64_json;
        const originalSize = imageBase64.length;
        const resultSize = resultBase64.length;
        const sizeDiff = Math.abs(resultSize - originalSize);
        const changePercent = ((sizeDiff / originalSize) * 100).toFixed(1);
        
        console.log('[gpt-image-1] 📊 변환 검증:', {
          originalSize: Math.round(originalSize / 1024) + 'KB',
          resultSize: Math.round(resultSize / 1024) + 'KB',
          changePercent: changePercent + '%',
          likely_transformed: sizeDiff > 1000 ? '✅ 변환됨' : '⚠️ 미미한 변화',
          totalTime: responseTime + 'ms'
        });
      }
      
      console.log('[gpt-image-1] ✅ gpt-image-1 Edit 완료 - 총 소요시간:', responseTime + 'ms');
      
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          ...data,
          processing_method: 'gpt-image-1_Edit_API',
          response_time: responseTime + 'ms'
        })
      };
      
    } catch (fetchError) {
      clearTimeout(timeoutId);
      
      if (fetchError.name === 'AbortError') {
        console.log('[gpt-image-1] ⏰ 23초 타임아웃');
        return {
          statusCode: 408,
          headers: corsHeaders,
          body: JSON.stringify({ 
            error: 'TIMEOUT',
            message: 'gpt-image-1 request timeout after 23 seconds',
            useGeminiFallback: true
          })
        };
      }
      
      throw fetchError;
    }
    
  } catch (error) {
    console.error('[gpt-image-1] 💥 치명적 오류:', error.message);
    
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

// 🔧 gpt-image-1 전용 FormData 생성
function createGPTImage1FormData(boundary, imageBase64, prompt) {
  const imageBuffer = Buffer.from(imageBase64, 'base64');
  
  const formParts = [];
  
  // 🎯 gpt-image-1 모델 명시
  formParts.push(`--${boundary}`);
  formParts.push('Content-Disposition: form-data; name="model"');
  formParts.push('');
  formParts.push('gpt-image-1');
  
  // 32K 극대화 프롬프트
  formParts.push(`--${boundary}`);
  formParts.push('Content-Disposition: form-data; name="prompt"');
  formParts.push('');
  formParts.push(prompt);
  
  // 🆕 gpt-image-1 전용 파라미터들
  
  // input_fidelity: high (얼굴 특징 매칭 강화)
  formParts.push(`--${boundary}`);
  formParts.push('Content-Disposition: form-data; name="input_fidelity"');
  formParts.push('');
  formParts.push('high');
  
  // size: auto (자동 종횡비)
  formParts.push(`--${boundary}`);
  formParts.push('Content-Disposition: form-data; name="size"');
  formParts.push('');
  formParts.push('auto');
  
  // quality: high
  formParts.push(`--${boundary}`);
  formParts.push('Content-Disposition: form-data; name="quality"');
  formParts.push('');
  formParts.push('high');
  
  // output_format: png (기본값이지만 명시)
  formParts.push(`--${boundary}`);
  formParts.push('Content-Disposition: form-data; name="output_format"');
  formParts.push('');
  formParts.push('png');
  
  // n: 1개 생성
  formParts.push(`--${boundary}`);
  formParts.push('Content-Disposition: form-data; name="n"');
  formParts.push('');
  formParts.push('1');
  
  // 이미지 파일
  formParts.push(`--${boundary}`);
  formParts.push('Content-Disposition: form-data; name="image"; filename="face_transform.png"');
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
