// netlify/functions/openai-proxy.js - 순수 gpt-image-1 Edit API
exports.config = { timeout: 26 };

exports.handler = async (event, context) => {
  const startTime = Date.now();
  console.log('[OpenAI Proxy] PURE gpt-image-1 Edit API - NO GPT4V - VERSION 2.0');
  console.log('[OpenAI Proxy] Remaining time:', context.getRemainingTimeInMillis(), 'ms');
  
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
    console.error('[OpenAI Proxy] Missing API key');
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'API key missing' })
    };
  }

  try {
    const { imageBase64, prompt } = JSON.parse(event.body);
    
    console.log('[gpt-image-1] Direct Edit API call starting');
    console.log('[gpt-image-1] Image size:', Math.round(imageBase64?.length / 1024) + 'KB');
    console.log('[gpt-image-1] Prompt length:', prompt?.length);

    if (!imageBase64 || !prompt) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Missing imageBase64 or prompt' })
      };
    }

    // 🛡️ **핵심 추가 1: 타임아웃 보호** (24초 후 강제 중단)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      console.log('[gpt-image-1] ⚠️ 24초 타임아웃 - 강제 중단');
      controller.abort();
    }, 24000); // Netlify 26초 한도 고려

    try {
      const imageBuffer = Buffer.from(imageBase64, 'base64');
      const boundary = '----gpt1edit' + Date.now();
      
      // gpt-image-1 Edit API FormData
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
        'hd', // 🔧 **수정**: 'high' → 'hd' (올바른 값)
        `--${boundary}`,
        'Content-Disposition: form-data; name="image"; filename="input.png"',
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

      console.log('[gpt-image-1] FormData created, calling API...');
      const apiStartTime = Date.now();
      
      // 직접 gpt-image-1 Edit API 호출 + 타임아웃 보호
      const response = await fetch('https://api.openai.com/v1/images/edits', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          // 🆕 **핵심 추가 3: User-Agent** (API 호출 추적용)
          'User-Agent': 'HairGator-gpt-image-1/2.0'
        },
        body: formData,
        signal: controller.signal // 🛡️ **타임아웃 보호 연결**
      });

      clearTimeout(timeoutId); // 성공시 타임아웃 해제

      const responseTime = Date.now() - apiStartTime;
      const totalTime = Date.now() - startTime;
      
      console.log('[gpt-image-1] API responded in:', responseTime + 'ms');
      console.log('[gpt-image-1] Total time:', totalTime + 'ms');
      console.log('[gpt-image-1] Status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[gpt-image-1] API Error:', response.status, errorText.substring(0, 200));
        return {
          statusCode: response.status,
          headers: corsHeaders,
          body: JSON.stringify({ 
            error: `gpt-image-1 API Error: ${response.status}`,
            details: errorText.substring(0, 100),
            useGeminiFallback
