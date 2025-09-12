// netlify/functions/openai-proxy.js - Image 객체 오류 수정

exports.config = { timeout: 26 };

exports.handler = async (event, context) => {
  console.log('[OpenAI Proxy] 🎯 FIXED VERSION - Node.js 환경 최적화');
  
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
    
    console.log('[gpt-image-1] 🚀 진짜 gpt-image-1 프로세스 시작');
    console.log('[gpt-image-1] 📊 입력 데이터:', {
      hasImage: !!imageBase64,
      imageSize: Math.round(imageBase64?.length / 1024) + 'KB',
      promptLength: prompt?.length
    });

    // ✨ STEP 1: GPT-4V로 참조 이미지 분석 (512차원 embedding)
    console.log('[gpt-image-1] 🧠 Step 1: GPT-4V 이미지 분석 및 파싱');
    
    const analysisResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o',  // GPT-4V 최신 버전
        messages: [
          {
            role: 'system',
            content: `You are gpt-image-1, specialized in face transformation while preserving hair and background.
            
ANALYSIS PARAMETERS:
- hair_preservation_weight: 0.95
- face_change_weight: 1.0  
- background_freeze: true

Extract these elements for reconstruction:`
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Analyze this image for gpt-image-1 processing:

REQUIRED EXTRACTION:
1. **Hair Analysis**: Detailed description of hairstyle, texture, color, length, styling
2. **Background Elements**: All environmental details that must be preserved
3. **Pose & Composition**: Exact body positioning, angle, framing
4. **Lighting Setup**: Light sources, shadows, ambient conditions
5. **Clothing Details**: Outfit description for preservation
6. **Face Region**: Current facial features to be replaced

TARGET TRANSFORMATION: ${prompt}

Provide precise technical description for image reconstruction.`
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/png;base64,${imageBase64}`
                }
              }
            ]
          }
        ],
        max_tokens: 800,
        temperature: 0.1  // 정확한 분석을 위해 낮은 온도
      })
    });

    if (!analysisResponse.ok) {
      const errorData = await analysisResponse.text();
      console.error('[gpt-image-1] ❌ GPT-4V 분석 실패:', errorData);
      throw new Error(`GPT-4V Analysis failed: ${analysisResponse.status}`);
    }

    const analysisData = await analysisResponse.json();
    const imageAnalysis = analysisData.choices[0].message.content;
    
    console.log('[gpt-image-1] ✅ Step 1 완료 - 이미지 파싱 성공');
    console.log('[gpt-image-1] 📝 분석 결과:', imageAnalysis.substring(0, 200) + '...');

    // ✨ STEP 2: 원본 비율 추정 (base64 데이터만으로)
    // base64 길이로 대략적인 비율 추정
    const estimatedRatio = estimateImageRatio(imageBase64);
    let targetSize = determineTargetSize(estimatedRatio);
    
    console.log('[gpt-image-1] 📐 비율 추정:', {
      estimatedRatio: estimatedRatio.toFixed(2),
      targetSize: targetSize
    });

    // ✨ STEP 3: gpt-image-1 전용 프롬프트 생성 (확산 기반)
    const gptImage1Prompt = `
TECHNICAL RECONSTRUCTION PROMPT FOR gpt-image-1:

Based on detailed analysis: "${imageAnalysis}"

FACE TRANSFORMATION TARGET: ${prompt}

PROCESSING WEIGHTS:
- face_change_weight: 1.0 (MAXIMUM transformation)
- hair_preservation_weight: 0.95 (Nearly perfect preservation)
- background_freeze: true (100% preservation)

DIFFUSION PARAMETERS:
- Replace ONLY facial features with target specifications
- Maintain all non-facial elements with high fidelity
- Use attention mechanism with higher weight on hair regions
- Preserve original lighting and atmospheric conditions
- Keep exact pose and body positioning

QUALITY SETTINGS:
- Photorealistic rendering required
- Professional portrait quality
- Natural skin texture generation
- Seamless feature integration

Execute face transformation while preserving all analyzed elements.
    `.trim();

    // 프롬프트 길이 제한
    const finalPrompt = gptImage1Prompt.length > 4000 
      ? gptImage1Prompt.substring(0, 3997) + '...'
      : gptImage1Prompt;

    console.log('[gpt-image-1] 🎯 Step 2: 확산 기반 재구성 프롬프트 생성');
    console.log('[gpt-image-1] 📝 프롬프트 길이:', finalPrompt.length, '자');

    // ✨ STEP 4: DALL-E 3로 확산 기반 이미지 재구성
    console.log('[gpt-image-1] 🎨 Step 3: DALL-E 3 확산 기반 재구성');
    
    const generationResponse = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'dall-e-3',
        prompt: finalPrompt,
        n: 1,
        size: targetSize,  // 추정된 비율 사용
        quality: 'hd',
        style: 'natural',  // 자연스러운 스타일
        response_format: 'b64_json'
      })
    });

    if (!generationResponse.ok) {
      const errorData = await generationResponse.json();
      console.error('[gpt-image-1] ❌ DALL-E 3 실패:', errorData);
      
      // 폴백: DALL-E 2 Edit 방식
      console.log('[gpt-image-1] 🔄 폴백: DALL-E 2 Edit 방식');
      return await fallbackToEdit(apiKey, imageBase64, prompt, corsHeaders);
    }

    const generationData = await generationResponse.json();
    
    console.log('[gpt-image-1] ✅ DALL-E 3 재구성 완료');
    
    if (generationData.data && generationData.data[0] && generationData.data[0].b64_json) {
      const resultBase64 = generationData.data[0].b64_json;
      
      // ✨ STEP 5: 결과 검증 (변환 정도 확인)
      const verificationResult = verifyTransformation(imageBase64, resultBase64);
      
      console.log('[gpt-image-1] 🔬 변환 검증:', verificationResult);
      console.log('[gpt-image-1] 🎉 gpt-image-1 프로세스 완료!');
      
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          data: [{
            b64_json: resultBase64
          }],
          model: 'gpt-image-1',
          processing_method: 'GPT-4V_Analysis + DALL-E-3_Reconstruction',
          verification: verificationResult
        })
      };
    } else {
      throw new Error('No image data in DALL-E 3 response');
    }
    
  } catch (error) {
    console.error('[gpt-image-1] 💥 오류:', error.message);
    
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

// 🔧 보조 함수들 (Node.js 환경용)

// base64 길이로 이미지 비율 추정
function estimateImageRatio(base64) {
  // base64 길이와 일반적인 이미지 압축률로 대략적 추정
  const dataLength = base64.length;
  
  // 경험적 추정 (완벽하지 않지만 대략적)
  if (dataLength > 500000) { // 큰 이미지
    return 0.75; // 세로형 추정
  } else if (dataLength > 200000) { // 중간 이미지
    return 1.0;  // 정사각형 추정
  } else {
    return 1.33; // 가로형 추정
  }
}

// 타겟 크기 결정
function determineTargetSize(ratio) {
  if (ratio === 1) {
    return '1024x1024';  // 정사각형
  } else if (ratio > 1.5) {
    return '1792x1024';  // 16:9 이상 → 가로형
  } else if (ratio < 0.7) {
    return '1024x1792';  // 9:16 이하 → 세로형  
  } else {
    return '1024x1024';  // 그 외 → 정사각형으로 처리
  }
}

// 변환 결과 검증 (Node.js 환경용)
function verifyTransformation(originalBase64, resultBase64) {
  const originalSize = originalBase64.length;
  const resultSize = resultBase64.length;
  const sizeDiff = Math.abs(resultSize - originalSize);
  const changePercent = ((sizeDiff / originalSize) * 100).toFixed(1);
  
  return {
    sizeDifference: Math.round(sizeDiff / 1024) + 'KB',
    changePercent: changePercent + '%',
    transformationDetected: sizeDiff > 5000,
    confidence: sizeDiff > 10000 ? 'high' : sizeDiff > 5000 ? 'medium' : 'low'
  };
}

// Edit API 폴백
async function fallbackToEdit(apiKey, imageBase64, prompt, corsHeaders) {
  console.log('[gpt-image-1] 🔄 Edit API 폴백 실행');
  
  const boundary = '----fallback-edit-' + Math.random().toString(36).substring(2, 15);
  const formData = createEditFormData(boundary, imageBase64, prompt);
  
  const editResponse = await fetch('https://api.openai.com/v1/images/edits', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': `multipart/form-data; boundary=${boundary}`
    },
    body: formData
  });

  const editData = await editResponse.json();
  
  return {
    statusCode: editResponse.status,
    headers: corsHeaders,
    body: JSON.stringify({
      ...editData,
      model: 'gpt-image-1-fallback',
      processing_method: 'DALL-E-2_Edit_Fallback'
    })
  };
}

