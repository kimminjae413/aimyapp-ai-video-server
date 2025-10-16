import React, { useState, useCallback, useEffect } from 'react';
import { MainPage } from './components/MainPage';
import VideoSwap from './components/VideoSwap';
import { Header } from './components/Header';
import { ImageUploader } from './components/ImageUploader';
import { Loader } from './components/Loader';
import { ImageDisplay } from './components/ImageDisplay';
import { ControlPanel } from './components/ControlPanel';
// VModel 우선 변환 서비스
import { smartFaceTransformation } from './services/hybridImageService';
import { getUserCredits, useCredits, saveGenerationResult } from './services/bullnabiService';
import { uploadImage } from './services/imageHostingService';
import type { ImageFile, UserCredits } from './types';

type PageType = 'main' | 'faceSwap' | 'videoSwap';

// 결과물 저장을 위한 전역 상태 타입
interface GeneratedResults {
  faceSwapImage: ImageFile | null;
  videoUrl: string | null;
}

// FaceSwap 페이지 컴포넌트 (VModel 참조이미지 전용)
const FaceSwapPage: React.FC<{ 
  onBack: () => void;
  userId: string | null;
  credits: UserCredits | null;
  onCreditsUsed: () => void;
  preservedResult: ImageFile | null;
  onResultGenerated: (result: ImageFile | null) => void;
}> = ({ onBack, userId, credits, onCreditsUsed, preservedResult, onResultGenerated }) => {
  const [originalImage, setOriginalImage] = useState<ImageFile | null>(null);
  const [referenceImage, setReferenceImage] = useState<ImageFile | null>(null);
  const [generatedImage, setGeneratedImage] = useState<ImageFile | null>(preservedResult);
  const [clothingPrompt, setClothingPrompt] = useState<string>('');
  const [backgroundPrompt, setBackgroundPrompt] = useState<string>(''); // ✅ 배경 프롬프트 추가
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
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
      setTransformationMethod('');
      onResultGenerated(null);
      setError(null);
    };
    reader.onerror = () => {
        setError('이미지 파일을 읽는 데 실패했습니다.');
    };
    reader.readAsDataURL(file);
  };

  const handleReferenceImageUpload = (file: File) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const newImageFile = {
        base64: (reader.result as string).split(',')[1],
        mimeType: file.type,
        url: URL.createObjectURL(file),
      };
      setReferenceImage(newImageFile);
      setError(null);
    };
    reader.onerror = () => {
        setError('참조 이미지 파일을 읽는 데 실패했습니다.');
    };
    reader.readAsDataURL(file);
  };

  // 🔥 VModel 참조이미지 전용 생성 함수 (배경 프롬프트 추가)
  const handleGenerateClick = useCallback(async () => {
    if (!originalImage) {
      setError('원본 이미지를 업로드해주세요.');
      return;
    }
    
    if (!referenceImage) {
      setError('참조 얼굴 이미지를 업로드해주세요.');
      return;
    }
    
    if (!userId || !credits || credits.remainingCredits < 1) {
      setError(`크레딧이 부족합니다. (필요: 1개, 보유: ${credits?.remainingCredits || 0}개)`);
      return;
    }
    
    setIsLoading(true);
    setError(null);
    setTransformationMethod('');

    try {
      console.log('🎯 VModel 참조이미지 얼굴교체 시작...');
      console.log('- 원본 이미지 크기:', originalImage.base64.length);
      console.log('- 참조 이미지 크기:', referenceImage.base64.length);
      console.log('- 의상 변경:', clothingPrompt || 'None');
      console.log('- 배경 변경:', backgroundPrompt || 'None'); // ✅ 배경 로그 추가
      
      // Step 1: 얼굴 교체 수행 (배경 프롬프트 포함)
      const { result: resultImage, method } = await smartFaceTransformation(
        originalImage,        // 원본 이미지
        '',                  // facePrompt (빈 문자열)
        clothingPrompt,      // 의상 프롬프트
        referenceImage,      // 참조 이미지
        (status: string) => { // onProgress 콜백
          console.log('진행 상황:', status);
        },
        backgroundPrompt     // ✅ 배경 프롬프트 추가 (6번째 파라미터)
      );
      
      console.log(`✅ 얼굴교체 완료: ${method}`);
      setTransformationMethod(method);
      
      if (resultImage) {
        // UI에 즉시 표시
        setGeneratedImage(resultImage);
        onResultGenerated(resultImage);
        
        // ✅ Step 2: 이미지 업로드 및 DB 저장
        try {
          console.log('📤 결과 이미지 Cloudinary/Imgur 업로드 중...');
          
          const uploadedResultUrl = await uploadImage(resultImage, 'faceswap_results');
          
          console.log('✅ 이미지 업로드 완료:', uploadedResultUrl.substring(0, 60) + '...');
          
          // DB에 업로드된 URL 저장
          const saved = await saveGenerationResult({
            userId,
            type: 'image',
            originalImageUrl: 'N/A',
            resultUrl: uploadedResultUrl,
            facePrompt: '참조이미지 기반 VModel',
            clothingPrompt: clothingPrompt || backgroundPrompt 
              ? `의상: ${clothingPrompt || '변경안함'} / 배경: ${backgroundPrompt || '변경안함'}` 
              : undefined, // ✅ 배경 정보 포함
            creditsUsed: 1
          });
          
          if (saved) {
            console.log('✅ 생성 결과 DB 저장 성공');
          } else {
            console.warn('⚠️ DB 저장 실패 (비치명적)');
          }
        } catch (uploadError) {
          console.error('❌ 이미지 업로드/저장 실패:', uploadError);
        }
        
        // ✅ Step 3: 크레딧 차감 (비동기)
        setTimeout(async () => {
          try {
            const creditUsed = await useCredits(userId, 'image', 1);
            if (creditUsed) {
              onCreditsUsed();
              console.log('✅ 크레딧 차감 완료');
            }
          } catch (creditError) {
            console.error('❌ 크레딧 차감 실패:', creditError);
          }
        }, 100);
        
      } else {
        setError('이미지 생성에 실패했습니다. 다른 이미지로 시도해보세요.');
      }
      
    } catch (err) {
      console.error('🚨 얼굴교체 오류:', err);
      
      let errorMessage = '얼굴교체 중 오류가 발생했습니다.';
      
      if (err instanceof Error) {
        const message = err.message;
        
        if (message.includes('VModel')) {
          errorMessage = 'VModel AI 처리 중 일시적 오류가 발생했습니다. 잠시 후 다시 시도해주세요.';
        } else if (message.includes('Cloudinary') || message.includes('Imgur')) {
          errorMessage = '이미지 업로드 중 오류가 발생했습니다. 다른 이미지로 시도해보세요.';
        } else if (message.includes('크레딧')) {
          errorMessage = message;
        } else if (message.includes('timeout')) {
          errorMessage = '처리 시간이 초과되었습니다. 더 작은 이미지로 시도해보세요.';
        } else if (message.includes('함수')) {
          errorMessage = '시스템 오류가 발생했습니다. 페이지를 새로고침 후 다시 시도해주세요.';
        } else {
          errorMessage = `처리 오류: ${message}`;
        }
      }
      
      setError(errorMessage);
      setTransformationMethod('');
      
    } finally {
      setIsLoading(false);
    }
  }, [originalImage, referenceImage, clothingPrompt, backgroundPrompt, userId, credits, onCreditsUsed, onResultGenerated]); // ✅ backgroundPrompt 의존성 추가

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
      
     {/* 변환 완료 표시 */}
      {transformationMethod && generatedImage && !isLoading && (
        <div className="w-full max-w-7xl mb-4">
          <div className="bg-gradient-to-r from-green-600/20 to-blue-600/20 border-green-500/30 border rounded-lg p-3">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full animate-pulse bg-green-400"></div>
              <span className="text-sm text-gray-300">
                <span className="font-semibold text-green-300">변환 완료!</span>
              </span>
            </div>
          </div>
        </div>
      )}
      
      <main className="w-full max-w-7xl flex flex-col lg:flex-row gap-8 mt-4">
        <div className="lg:w-1/3 flex flex-col gap-6">
          {/* 원본 이미지 업로드 */}
          <div className="w-full p-6 bg-gray-800/50 border border-gray-700 rounded-xl flex flex-col gap-6">
            <h2 className="text-xl text-center pink-bold-title">1. 원본 이미지 업로드</h2>
            <ImageUploader title="교체될 얼굴 이미지" onImageUpload={handleImageUpload} imageUrl={originalImage?.url} />
          </div>
          
          {/* 참조 이미지 업로드 */}
          <div className="w-full p-6 bg-gray-800/50 border border-gray-700 rounded-xl flex flex-col gap-6">
            <h2 className="text-xl text-center text-green-400 font-bold">2. 참조 얼굴 이미지 업로드</h2>
            <ImageUploader title="이 얼굴로 교체됩니다" onImageUpload={handleReferenceImageUpload} imageUrl={referenceImage?.url} />
            <p className="text-xs text-gray-400 text-center">
              💡 선명하고 정면을 향한 얼굴 사진을 사용하면 더 좋은 결과를 얻을 수 있습니다
            </p>
          </div>
          
          {/* 의상 & 배경 변경 (선택사항) */}
          <div className="w-full p-6 bg-gray-800/50 border border-gray-700 rounded-xl">
            <h2 className="text-xl text-center text-cyan-400 font-bold mb-4">3. 스타일 변경 (선택사항)</h2>
            
            {/* 의상 변경 */}
            <div className="mb-4">
              <label className="block mb-2 text-sm font-medium text-gray-300">의상 스타일</label>
              <select
                value={clothingPrompt}
                onChange={(e) => setClothingPrompt(e.target.value)}
                className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-blue-500 focus:border-blue-500 transition"
              >
                <option value="">변경하지 않음</option>
                <option value="A sophisticated business suit">세련된 정장</option>
                <option value="A casual hoodie and jeans">캐주얼 후드티</option>
                <option value="A clean white t-shirt">깔끔한 흰 티셔츠</option>
                <option value="A warm knit sweater">따뜻한 니트</option>
                <option value="A professional office blouse">단정한 블라우스</option>
                <option value="A simple elegant dress">심플한 원피스</option>
              </select>
            </div>

            {/* ✅ 배경 변경 추가 */}
            <div className="mb-4">
              <label className="block mb-2 text-sm font-medium text-gray-300">배경 스타일</label>
              <select
                value={backgroundPrompt}
                onChange={(e) => setBackgroundPrompt(e.target.value)}
                className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-purple-500 focus:border-purple-500 transition"
              >
                <option value="">변경하지 않음</option>
                <option value="white cement textured wall background">하얀 시멘트 벽</option>
                <option value="beige curtain background">베이지색 커튼</option>
                <option value="clean white studio background">화이트 스튜디오</option>
                <option value="gray studio background">회색 스튜디오</option>
                <option value="warm wooden wall background">따뜻한 나무 벽면</option>
                <option value="vintage brick wall background">빈티지 벽돌 벽</option>
                <option value="soft gradient background">부드러운 그라데이션</option>
                <option value="natural outdoor background">자연스러운 야외</option>
                <option value="soft bokeh blur background">흐릿한 보케 배경</option>
              </select>
            </div>

            {/* 선택된 옵션 표시 */}
            {(clothingPrompt || backgroundPrompt) && (
              <div className="mb-4 p-3 bg-blue-900/20 border border-blue-700/50 rounded-lg">
                <p className="text-xs text-blue-200">
                  {clothingPrompt && `👔 의상: ${clothingPrompt}`}
                  {clothingPrompt && backgroundPrompt && <br />}
                  {backgroundPrompt && `🎨 배경: ${backgroundPrompt}`}
                </p>
              </div>
            )}
            
            {/* 크레딧 부족 경고 */}
            {credits && credits.remainingCredits < 1 && (
              <div className="bg-red-900/30 border border-red-600/50 rounded-lg p-3 mb-4">
                <p className="text-sm text-red-400">
                  크레딧이 부족합니다. 얼굴 변환에는 1개의 크레딧이 필요합니다.
                </p>
              </div>
            )}
            
            {/* 생성 버튼 */}
            <button
              onClick={handleGenerateClick}
              disabled={isLoading || !originalImage || !referenceImage || (credits && credits.remainingCredits < 1)}
              className={`w-full mt-4 flex items-center justify-center px-6 py-3.5 text-base font-semibold text-white rounded-lg transition-all duration-300 ${
                isLoading || !originalImage || !referenceImage || (credits && credits.remainingCredits < 1)
                  ? 'bg-gray-600 cursor-not-allowed'
                  : 'bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700'
              }`}
            >
              {isLoading ? (
                '처리 중... (AI 분석 중)'
              ) : !originalImage ? (
                '원본 이미지를 업로드하세요'
              ) : !referenceImage ? (
                '참조 얼굴 이미지를 업로드하세요'
              ) : credits && credits.remainingCredits < 1 ? (
                '크레딧 부족 (1개 필요)'
              ) : (
                <>
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  얼굴 교체하기 (1회 차감)
                </>
              )}
            </button>
          </div>
        </div>
        
        <div className="lg:w-2/3 flex flex-col relative min-h-[500px]">
            {isLoading && <Loader />}
            {error && (
              <div className="w-full h-full flex items-center justify-center bg-gray-800/50 border border-gray-700 rounded-xl">
                  <div className="text-center text-red-300 p-4">
                    <h3 className="text-lg font-bold">오류 발생</h3>
                    <p className="text-sm mt-2">{error}</p>
                    <button
                      onClick={handleGenerateClick}
                      disabled={!originalImage || !referenceImage || isLoading}
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

// 메인 App 컴포넌트
const App: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<PageType>('main');
  const [userId, setUserId] = useState<string | null>(null);
  const [credits, setCredits] = useState<UserCredits | null>(null);
  const [isLoadingCredits, setIsLoadingCredits] = useState<boolean>(true);
  
  // 생성된 결과물 보존
  const [generatedResults, setGeneratedResults] = useState<GeneratedResults>({
    faceSwapImage: null,
    videoUrl: null
  });

  // URL에서 userId 가져오기 + 서비스 연결 테스트
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

    // 서비스 연결 상태 확인
    const checkServices = async () => {
      console.log('🚀 ===== 서비스 연결 테스트 시작 =====');
      
      // 1. VModel AI 연결 테스트
      try {
        const { checkVModelAvailability } = await import('./services/hybridImageService');
        const vmodelConnected = await checkVModelAvailability();
        console.log('🎯 VModel AI 연결 상태:', {
          connected: vmodelConnected,
          hasToken: !!process.env.VMODEL_API_TOKEN,
          hasCloudinary: !!(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY),
          status: vmodelConnected ? '✅ 사용 가능' : '❌ 연결 실패'
        });
        
        // VModel 공식 예시 테스트
        if (process.env.VMODEL_API_TOKEN && vmodelConnected) {
          try {
            const vmodelService = await import('./services/vmodelService');
            if (vmodelService.testVModelWithOfficialExample) {
              await vmodelService.testVModelWithOfficialExample();
            }
          } catch (testError) {
            console.warn('⚠️ VModel 공식 예시 테스트 건너뜀:', testError);
          }
        }
        
      } catch (vmodelError) {
        console.warn('⚠️ VModel 연결 테스트 실패:', vmodelError);
      }
      
      // 2. Gemini AI 상태 확인
      try {
        const { getServiceStatus } = await import('./services/geminiService');
        const geminiStatus = getServiceStatus();
        console.log('🔍 Gemini AI 상태:', {
          model: geminiStatus.model,
          version: geminiStatus.version,
          hasApiKey: !!process.env.GEMINI_API_KEY,
          status: '✅ 폴백 준비 완료'
        });
      } catch (geminiError) {
        console.warn('⚠️ Gemini 상태 확인 실패:', geminiError);
      }
      
      console.log('🚀 ===== 서비스 테스트 완료 =====');
    };
    
    checkServices();
  }, []);

  // 크레딧 정보 가져오기
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

  const handleCreditsUsed = () => {
    fetchCredits();
  };

  const handleFaceSwapResult = (result: ImageFile | null) => {
    setGeneratedResults(prev => ({ ...prev, faceSwapImage: result }));
  };

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
