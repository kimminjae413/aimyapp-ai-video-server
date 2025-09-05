import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
    // 로컬 .env 파일 로드
    const env = loadEnv(mode, '.', '');
    
    // 네틸리파이 환경변수 우선, 없으면 로컬 .env 사용
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY || env.GEMINI_API_KEY;
    const KLING_ACCESS_KEY = process.env.KLING_ACCESS_KEY || env.KLING_ACCESS_KEY;
    const KLING_SECRET_KEY = process.env.KLING_SECRET_KEY || env.KLING_SECRET_KEY;
    
    // 디버깅용 로그 (배포 시 확인)
    console.log('🔧 Build Configuration:');
    console.log('- Mode:', mode);
    console.log('- GEMINI_API_KEY found:', !!GEMINI_API_KEY);
    console.log('- KLING_ACCESS_KEY found:', !!KLING_ACCESS_KEY);  // 추가
    console.log('- Source:', process.env.GEMINI_API_KEY ? 'Netlify' : 'Local .env');
    
    return {
      define: {
        'process.env.API_KEY': JSON.stringify(GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(GEMINI_API_KEY),
        'process.env.KLING_ACCESS_KEY': JSON.stringify(KLING_ACCESS_KEY),
        'process.env.KLING_SECRET_KEY': JSON.stringify(KLING_SECRET_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
