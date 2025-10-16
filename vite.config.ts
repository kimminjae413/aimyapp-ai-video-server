import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    // 로컬 .env 파일 로드
    const env = loadEnv(mode, '.', '');
    
    // 네틸리파이 환경변수 우선, 없으면 로컬 .env 사용
    
    // 🎯 VModel AI (1순위 얼굴교체)
    const VMODEL_API_TOKEN = process.env.VMODEL_API_TOKEN || env.VMODEL_API_TOKEN;
    
    // 🔍 Google Gemini (폴백 + 의상변경 + 비디오 생성)
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY || env.GEMINI_API_KEY;
    
    // 🔥 기존 AI 서비스들
    const KLING_ACCESS_KEY = process.env.KLING_ACCESS_KEY || env.KLING_ACCESS_KEY;
    const KLING_SECRET_KEY = process.env.KLING_SECRET_KEY || env.KLING_SECRET_KEY;
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY || env.OPENAI_API_KEY;
    
    // ☁️ 이미지 호스팅 서비스들 (VModel용 HTTP URL 생성)
    const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME || env.CLOUDINARY_CLOUD_NAME;
    const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY || env.CLOUDINARY_API_KEY;
    const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET || env.CLOUDINARY_API_SECRET;
    const IMGUR_CLIENT_ID = process.env.IMGUR_CLIENT_ID || env.IMGUR_CLIENT_ID;
    
    // 👤 사용자 관리
    const BULLNABI_TOKEN = process.env.BULLNABI_TOKEN || env.BULLNABI_TOKEN;
    
    // 디버깅용 로그 (배포 시 확인)
    console.log('🔧 Build Configuration:');
    console.log('- Mode:', mode);
    console.log('- Environment Source:', process.env.GEMINI_API_KEY ? 'Netlify' : 'Local .env');
    console.log('');
    
    // AI 서비스 상태
    console.log('🤖 AI Services:');
    console.log('- VMODEL_API_TOKEN found:', !!VMODEL_API_TOKEN);
    console.log('- GEMINI_API_KEY found:', !!GEMINI_API_KEY, '(⚠️ 비디오 생성에도 필수!)');
    console.log('- KLING_ACCESS_KEY found:', !!KLING_ACCESS_KEY, '(DEPRECATED)');
    console.log('- OPENAI_API_KEY found:', !!OPENAI_API_KEY);
    console.log('');
    
    // 이미지 호스팅 상태
    console.log('📤 Image Hosting:');
    console.log('- CLOUDINARY_CLOUD_NAME found:', !!CLOUDINARY_CLOUD_NAME);
    console.log('- CLOUDINARY_API_KEY found:', !!CLOUDINARY_API_KEY);
    console.log('- CLOUDINARY_API_SECRET found:', !!CLOUDINARY_API_SECRET);
    console.log('- IMGUR_CLIENT_ID found:', !!IMGUR_CLIENT_ID);
    console.log('');
    
    // 사용자 관리 상태
    console.log('👤 User Management:');
    console.log('- BULLNABI_TOKEN found:', !!BULLNABI_TOKEN);
    console.log('');
    
    // 서비스 우선순위 안내
    console.log('🎯 Service Priority:');
    console.log('- Face Swap: VModel AI → Firebase OpenAI → Gemini');
    console.log('- Image Hosting: Cloudinary → Imgur → Temp URL');
    console.log('- Clothing Change: Gemini AI (always)');
    console.log('- Video Generation: Gemini Veo 2/3.1 (NEW - replaces Kling)');
    console.log('  • 1 image → Veo 2 (5s, 1 credit)');
    console.log('  • 2 images → Veo 3.1 (10s, 3 credits)');
    console.log('');
    
    // 중요 경고
    if (!GEMINI_API_KEY) {
        console.warn('⚠️⚠️⚠️ WARNING: GEMINI_API_KEY is not set!');
        console.warn('Video generation will fail without this key.');
        console.warn('Please set it in Netlify Dashboard → Environment variables');
        console.warn('');
    }
    
    return {
      plugins: [react()],
      
      define: {
        // 🎯 VModel AI
        'process.env.VMODEL_API_TOKEN': JSON.stringify(VMODEL_API_TOKEN),
        
        // 🔍 Google Gemini (기존 호환성 유지 + 비디오 생성)
        'process.env.API_KEY': JSON.stringify(GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(GEMINI_API_KEY),
        
        // 🔥 기존 AI 서비스들
        'process.env.KLING_ACCESS_KEY': JSON.stringify(KLING_ACCESS_KEY),
        'process.env.KLING_SECRET_KEY': JSON.stringify(KLING_SECRET_KEY),
        'process.env.OPENAI_API_KEY': JSON.stringify(OPENAI_API_KEY),
        
        // ☁️ 이미지 호스팅 서비스들
        'process.env.CLOUDINARY_CLOUD_NAME': JSON.stringify(CLOUDINARY_CLOUD_NAME),
        'process.env.CLOUDINARY_API_KEY': JSON.stringify(CLOUDINARY_API_KEY),
        'process.env.CLOUDINARY_API_SECRET': JSON.stringify(CLOUDINARY_API_SECRET),
        'process.env.IMGUR_CLIENT_ID': JSON.stringify(IMGUR_CLIENT_ID),
        
        // 👤 사용자 관리
        'process.env.BULLNABI_TOKEN': JSON.stringify(BULLNABI_TOKEN)
      },
      
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
          '@components': path.resolve(__dirname, './components'),
          '@services': path.resolve(__dirname, './services'),
          '@types': path.resolve(__dirname, './types')
        }
      },
      
      // 개발 서버 설정
      server: {
        port: 5173,
        host: true,
        open: true
      },
      
      // 빌드 설정
      build: {
        outDir: 'dist',
        sourcemap: false,
        minify: 'esbuild',
        target: 'es2015',
        
        // 청크 크기 경고 제한 (500kb → 1000kb)
        chunkSizeWarningLimit: 1000,
        
        rollupOptions: {
          output: {
            // 청크 분할 최적화
            manualChunks: (id) => {
              // node_modules 분리
              if (id.includes('node_modules')) {
                if (id.includes('react') || id.includes('react-dom')) {
                  return 'react-vendor';
                }
                if (id.includes('react-router')) {
                  return 'router';
                }
                if (id.includes('react-icons')) {
                  return 'icons';
                }
                // 기타 라이브러리
                return 'vendor';
              }
            }
          }
        }
      },
      
      // 최적화
      optimizeDeps: {
        include: ['react', 'react-dom', '@google/generative-ai', 'form-data', 'axios']
      }
    };
});
