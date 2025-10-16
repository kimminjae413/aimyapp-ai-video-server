/**
 * Netlify Function: Gemini Veo Video Generation Proxy
 * 공식 문서 기반: https://ai.google.dev/gemini-api/docs/video
 */

const { GoogleGenAI } = require('@google/genai');

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

    if (!images || images.length === 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: '이미지가 필요합니다.' })
      };
    }

    if (!prompt) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: '프롬프트가 필요합니다.' })
      };
    }

    console.log('🎬 Veo 생성 시작:', {
      imageCount: images.length,
      promptLength: prompt.length
    });

    // GoogleGenAI 클라이언트 초기화
    const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    // 이미지 처리
    const firstImageData = images[0].split(',')[1];

    let operation;

    if (images.length === 2) {
      // 2개 이미지: lastFrame 사용
      console.log('📸📸 Veo 3.1 with last_frame');
      
      const lastImageData = images[1].split(',')[1];

      // JavaScript SDK API - 올바른 필드명!
      operation = await client.models.generateVideos({
        model: 'veo-3.1-generate-preview',
        prompt: prompt,
        image: {
          mimeType: 'image/jpeg',
          bytesBase64Encoded: firstImageData  // ← data가 아니라 bytesBase64Encoded
        },
        config: {
          last_frame: {
            mimeType: 'image/jpeg',
            bytesBase64Encoded: lastImageData  // ← data가 아니라 bytesBase64Encoded
          },
          aspect_ratio: '9:16',
          duration_seconds: '8',
          person_generation: 'allow_adult'
        }
      });

    } else {
      // 1개 이미지
      console.log('📸 Veo 3 single image');

      operation = await client.models.generateVideos({
        model: 'veo-3.1-generate-preview',
        prompt: prompt,
        image: {
          mimeType: 'image/jpeg',
          bytesBase64Encoded: firstImageData  // ← data가 아니라 bytesBase64Encoded
        },
        config: {
          aspect_ratio: '9:16',
          duration_seconds: '8',
          person_generation: 'allow_adult'
        }
      });
    }

    // 폴링
    console.log('⏳ 비디오 생성 대기...');
    
    let attempts = 0;
    const maxAttempts = 30;

    while (!operation.done && attempts < maxAttempts) {
      console.log(`⏱️ ${attempts + 1}/${maxAttempts}`);
      await new Promise(resolve => setTimeout(resolve, 10000));
      operation = await client.operations.get({ name: operation.name });
      attempts++;
    }

    if (!operation.done) {
      throw new Error('타임아웃 (5분)');
    }

    const videos = operation.response?.generated_videos;
    if (!videos || videos.length === 0) {
      throw new Error('생성된 비디오 없음');
    }

    const videoUrl = videos[0].video?.uri;
    if (!videoUrl) {
      throw new Error('비디오 URI 없음');
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
