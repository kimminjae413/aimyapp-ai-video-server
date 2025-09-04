import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => {
    // 네트리파이 환경변수 직접 접근
    const geminiApiKey = process.env.GEMINI_API_KEY;
    
    console.log('🚀 Vite Config Debug:');
    console.log('- Build mode:', mode);
    console.log('- GEMINI_API_KEY available:', !!geminiApiKey);
    console.log('- API key length:', geminiApiKey?.length || 0);
    console.log('- First 10 chars:', geminiApiKey?.substring(0, 10) || 'N/A');
    
    return {
        define: {
            // 브라우저 전역 변수로 주입
            '__GEMINI_API_KEY__': JSON.stringify(geminiApiKey || ''),
            '__NODE_ENV__': JSON.stringify(mode),
            
            // process.env 객체도 생성
            'process.env': JSON.stringify({
                GEMINI_API_KEY: geminiApiKey || '',
                NODE_ENV: mode
            })
        },
        resolve: {
            alias: {
                '@': path.resolve(__dirname, '.'),
            }
        }
    };
});
