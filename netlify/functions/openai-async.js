exports.config = { timeout: 26 };

// 단일 Function 내 메모리
const taskResults = new Map();

exports.handler = async (event, context) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS'
  };
  
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  // POST /openai-async = 작업 시작
  if (event.httpMethod === 'POST') {
    return await startTask(event, corsHeaders);
  }
  
  // GET /openai-async/taskId = 결과 확인
  if (event.httpMethod === 'GET') {
    return await checkTask(event, corsHeaders);
  }
  
  return { statusCode: 405, headers: corsHeaders, body: JSON.stringify({ error: 'Method not allowed' }) };
};

async function startTask(event, corsHeaders) {
  try {
    const { imageBase64, prompt } = JSON.parse(event.body);
    const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    taskResults.set(taskId, { status: 'processing', startTime: Date.now() });
    processOpenAIAsync(taskId, imageBase64, prompt);
    
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ taskId, status: 'started' })
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: error.message })
    };
  }
}

async function checkTask(event, corsHeaders) {
  const taskId = event.path.split('/').pop();
  const taskData = taskResults.get(taskId);
  
  if (!taskData) {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ status: 'not_found' })
    };
  }
  
  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({
      taskId,
      ...taskData,
      elapsedTime: Date.now() - taskData.startTime
    })
  };
}

// OpenAI 처리 (기존 openai-start.js의 processOpenAIAsync와 동일)
async function processOpenAIAsync(taskId, imageBase64, prompt) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OpenAI API key not found');

    const imageBuffer = Buffer.from(imageBase64, 'base64');
    const boundary = '----OpenAIFormBoundary' + Date.now();
    
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

    const response = await fetch('https://api.openai.com/v1/images/edits', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`
      },
      body: formData
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API Error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    
    if (data.data && data.data[0] && data.data[0].b64_json) {
      taskResults.set(taskId, {
        status: 'completed',
        result: {
          base64: data.data[0].b64_json,
          mimeType: 'image/png',
          url: `data:image/png;base64,${data.data[0].b64_json}`
        },
        completedAt: Date.now()
      });
    } else {
      throw new Error('No image data in OpenAI response');
    }
    
  } catch (error) {
    taskResults.set(taskId, {
      status: 'failed',
      error: error.message,
      failedAt: Date.now()
    });
  }
  
  setTimeout(() => taskResults.delete(taskId), 3600000);
}
