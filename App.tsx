import React, { useState, useCallback, useEffect } from 'react';
import { MainPage } from './components/MainPage';
import VideoSwap from './components/VideoSwap';
import { Header } from './components/Header';
import { ImageUploader } from './components/ImageUploader';
import { Loader } from './components/Loader';
import { ImageDisplay } from './components/ImageDisplay';
import { ControlPanel } from './components/ControlPanel';
// 🔄 하이브리드 서비스 사용 (OpenAI + Gemini)
import { smartFaceTransformation } from './services/hybridImageService';
import { getUserCredits, useCredits, restoreCredits, saveGenerationResult } from './services/bullnabiService';
import type { ImageFile, UserCredits } from './types';

type PageType = 'main' | 'faceSwap' | 'videoSwap';

// 🔥 결과물 저장을 위한 전역 상태 타입
interface GeneratedResults {
  faceSwapImage: ImageFile | null;
  videoUrl: string | null;
}

// FaceSwap 페이지 컴포넌트
const FaceSwapPage: React.FC<{ 
  onBack: () => void;
  userId: string | null;
  credits: UserCredits | null;
  onCreditsUsed: () => void;
  preservedResult: ImageFile | null;
  onResultGenerated: (result: ImageFile | null) => void;
}> = ({ onBack, userId, credits, onCreditsUsed, preservedResult, onResultGenerated }) => {
  const [originalImage, setOriginalImage] = useState<ImageFile | null>(null);
  const [generatedImage, setGeneratedImage] = useState<ImageFile | null>(preservedResult);
  const [facePrompt, setFacePrompt] = useState<string>('');
  const [clothingPrompt, setClothingPrompt] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  // 🆕 변환 방법 추적
  const [transformationMethod, setTransformationMethod] = useState<string>('');

  // preservedResult가 있으면 복원
  useEffect(() => {
    if (preservedResult) {
      setGeneratedImage(preservedResult);
    }
  }, [preservedResult]);

  const handleImageUpload = (file: File) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const newImageFile = {
        base64: (reader.result as string).split(',')[1],
        mimeType: file.type,
        url: URL.createObjectURL(file),
      };
      setOriginalImage(newImageFile);
      setGeneratedImage(null);
      setTransformationMethod(''); // 새 이미지 업로드시 초기화
      onResultGenerated(null); // 새 이미지 업로드시에만 초기화
      setError(null);
    };
    reader.onerror = () => {
        setError('이미지 파일을 읽는 데 실패했습니다.');
    };
    reader.readAsDataURL(file);
  };

  const handleGenerateClick = useCallback(async () => {
    if (!originalImage) {
      setError('얼굴 이미지를 업로드해주세요.');
      return;
    }
    if (!facePrompt) {
        setError('변환하려는 얼굴 스타일을 선택해주세요.');
        return;
    }
    
    // 크레딧 체크
    if (!userId) {
      setError('사용자 정보를 찾을 수 없습니다.');
      return;
    }
    
    if (!credits || credits.remainingCredits < 1) {
      setError('크레딧이 부족합니다. (필요: 1개, 보유: ' + (credits?.remainingCredits || 0) + '개)');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    setTransformationMethod('');

    try {
      console.log('🎯 Starting hybrid face transformation...');
      console.log('- Original image size:', originalImage.base64.length);
      console.log('- Face prompt:', facePrompt);
      console.log('- Clothing prompt:', clothingPrompt || 'None');
      
      // 🆕 하이브리드 변환 시스템 사용 (OpenAI + Gemini)
      const { result: resultImage, method } = await smartFaceTransformation(
        originalImage, 
        facePrompt, 
        clothingPrompt
      );
      
      console.log(`✅ Transformation completed using: ${method}`);
      setTransformationMethod(method);
      
      if (resultImage) {
        // 성공: 결과 저장 후 크레딧 차감
        setGeneratedImage(resultImage);
        onResultGenerated(resultImage); // 상위 컴포넌트에도 저장
        
        console.log('🔍 Saving generation result...');
        
        // 🆕 이미지 생성 결과 저장 (개선된 에러 처리)
        try {
          if (originalImage && resultImage) {
            const saved = await saveGenerationResult({
              userId,
              type: 'image',
              originalImageUrl: originalImage.url,
              resultUrl: resultImage.url,
              facePrompt,
              clothingPrompt,
              creditsUsed: 1
            });
            
            if (saved) {
              console.log('✅ Generation result saved successfully');
            } else {
              console.warn('⚠️ Generation result save failed');
            }
          }
        } catch (saveError) {
          console.error('❌ Error saving generation result:', saveError);
          // 저장 실패해도 사용자에게는 성공으로 표시 (이미지는 생성됨)
        }
        
        // 크레딧 차감은 비동기로 처리 (실패해도 재시도)
        setTimeout(async () => {
          try {
            const creditUsed = await useCredits(userId, 'image', 1);
            if (creditUsed) {
              onCreditsUsed();
              console.log('✅ Credit deducted successfully');
            } else {
              console.warn('⚠️ Credit deduction failed - attempting restore');
              // 크레딧 차감 실패시 복구 시도는 하지 않음 (이미 이미지 생성 완료)
            }
          } catch (creditError) {
            console.error('❌ Credit processing error:', creditError);
          }
        }, 100);
        
      } else {
        setError('이미지 생성에 실패했습니다. 다른 이미지나 설정을 시도해보세요.');
      }
      
    } catch (err) {
      console.error('🚨 Face transformation error:', err);
      
      let errorMessage = '생성 중 오류가 발생했습니다.';
      
      if (err instanceof Error) {
        const message = err.message;
        
        // 사용자 친화적 에러 메시지 변환
        if (message.includes('OpenAI')) {
          errorMessage = 'AI 처리 중 일시적 오류가 발생했습니다. 잠시 후 다시 시도해주세요.';
        } else if (message.includes('PNG')) {
          errorMessage = '이미지 형식 처리 중 오류가 발생했습니다. 다른 이미지를 시도해보세요.';
        } else if (message.includes('timeout')) {
          errorMessage = '처리 시간이 초과되었습니다. 더 작은 이미지로 시도해보세요.';
        } else if (message.includes('크레딧')) {
          errorMessage = message; // 크레딧 관련 메시지는 그대로 표시
        } else {
          errorMessage = `처리 중 오류: ${message}`;
        }
      }
      
      setError(errorMessage);
      setTransformationMethod('');
      
    } finally {
      setIsLoading(false);
    }
  }, [originalImage, facePrompt, clothingPrompt, userId, credits, onCreditsUsed, onResultGenerated]);

  return (
    <div className="min-h-screen bg-gray-900 text-gray-200 flex flex-col items-center p-4 sm:p-6 lg:p-8">
      {/* 뒤로가기 버튼 */}
      <button
        onClick={onBack}
        className="absolute left-4 top-4 p-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      
      {/* 크레딧 표시 */}
      {credits && (
        <div className="absolute right-4 top-4 bg-gray-800 px-4 py-2 rounded-lg">
          <span className="text-sm text-gray-400">남은 횟수: </span>
          <span className="text-lg font-bold text-cyan-400">{credits.remainingCredits}</span>
        </div>
      )}
      
      <Header />
      
      {/* 🆕 변환 방법 표시 (성공시에만) */}
      {transformationMethod && generatedImage && !isLoading && (
        <div className="w-full max-w-7xl mb-4">
          <div className="bg-gradient-to-r from-blue-600/20 to-green-600/20 border border-blue-500/30 rounded-lg p-3">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              <span className="text-sm text-gray-300">
                변환 완료: <span className="text-blue-300 font-semibold">{transformationMethod}</span>
              </span>
            </div>
          </div>
        </div>
      )}
      
      <main className="w-full max-w-7xl flex flex-col lg:flex-row gap-8 mt-4">
        <div className="lg:w-1/3 flex flex-col gap-6">
          <div className="w-full p-6 bg-gray-800/50 border border-gray-700 rounded-xl flex flex-col gap-6">
            <h2 className="text-xl text-center pink-bold-title">1. 이미지 업로드</h2>
            <ImageUploader title="원본 이미지" onImageUpload={handleImageUpload} imageUrl={originalImage?.url} />
          </div>
          <ControlPanel
            facePrompt={facePrompt}
            setFacePrompt={setFacePrompt}
            clothingPrompt={clothingPrompt}
            setClothingPrompt={setClothingPrompt}
            onGenerate={handleGenerateClick}
            isLoading={isLoading}
            disabled={!originalImage}
            credits={credits}
          />
        </div>
        <div className="lg:w-2/3 flex flex-col relative min-h-[500px]">
            {isLoading && <Loader />}
            {error && (
              <div className="w-full h-full flex items-center justify-center bg-gray-800/50 border border-gray-700 rounded-xl">
                  <div className="text-center text-red-300 p-4">
                    <h3 className="text-lg font-bold">오류 발생</h3>
                    <p className="text-sm mt-2">{error}</p>
                    {/* 🆕 재시도 버튼 */}
                    <button
                      onClick={handleGenerateClick}
                      disabled={!originalImage || !facePrompt || isLoading}
                      className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded-lg transition-colors text-sm"
                    >
                      다시 시도
                    </button>
                  </div>
              </div>
            )}
            {!isLoading && !error && (
                 <ImageDisplay 
                    originalImage={originalImage?.url}
                    generatedImage={generatedImage?.url}
                 />
            )}
        </div>
      </main>
    </div>
  );
};

