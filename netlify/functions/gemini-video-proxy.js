/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * Netlify Function: Gemini Veo Video Generation API (Production Ready)
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * @description Google Gemini Video API를 사용한 AI 영상 생성 서비스
 * @version 1.0.0 - Final Release
 * @author Hairgator Team
 * @date 2025-10-16
 * 
 * ═══════════════════════════════════════════════════════════════════════════════
 * 🎯 API Endpoints & Models
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * [Veo 3] - Single Image to Video
 *   - Input: 1 image + text prompt
 *   - Output: 8-second 720p video (9:16 aspect ratio)
 *   - Credits: 1 credit per generation
 *   - Model: veo-3-generate-preview
 * 
 * [Veo 3.1] - Image-to-Image Interpolation
 *   - Input: 2 images (first frame + last frame) + text prompt
 *   - Output: 8-second 720p video with smooth transition
 *   - Credits: 3 credits per generation
 *   - Model: veo-3.1-generate-preview
 * 
 * ═══════════════════════════════════════════════════════════════════════════════
 * 📋 Request Format
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * POST /.netlify/functions/gemini-video-proxy
 * Content-Type: application/json
 * 
 * {
 *   "images": [
 *     "data:image/jpeg;base64,/9j/4AAQSkZJRg...",  // First frame (required)
 *     "data:image/jpeg;base64,/9j/4AAQSkZJRg..."   // Last frame (optional)
 *   ],
 *   "prompt": "A detailed text description of the video"
 * }
 * 
 * ═══════════════════════════════════════════════════════════════════════════════
 * 📤 Response Format
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Success (200):
 * {
 *   "success": true,
 *   "videoUrl": "https://generativelanguage.googleapis.com/v1beta/files/...",
 *   "duration": 8,
 *   "creditsUsed": 3,
 *   "model": "veo-3.1-generate-preview"
 * }
 * 
 * Error (500):
 * {
 *   "error": "Error message description",
 *   "details": "Full error stack trace"
 * }
 * 
 * ═══════════════════════════════════════════════════════════════════════════════
 * ⚙️ Environment Variables Required
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * GEMINI_API_KEY - Google AI Studio API Key
 *   - Get it from: https://aistudio.google.com/app/apikey
 *   - Set in: Netlify Dashboard → Environment Variables
 * 
 * ═══════════════════════════════════════════════════════════════════════════════
 * 🔧 Technical Implementation Details
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * SDK: @google/genai v1.16.0+
 * Node.js: 20.x (Netlify Functions default)
 * Timeout: 300 seconds (5 minutes)
 * Polling Interval: 10 seconds
 * Max Polling Attempts: 30 (= 5 minutes total)
 * 
 * Image Format: JPEG (base64 encoded)
 * Max Image Size: Recommended < 5MB per image
 * Aspect Ratio: 9:16 (vertical video)
 * Output Resolution: 720p
 * Video Duration: 8 seconds (fixed)
 * 
 * ═══════════════════════════════════════════════════════════════════════════════
 */

const { GoogleGenAI } = require('@google/genai');

// ═══════════════════════════════════════════════════════════════════════════════
// Netlify Function Configuration
// ═══════════════════════════════════════════════════════════════════════════════

exports.config = {
  timeout: 300  // 5 minutes - maximum allowed by Netlify
};

// ═══════════════════════════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════════════════════════

const MODELS = {
  VEO_3: 'veo-3-generate-preview',
  VEO_3_1: 'veo-3.1-generate-preview'
};

const VIDEO_SETTINGS = {
  ASPECT_RATIO: '9:16',
  DURATION_SECONDS: '8',
  PERSON_GENERATION: 'allow_adult',
  RESOLUTION: '720p'
};

const POLLING = {
  MAX_ATTEMPTS: 30,      // 30 attempts
  INTERVAL_MS: 10000     // 10 seconds per attempt = 5 minutes total
};

const CREDITS_COST = {
  SINGLE_IMAGE: 1,       // Veo 3
  TWO_IMAGES: 3          // Veo 3.1
};

const VALIDATION = {
  MIN_IMAGES: 1,
  MAX_IMAGES: 2,
  MIN_PROMPT_LENGTH: 1,
  MAX_PROMPT_LENGTH: 1000
};

// ═══════════════════════════════════════════════════════════════════════════════
// Main Handler
// ═══════════════════════════════════════════════════════════════════════════════

