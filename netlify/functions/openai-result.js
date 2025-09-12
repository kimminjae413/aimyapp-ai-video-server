// netlify/functions/openai-result.js - 비동기 작업 결과 확인
exports.config = { timeout: 5 }; // 빠른 조회

// 동일한 메모리 저장소 참조 (openai-start.js와 공유)
const taskResults = new Map();

exports.handler = async (event, context) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS'
  };
  
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  try {
    // URL에서 taskId 추출: /.netlify/functions/openai-result/task_xxx
    const pathParts = event.path.split('/');
    const taskId = pathParts[pathParts.length - 1];
    
    if (!taskId || !taskId.startsWith('task_')) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Invalid task ID' })
      };
    }

    console.log(`[Async Result] Checking task ${taskId}`);
    
    const taskData = taskResults.get(taskId);
    
    if (!taskData) {
      // 작업을 찾을 수 없음 (만료되었거나 존재하지 않음)
      return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify({ 
          status: 'not_found',
          message: 'Task not found or expired' 
        })
      };
    }
    
    // 진행 시간 계산
    const now = Date.now();
    const elapsedTime = now - taskData.startTime;
    
    const response = {
      taskId,
      ...taskData,
      elapsedTime
    };
    
    // 상태별 로깅
    if (taskData.status === 'processing') {
      console.log(`[Async Result] Task ${taskId} still processing (${Math.round(elapsedTime/1000)}s)`);
    } else if (taskData.status === 'completed') {
      console.log(`[Async Result] Task ${taskId} completed, returning result`);
    } else if (taskData.status === 'failed') {
      console.log(`[Async Result] Task ${taskId} failed: ${taskData.error}`);
    }
    
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify(response)
    };
    
  } catch (error) {
    console.error('[Async Result] Error:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ 
        status: 'error',
        error: error.message 
      })
    };
  }
};
