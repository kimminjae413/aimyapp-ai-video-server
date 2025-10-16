/**
 * Netlify Function: Check Veo Video Generation Status
 * Polls operation status and returns video URL when complete
 */

const { GoogleGenAI } = require('@google/genai');

exports.config = {
  timeout: 60  // 1 minute
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
    const { operationId } = JSON.parse(event.body);

    if (!operationId) {
      throw new Error('operationId is required');
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY not configured');
    }

    console.log('🔍 Checking operation status:', operationId);

    const client = new GoogleGenAI({ apiKey });

    // Get operation status
    const operation = await client.operations.get({
      name: operationId
    });

    if (!operation) {
      throw new Error('Operation not found');
    }

    // Still processing
    if (!operation.done) {
      console.log('⏳ Still processing...');
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          status: 'processing',
          done: false,
          message: '영상 생성 중...'
        })
      };
    }

    // Completed - extract video URL
    console.log('✅ Operation completed');
    
    const generatedVideos = operation.response?.generatedVideos;
    
    if (!generatedVideos || generatedVideos.length === 0) {
      throw new Error('No generated videos in response');
    }

    const videoUrl = generatedVideos[0].video?.uri;

    if (!videoUrl) {
      throw new Error('Video URL not found');
    }

    console.log('📦 Video URL:', videoUrl.substring(0, 60) + '...');

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        status: 'completed',
        done: true,
        videoUrl: videoUrl,
        duration: 8
      })
    };

  } catch (error) {
    console.error('❌ Status check failed:', error.message);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        status: 'error',
        error: error.message
      })
    };
  }
};