exports.handler = async (event, context) => {
  const startTime = Date.now();
  
  // ─────────────────────────────────────────────────────────────────────────────
  // CORS Headers
  // ─────────────────────────────────────────────────────────────────────────────
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // Handle CORS Preflight
  // ─────────────────────────────────────────────────────────────────────────────
  if (event.httpMethod === 'OPTIONS') {
    return { 
      statusCode: 200, 
      headers, 
      body: '' 
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Validate HTTP Method
  // ─────────────────────────────────────────────────────────────────────────────
  if (event.httpMethod !== 'POST') {
    console.warn('❌ Invalid method:', event.httpMethod);
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ 
        error: 'Method not allowed. Use POST.' 
      })
    };
  }

  try {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('🎬 Gemini Veo Video Generation Request Started');
    console.log('═══════════════════════════════════════════════════════════');
    
    // ───────────────────────────────────────────────────────────────────────────
    // Parse Request Body
    // ───────────────────────────────────────────────────────────────────────────
    let requestBody;
    try {
      requestBody = JSON.parse(event.body);
    } catch (parseError) {
      throw new Error('Invalid JSON in request body');
    }

    const { images, prompt } = requestBody;

    // ───────────────────────────────────────────────────────────────────────────
    // Validate Request Parameters
    // ───────────────────────────────────────────────────────────────────────────
    if (!images || !Array.isArray(images)) {
      throw new Error('images 배열이 필요합니다.');
    }

    if (images.length < VALIDATION.MIN_IMAGES || images.length > VALIDATION.MAX_IMAGES) {
      throw new Error(`이미지는 ${VALIDATION.MIN_IMAGES}~${VALIDATION.MAX_IMAGES}개만 지원됩니다. (현재: ${images.length}개)`);
    }

    if (!prompt || typeof prompt !== 'string' || prompt.trim() === '') {
      throw new Error('프롬프트가 필요합니다.');
    }

    if (prompt.length > VALIDATION.MAX_PROMPT_LENGTH) {
      throw new Error(`프롬프트는 최대 ${VALIDATION.MAX_PROMPT_LENGTH}자까지 가능합니다.`);
    }

    // ───────────────────────────────────────────────────────────────────────────
    // Environment Configuration
    // ───────────────────────────────────────────────────────────────────────────
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable not configured');
    }

    // ───────────────────────────────────────────────────────────────────────────
    // Determine Model and Credits
    // ───────────────────────────────────────────────────────────────────────────
    const isTwoImages = images.length === 2;
    const selectedModel = isTwoImages ? MODELS.VEO_3_1 : MODELS.VEO_3;
    const creditsRequired = isTwoImages ? CREDITS_COST.TWO_IMAGES : CREDITS_COST.SINGLE_IMAGE;

    console.log('📊 Request Parameters:', {
      imageCount: images.length,
      model: selectedModel,
      promptLength: prompt.length,
      creditsRequired: creditsRequired,
      aspectRatio: VIDEO_SETTINGS.ASPECT_RATIO
    });

    // ───────────────────────────────────────────────────────────────────────────
    // Initialize Google GenAI Client
    // ───────────────────────────────────────────────────────────────────────────
    console.log('🔧 Initializing Google GenAI SDK...');
    const client = new GoogleGenAI({ apiKey });

    // ───────────────────────────────────────────────────────────────────────────
    // Process Images: Extract Base64 Data
    // ───────────────────────────────────────────────────────────────────────────
    console.log('📸 Processing images...');
    
    // Extract first image
    const firstImageBase64 = images[0].includes(',') 
      ? images[0].split(',')[1] 
      : images[0];

    if (!firstImageBase64 || firstImageBase64.length === 0) {
      throw new Error('첫 번째 이미지 데이터가 비어있습니다.');
    }

    console.log('✅ First image extracted:', {
      size: firstImageBase64.length,
      preview: firstImageBase64.substring(0, 50) + '...'
    });

    // ───────────────────────────────────────────────────────────────────────────
    // Build API Request Parameters
    // ───────────────────────────────────────────────────────────────────────────
    const requestParams = {
      model: selectedModel,
      prompt: prompt,
      image: {
        bytesBase64Encoded: firstImageBase64,
        mimeType: 'image/jpeg'
      },
      config: {
        aspectRatio: VIDEO_SETTINGS.ASPECT_RATIO,
        durationSeconds: VIDEO_SETTINGS.DURATION_SECONDS,
        personGeneration: VIDEO_SETTINGS.PERSON_GENERATION,
        resolution: VIDEO_SETTINGS.RESOLUTION
      }
    };

    // Add second image for Veo 3.1 interpolation
    if (isTwoImages) {
      const lastImageBase64 = images[1].includes(',')
        ? images[1].split(',')[1]
        : images[1];

      if (!lastImageBase64 || lastImageBase64.length === 0) {
        throw new Error('두 번째 이미지 데이터가 비어있습니다.');
      }

      requestParams.lastFrame = {
        bytesBase64Encoded: lastImageBase64,
        mimeType: 'image/jpeg'
      };

      console.log('✅ Last frame added:', {
        size: lastImageBase64.length,
        preview: lastImageBase64.substring(0, 50) + '...'
      });
      
      console.log('🎬 Mode: Veo 3.1 Frame Interpolation (first → last)');
    } else {
      console.log('🎬 Mode: Veo 3 Image-to-Video');
    }

    // ───────────────────────────────────────────────────────────────────────────
    // Start Video Generation
    // ───────────────────────────────────────────────────────────────────────────
    console.log('▶️  Calling generateVideos API...');
    console.log('📋 Final request structure:', {
      model: requestParams.model,
      hasPrompt: !!requestParams.prompt,
      hasImage: !!requestParams.image?.bytesBase64Encoded,
      hasLastFrame: !!requestParams.lastFrame?.bytesBase64Encoded,
      config: requestParams.config
    });

    const operation = await client.models.generateVideos(requestParams);

    console.log('✅ Video generation operation started');
    console.log('🔑 Operation ID:', operation.name);

    // ───────────────────────────────────────────────────────────────────────────
    // Poll Operation Status Until Complete
    // ───────────────────────────────────────────────────────────────────────────
    console.log('⏱️  Polling for completion...');
    
    let completedOperation = operation;
    let attempts = 0;

    while (!completedOperation.done && attempts < POLLING.MAX_ATTEMPTS) {
      attempts++;
      const elapsedSeconds = attempts * (POLLING.INTERVAL_MS / 1000);
      
      console.log(`⏱️  Polling attempt ${attempts}/${POLLING.MAX_ATTEMPTS} (${elapsedSeconds}s elapsed)...`);
      
      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, POLLING.INTERVAL_MS));
      
      // Get updated operation status
      completedOperation = await client.operations.get({
        name: operation.name
      });

      // Check if done
      if (completedOperation.done) {
        console.log(`✅ Operation completed after ${attempts} attempts (${elapsedSeconds}s)`);
        break;
      }
    }

    // ───────────────────────────────────────────────────────────────────────────
    // Check Timeout
    // ───────────────────────────────────────────────────────────────────────────
    if (!completedOperation.done) {
      const totalWaitTime = POLLING.MAX_ATTEMPTS * (POLLING.INTERVAL_MS / 1000);
      throw new Error(`Video generation timeout after ${totalWaitTime} seconds (${POLLING.MAX_ATTEMPTS} attempts)`);
    }

    // ───────────────────────────────────────────────────────────────────────────
    // Extract Generated Video URL
    // ───────────────────────────────────────────────────────────────────────────
    console.log('📦 Extracting video URL from response...');
    
    const generatedVideos = completedOperation.response?.generatedVideos;
    
    if (!generatedVideos || generatedVideos.length === 0) {
      console.error('❌ Response structure:', JSON.stringify(completedOperation.response, null, 2));
      throw new Error('No generated videos in response');
    }

    const videoUrl = generatedVideos[0].video?.uri;

    if (!videoUrl) {
      console.error('❌ Video object:', JSON.stringify(generatedVideos[0], null, 2));
      throw new Error('Video URL not found in response');
    }

    // ───────────────────────────────────────────────────────────────────────────
    // Success Response
    // ───────────────────────────────────────────────────────────────────────────
    const totalTime = Date.now() - startTime;
    
    console.log('═══════════════════════════════════════════════════════════');
    console.log('✅ Video Generation Successful');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📊 Results:', {
      videoUrl: videoUrl.substring(0, 60) + '...',
      fullUrl: videoUrl,
      duration: VIDEO_SETTINGS.DURATION_SECONDS + ' seconds',
      creditsUsed: creditsRequired,
      model: selectedModel,
      totalProcessingTime: (totalTime / 1000).toFixed(1) + 's'
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        videoUrl: videoUrl,
        duration: parseInt(VIDEO_SETTINGS.DURATION_SECONDS),
        creditsUsed: creditsRequired,
        model: selectedModel
      })
    };

  } catch (error) {
    // ───────────────────────────────────────────────────────────────────────────
    // Error Handling
    // ───────────────────────────────────────────────────────────────────────────
    const totalTime = Date.now() - startTime;
    
    console.error('═══════════════════════════════════════════════════════════');
    console.error('❌ Video Generation Failed');
    console.error('═══════════════════════════════════════════════════════════');
    console.error('Error type:', error.constructor.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    console.error('Total time before failure:', (totalTime / 1000).toFixed(1) + 's');
    
    // Extract detailed error information if available
    let errorMessage = error.message || 'Unknown error occurred';
    let errorDetails = error.stack || '';

    // Handle API-specific errors
    if (error.status) {
      console.error('API Status Code:', error.status);
      errorMessage = `API Error ${error.status}: ${errorMessage}`;
    }

    if (error.response) {
      console.error('API Response:', JSON.stringify(error.response, null, 2));
      errorDetails = JSON.stringify(error.response, null, 2);
    }

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: errorMessage,
        details: errorDetails,
        timestamp: new Date().toISOString(),
        processingTime: totalTime
      })
    };
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// End of File
// ═══════════════════════════════════════════════════════════════════════════════
