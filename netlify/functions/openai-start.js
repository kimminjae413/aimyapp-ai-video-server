// netlify/functions/openai-start.js - 비동기 작업 시작
exports.config = { timeout: 5 }; // 빠른 응답

// 메모리 저장소 (Function간 공유)
const taskResults = new Map();

exports.handler = async (event, context) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };
  
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  try {
    const { imageBase64, prompt } = JSON.parse(event.body);
    const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    console.log(`[Async Start] Task ${taskId} started`);
    
    // 즉시 처리 상태로 저장
    taskResults.set(taskId, { status: 'processing', startTime: Date.now() });
    
    // 백그라운드에서 OpenAI API 호출 (비동기)
    processOpenAIAsync(taskId, imageBase64, prompt);
    
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ taskId, status: 'started' })
    };
    
  } catch (error) {
    console.error('[Async Start] Error:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: error.message })
    };
  }
};

// 백그라운드 OpenAI API 호출
async function processOpenAIAsync(taskId, imageBase64, prompt) {
  try {
    console.log(`[Async Process] Starting OpenAI call for task ${taskId}`);
    
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OpenAI API key not found');
    }

    const imageBuffer = Buffer.from(imageBase64, 'base64');
    const boundary = '----OpenAIFormBoundary' + Date.now();
    
    // 공식 문서 기준 FormData 생성
    const formParts = [
      `--${boundary}`,
      'Content-Disposition: form-data; name="model"',
      '',
      'gpt-image-1',
      `--${boundary}`,
      'Content-Disposition: form-data; name="prompt"',
      '',
      prompt,
      `--${boundary}`,
      'Content-Disposition: form-data; name="size"',
      '',
      'auto',
      `--${boundary}`,
      'Content-Disposition: form-data; name="input_fidelity"',
      '',
      'high',
      `--${boundary}`,
      'Content-Disposition: form-data; name="quality"',
      '',
      'high',
      `--${boundary}`,
      'Content-Disposition: form-data; name="output_format"',
      '',
      'png',
      `--${boundary}`,
      'Content-Disposition: form-data; name="image[]"; filename="input.png"',
      'Content-Type: image/png',
      ''
    ];
    
    const textPart = formParts.join('\r\n') + '\r\n';
    const closingBoundary = `\r\n--${boundary}--\r\n`;
    
    const formData = Buffer.concat([
      Buffer.from(textPart, 'utf8'),
      imageBuffer,
      Buffer.from(closingBoundary, 'utf8')
    ]);

    const startTime = Date.now();
    
    const response = await fetch('https://api.openai.com/v1/images/edits', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`
      },
      body: formData
    });

    const responseTime = Date.now() - startTime;
    console.log(`[Async Process] OpenAI API response time: ${responseTime}ms`);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API Error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    
    if (data.data && data.data[0] && data.data[0].b64_json) {
      // 성공 결과 저장
      taskResults.set(taskId, {
        status: 'completed',
        result: {
          base64: data.data[0].b64_json,
          mimeType: 'image/png',
          url: `data:image/png;base64,${data.data[0].b64_json}`
        },
        processingTime: responseTime,
        completedAt: Date.now()
      });
      
      console.log(`[Async Process] Task ${taskId} completed successfully`);
    } else {
      throw new Error('No image data in OpenAI response');
    }
    
  } catch (error) {
    console.error(`[Async Process] Task ${taskId} failed:`, error);
    
    // 실패 결과 저장
    taskResults.set(taskId, {
      status: 'failed',
      error: error.message,
      failedAt: Date.now()
    });
  }
  
  // 1시간 후 자동 삭제
  setTimeout(() => {
    taskResults.delete(taskId);
    console.log(`[Async Process] Task ${taskId} cleaned up`);
  }, 3600000);
}