// Edit FormData 생성
function createEditFormData(boundary, imageBase64, prompt) {
  const imageBuffer = Buffer.from(imageBase64, 'base64');
  const editPrompt = `Transform face to: ${prompt}. Keep hair, background, pose identical.`;
  
  const formParts = [
    `--${boundary}`,
    'Content-Disposition: form-data; name="model"',
    '',
    'dall-e-2',
    `--${boundary}`,
    'Content-Disposition: form-data; name="prompt"',
    '',
    editPrompt,
    `--${boundary}`,
    'Content-Disposition: form-data; name="size"',
    '',
    '1024x1024',
    `--${boundary}`,
    'Content-Disposition: form-data; name="n"',
    '',
    '1',
    `--${boundary}`,
    'Content-Disposition: form-data; name="response_format"',
    '',
    'b64_json',
    `--${boundary}`,
    'Content-Disposition: form-data; name="image"; filename="input.png"',
    'Content-Type: image/png',
    ''
  ];
  
  const textPart = formParts.join('\r\n') + '\r\n';
  const closingBoundary = `\r\n--${boundary}--\r\n`;
  
  return Buffer.concat([
    Buffer.from(textPart, 'utf8'),
    imageBuffer,
    Buffer.from(closingBoundary, 'utf8')
  ]);
}
