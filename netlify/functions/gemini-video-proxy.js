/**
 * Netlify Function: Gemini Veo Video Generation (Final Version)
 * @google/genai SDK with imageBytes (Buffer format)
 */

const { GoogleGenAI } = require('@google/genai');

exports.config = {
  timeout: 300  // 5 minutes
};

exports.handler = async (event, context) => {
  const startTime = Date.now();
  
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // CORS preflight
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
    console.log('═══════════════════════════════════════════════════════════');
    console.log('🎬 Gemini Veo Video Generation Request Started');
    console.log('═══════════════════════════════════════════════════════════');
    
    // Parse request
    const { images, prompt } = JSON.parse(event.body);

    // Validation
    if (!images || !Array.isArray(images) || images.length === 0 || images.length > 2) {
      throw new Error('이미지는 1~2개만 지원됩니다.');
    }

    if (!prompt || typeof prompt !== 'string' || prompt.trim() === '') {
      throw new Error('프롬프트가 필요합니다.');
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY not configured');
    }

    // Determine model
    const isTwoImages = images.length === 2;
    const selectedModel = isTwoImages ? 'veo-3.1-generate-preview' : 'veo-3-generate-preview';
    const creditsRequired = isTwoImages ? 3 : 1;

    console.log('📊 Request Parameters:', {
      imageCount: images.length,
      model: selectedModel,
      promptLength: prompt.length,
      creditsRequired: creditsRequired
    });

    // Initialize SDK
    console.log('🔧 Initializing Google GenAI SDK...');
    const client = new GoogleGenAI({ apiKey });

    // Process first image
    console.log('📸 Processing images...');
    const firstImageBase64 = images[0].includes(',') 
      ? images[0].split(',')[1] 
      : images[0];

    if (!firstImageBase64 || firstImageBase64.length === 0) {
      throw new Error('첫 번째 이미지 데이터가 비어있습니다.');
    }

    console.log('✅ First image extracted:', {
      base64Length: firstImageBase64.length,
      preview: firstImageBase64.substring(0, 50) + '...'
    });

    // Build request parameters
    // ⚠️ CRITICAL: imageBytes expects base64 STRING, not Buffer!
    const requestParams = {
      model: selectedModel,
      prompt: prompt,
      image: {
        imageBytes: firstImageBase64,  // ← base64 string!
        mimeType: 'image/jpeg'
      },
      config: {
        aspectRatio: '9:16',
        durationSeconds: 8,  // ← Number, not string!
        personGeneration: 'allow_adult',
        resolution: '720p'
      }
    };

    // Add second image for Veo 3.1
    if (isTwoImages) {
      const lastImageBase64 = images[1].includes(',')
        ? images[1].split(',')[1]
        : images[1];

      if (!lastImageBase64 || lastImageBase64.length === 0) {
        throw new Error('두 번째 이미지 데이터가 비어있습니다.');
      }

      requestParams.lastFrame = {
        imageBytes: lastImageBase64,  // ← base64 string!
        mimeType: 'image/jpeg'
      };

      console.log('✅ Last frame added:', {
        base64Length: lastImageBase64.length,
        preview: lastImageBase64.substring(0, 50) + '...'
      });
      
      console.log('🎬 Mode: Veo 3.1 Frame Interpolation');
    } else {
      console.log('🎬 Mode: Veo 3 Image-to-Video');
    }



    // Generate video
    console.log('▶️  Calling generateVideos API...');
    console.log('📋 Request structure:', {
      model: requestParams.model,
      hasPrompt: !!requestParams.prompt,
      hasImage: !!requestParams.image?.imageBytes,
      hasLastFrame: !!requestParams.lastFrame?.imageBytes,
      config: requestParams.config
    });

    const operation = await client.models.generateVideos(requestParams);

    console.log('✅ Operation started:', operation.name);

    // Poll for completion
    console.log('⏱️  Polling for completion...');
    let completedOperation = operation;
    let attempts = 0;
    const maxAttempts = 30;

    while (!completedOperation.done && attempts < maxAttempts) {
      attempts++;
      console.log(`⏱️  Attempt ${attempts}/${maxAttempts}...`);
      
      await new Promise(resolve => setTimeout(resolve, 10000));
      
      completedOperation = await client.operations.get({
        name: operation.name
      });

      if (completedOperation.done) {
        console.log(`✅ Completed after ${attempts} attempts`);
        break;
      }
    }

    if (!completedOperation.done) {
      throw new Error('Timeout after 5 minutes');
    }

    // Extract video URL
    console.log('📦 Extracting video URL...');
    const generatedVideos = completedOperation.response?.generatedVideos;
    
    if (!generatedVideos || generatedVideos.length === 0) {
      throw new Error('No generated videos in response');
    }

    const videoUrl = generatedVideos[0].video?.uri;

    if (!videoUrl) {
      throw new Error('Video URL not found');
    }

    const totalTime = Date.now() - startTime;
    
    console.log('═══════════════════════════════════════════════════════════');
    console.log('✅ Video Generation Successful');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📊 Results:', {
      videoUrl: videoUrl.substring(0, 60) + '...',
      duration: 8,
      creditsUsed: creditsRequired,
      processingTime: (totalTime / 1000).toFixed(1) + 's'
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        videoUrl: videoUrl,
        duration: 8,
        creditsUsed: creditsRequired,
        model: selectedModel
      })
    };

  } catch (error) {
    const totalTime = Date.now() - startTime;
    
    console.error('═══════════════════════════════════════════════════════════');
    console.error('❌ Video Generation Failed');
    console.error('═══════════════════════════════════════════════════════════');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    console.error('Time:', (totalTime / 1000).toFixed(1) + 's');
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: error.message || 'Video generation failed',
        details: error.stack
      })
    };
  }
};
