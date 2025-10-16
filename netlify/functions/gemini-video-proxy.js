/**
 * Netlify Function: Gemini Veo Video Generation (REST API)
 * SDK 대신 직접 REST API 호출
 */

const fetch = require('node-fetch');

exports.config = {
  timeout: 300
};

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { images, prompt } = JSON.parse(event.body);

    if (!images || images.length === 0 || !prompt) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: '이미지와 프롬프트가 필요합니다.' })
      };
    }

    console.log('🎬 Veo REST API 호출:', {
      imageCount: images.length,
      promptLength: prompt.length
    });

    const apiKey = process.env.GEMINI_API_KEY;
    const firstImageBase64 = images[0].split(',')[1];

    // REST API 요청 구성
    let requestBody = {
      prompt: prompt,
      image: {
        bytesBase64Encoded: firstImageBase64,
        mimeType: 'image/jpeg'
      },
      generationConfig: {
        aspectRatio: '9:16',
        durationSeconds: '8',
        personGeneration: 'allow_adult'
      }
    };

    // 2개 이미지인 경우 lastFrame 추가
    if (images.length === 2) {
      const lastImageBase64 = images[1].split(',')[1];
      requestBody.generationConfig.lastFrame = {
        bytesBase64Encoded: lastImageBase64,
        mimeType: 'image/jpeg'
      };
      console.log('📸📸 lastFrame 추가됨');
    }

    console.log('📤 요청 구조:', JSON.stringify({
      prompt: requestBody.prompt.substring(0, 50),
      hasImage: !!requestBody.image,
      imageSize: requestBody.image.bytesBase64Encoded.length,
      hasLastFrame: !!requestBody.generationConfig.lastFrame,
      config: requestBody.generationConfig
    }, null, 2));

    // POST 요청 - 올바른 REST API 엔드포인트
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/veo-3.1-generate-preview:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      }
    );

    // 응답 텍스트 먼저 확인
    const responseText = await response.text();
    console.log('📩 응답 상태:', response.status);
    console.log('📩 응답 본문:', responseText.substring(0, 500));

    if (!response.ok) {
      console.error('❌ API 오류:', responseText);
      throw new Error(responseText || `HTTP ${response.status}`);
    }

    const result = JSON.parse(responseText);
    console.log('✅ 작업 시작:', result.name);

    // 폴링
    let operation = result;
    let attempts = 0;
    const maxAttempts = 30;

    while (!operation.done && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 10000));
      
      const pollResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/${operation.name}?key=${apiKey}`
      );
      
      operation = await pollResponse.json();
      attempts++;
      console.log(`⏱️ ${attempts}/${maxAttempts}`);
    }

    if (!operation.done) {
      throw new Error('타임아웃');
    }

    const videoUrl = operation.response?.generatedVideos?.[0]?.video?.uri;
    
    if (!videoUrl) {
      throw new Error('비디오 URL 없음');
    }

    console.log('✅ 완료:', videoUrl.substring(0, 50));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        videoUrl,
        duration: 8,
        creditsUsed: images.length === 2 ? 3 : 1
      })
    };

  } catch (error) {
    console.error('❌ 오류:', error.message);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: error.message || '생성 실패'
      })
    };
  }
};