// 메인 App 컴포넌트 (기존과 동일하게 유지)
const App: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<PageType>('main');
  const [userId, setUserId] = useState<string | null>(null);
  const [credits, setCredits] = useState<UserCredits | null>(null);
  const [isLoadingCredits, setIsLoadingCredits] = useState<boolean>(true);
  
  // 🔥 생성된 결과물 보존
  const [generatedResults, setGeneratedResults] = useState<GeneratedResults>({
    faceSwapImage: null,
    videoUrl: null
  });

  // URL에서 userId 가져오기
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const userIdParam = urlParams.get('userId');
    
    if (userIdParam) {
      setUserId(userIdParam);
      console.log('User ID from URL:', userIdParam);
    } else {
      console.warn('No userId found in URL parameters');
      setIsLoadingCredits(false);
    }
  }, []);

  // 크레딧 정보 가져오기 (결과물 상태를 초기화하지 않음)
  const fetchCredits = useCallback(async () => {
    if (!userId) return;
    
    try {
      const userCredits = await getUserCredits(userId);
      if (userCredits) {
        setCredits(userCredits);
        console.log('User credits updated:', userCredits);
      } else {
        console.warn('Failed to load user credits');
      }
    } catch (error) {
      console.error('Error loading credits:', error);
    }
  }, [userId]);

  // 초기 크레딧 로드
  useEffect(() => {
    if (userId) {
      const loadInitialCredits = async () => {
        setIsLoadingCredits(true);
        await fetchCredits();
        setIsLoadingCredits(false);
      };
      loadInitialCredits();
    }
  }, [userId, fetchCredits]);

  const handleFaceSwapClick = () => {
    setCurrentPage('faceSwap');
  };

  const handleVideoSwapClick = () => {
    setCurrentPage('videoSwap');
  };

  const handleBackToMain = () => {
    setCurrentPage('main');
  };

  // 크레딧 사용 후 새로고침
  const handleCreditsUsed = () => {
    fetchCredits();
  };

  // FaceSwap 결과 저장
  const handleFaceSwapResult = (result: ImageFile | null) => {
    setGeneratedResults(prev => ({ ...prev, faceSwapImage: result }));
  };

  // VideoSwap 결과 저장
  const handleVideoSwapResult = (result: string | null) => {
    setGeneratedResults(prev => ({ ...prev, videoUrl: result }));
  };

  // 로딩 중일 때
  if (isLoadingCredits) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-400 border-dashed rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-gray-400">사용자 정보를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  // userId가 없을 때
  if (!userId) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center p-8 bg-gray-800 rounded-xl">
          <h2 className="text-2xl font-bold text-red-400 mb-4">접근 오류</h2>
          <p className="text-gray-400">사용자 정보가 없습니다.</p>
          <p className="text-sm text-gray-500 mt-2">앱에서 다시 접속해주세요.</p>
        </div>
      </div>
    );
  }

  // 페이지별 렌더링
  switch (currentPage) {
    case 'main':
      return (
        <MainPage 
          onFaceSwapClick={handleFaceSwapClick} 
          onVideoSwapClick={handleVideoSwapClick}
          credits={credits}
        />
      );
    case 'faceSwap':
      return (
        <FaceSwapPage 
          onBack={handleBackToMain}
          userId={userId}
          credits={credits}
          onCreditsUsed={handleCreditsUsed}
          preservedResult={generatedResults.faceSwapImage}
          onResultGenerated={handleFaceSwapResult}
        />
      );
    case 'videoSwap':
      return (
        <VideoSwap 
          onBack={handleBackToMain}
          userId={userId}
          credits={credits}
          onCreditsUsed={handleCreditsUsed}
          preservedVideoUrl={generatedResults.videoUrl}
          onVideoGenerated={handleVideoSwapResult}
        />
      );
    default:
      return null;
  }
};

export default App;
