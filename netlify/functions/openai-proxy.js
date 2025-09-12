// netlify/functions/openai-proxy.js
exports.handler = async (event, context) => {
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
    
    // Base64를 Buffer로 변환
    const imageBuffer = Buffer.from(imageBase64, 'base64');
    
    // FormData 생성
    const formData = new FormData();
    formData.append('model', 'gpt-image-1');
    formData.append('prompt', prompt);
    formData.append('input_fidelity', 'high');
    formData.append('quality', 'high');
    formData.append('size', 'auto');
    formData.append('output_format', 'png');
    
    // 이미지를 Blob으로 추가
    const blob = new Blob([imageBuffer], { type: 'image/png' });
    formData.append('image', blob, 'image.png');

    const response = await fetch('https://api.openai.com/v1/images/edits', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        // Content-Type 헤더는 FormData가 자동으로 설정
      },
      body: formData
    });

    const data = await response.json();
    
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify(data)
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: error.message })
    };
  }
};
