import React, { useState, useEffect } from 'react';
import { VideoIcon } from './icons/VideoIcon';
import { ImageUploader } from './ImageUploader';
import { Loader } from './Loader';
import { generateVideoWithKling, motionTemplates } from '../services/klingService';
import type { ImageFile } from '../types';

export const VideoSwap: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  // States
  const [originalImage, setOriginalImage] = useState<ImageFile | null>(null);
  const [prompt, setPrompt] = useState<string>('');
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [videoDuration, setVideoDuration] = useState<number>(5);
  const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string>('');
  const [showExitWarning, setShowExitWarning] = useState<boolean>(false);
  const [videoSaved, setVideoSaved] = useState<boolean>(false);

  // Pull-to-refresh 방지
  useEffect(() => {
    let touchStartY = 0;
    let touchEndY = 0;

    const handleTouchStart = (e: TouchEvent) => {
      touchStartY = e.touches[0].clientY;
    };

    const handleTouchMove = (e: TouchEvent) => {
      touchEndY = e.touches[0].clientY;
      
      // 스크롤이 맨 위이고 아래로 당기는 경우 방지
      if (window.scrollY === 0 && touchEndY > touchStartY && touchEndY - touchStartY > 10) {
        e.preventDefault();
      }
    };

    // 전체 문서에 overscroll 방지 적용
    document.documentElement.style.overscrollBehavior = 'none';
    document.body.style.overscrollBehavior = 'none';
    
    document.addEventListener('touchstart', handleTouchStart, { passive: false });
    document.addEventListener('touchmove', handleTouchMove, { passive: false });

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.documentElement.style.overscrollBehavior = 'auto';
      document.body.style.overscrollBehavior = 'auto';
    };
  }, []);

  // 페이지 나가기 방지 (새로고침, 탭 닫기)
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (generatedVideoUrl && !videoSaved) {
        e.preventDefault();
        e.returnValue = '⚠️ 생성된 영상을 저장하지 않았습니다. 페이지를 나가면 영상을 다시 볼 수 없습니다.';
        return e.returnValue;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [generatedVideoUrl, videoSaved]);

  // 브라우저 뒤로가기 방지
  useEffect(() => {
    if (generatedVideoUrl && !videoSaved) {
      // 가상의 히스토리 추가
      window.history.pushState(null, '', window.location.href);
      
      const handlePopState = () => {
        if (generatedVideoUrl && !videoSaved) {
          setShowExitWarning(true);
          // 다시 가상 히스토리 추가하여 뒤로가기 방지
          window.history.pushState(null, '', window.location.href);
        }
      };

      window.addEventListener('popstate', handlePopState);
      
      return () => {
        window.removeEventListener('popstate', handlePopState);
      };
    }
  }, [generatedVideoUrl, videoSaved]);

  // 안전한 뒤로가기
  const handleSafeBack = () => {
    if (generatedVideoUrl && !videoSaved) {
      setShowExitWarning(true);
    } else {
      onBack();
    }
  };

  const handleImageUpload = (file: File) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const newImageFile = {
        base64: (reader.result as string).split(',')[1],
        mimeType: file.type,
        url: URL.createObjectURL(file),
      };
      setOriginalImage(newImageFile);
      setGeneratedVideoUrl(null);
      setVideoSaved(false);
      setError(null);
    };
    reader.onerror = () => {
      setError('이미지 파일을 읽는 데 실패했습니다.');
    };
    reader.readAsDataURL(file);
  };

  const handleGenerateVideo = async () => {
    if (!originalImage) {
      setError('이미지를 업로드해주세요.');
      return;
    }
    
    const finalPrompt = selectedTemplate ? motionTemplates[selectedTemplate as keyof typeof motionTemplates] : prompt;
    
    if (!finalPrompt) {
      setError('영상으로 만들 동작이나 설명을 입력해주세요.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setGeneratedVideoUrl(null);
    setVideoSaved(false);
    setProgress('비디오 생성 작업을 시작하고 있습니다...');

    try {
      const videoUrl = await generateVideoWithKling(originalImage, finalPrompt, videoDuration);
      setGeneratedVideoUrl(videoUrl);
      setProgress('');
    } catch (err) {
      setError(`영상 생성 중 오류가 발생했습니다: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setProgress('');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTemplateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedTemplate(e.target.value);
    if (e.target.value) {
      setPrompt('');
    }
  };

  // iOS 다운로드 처리
  const handleDownload = async () => {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    
    if (isIOS) {
      // iOS는 새 탭에서 열기
      window.open(generatedVideoUrl, '_blank');
      // iOS에서는 새 탭에서 저장하는 것으로 간주
      setTimeout(() => setVideoSaved(true), 1000);
    } else {
      // 기타 기기는 직접 다운로드
      try {
        const response = await fetch(generatedVideoUrl!);
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = `hairgator-${Date.now()}.mp4`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        setTimeout(() => URL.revokeObjectURL(blobUrl), 100);
        setVideoSaved(true);
      } catch (error) {
        console.error('Download failed:', error);
        window.open(generatedVideoUrl, '_blank');
      }
    }
  };

  // 경고 모달 컴포넌트
  const ExitWarningModal = () => (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 border border-gray-600 rounded-xl p-6 max-w-sm w-full">
        <div className="flex items-center justify-center mb-4">
          <div className="w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center">
            <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
        </div>
        
        <h3 className="text-xl font-bold text-white text-center mb-2">
          영상을 저장하셨나요?
        </h3>
        
        <p className="text-gray-300 text-sm text-center mb-4">
          아직 영상을 저장하지 않으셨다면, 페이지를 나가면 <span className="text-red-400 font-bold">생성된 영상을 다시 볼 수 없습니다.</span>
        </p>
        
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 mb-6">
          <p className="text-yellow-200 text-xs text-center">
            💡 iOS: 다운로드 버튼 → 새 탭 → 길게 누르기 → 비디오 저장<br/>
            💡 Android/PC: 다운로드 버튼 클릭
          </p>
        </div>
        
        <div className="flex gap-3">
          <button
            onClick={() => {
              setShowExitWarning(false);
              setVideoSaved(true);
              onBack();
            }}
            className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
          >
            저장했어요, 나가기
          </button>
          <button
            onClick={() => setShowExitWarning(false)}
            className="flex-1 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium"
          >
            취소 (계속 보기)
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-900 text-gray-200 flex flex-col items-center p-4 sm:p-6 lg:p-8">
      {/* 경고 모달 */}
      {showExitWarning && <ExitWarningModal />}
      
      {/* Header */}
      <header className="text-center w-full mb-6">
        <button
          onClick={handleSafeBack}
          className="absolute left-4 top-4 p-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors group"
        >
          <svg className="w-6 h-6 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
          AI 헤어 영상 변환
        </h1>
        <p className="mt-2 text-lg text-gray-400">
          헤어 시술 후 사진을 자연스러운 리뷰 영상으로 변환해드립니다.
        </p>
      </header>

      <main className="w-full max-w-7xl flex flex-col lg:flex-row gap-8">
        {/* Left Panel */}
        <div className="lg:w-1/3 flex flex-col gap-6">
          <div className="w-full p-6 bg-gray-800/50 border border-gray-700 rounded-xl">
            <h2 className="text-xl text-center font-bold text-cyan-400 mb-4">1. 헤어 시술 후 사진 업로드</h2>
            <ImageUploader 
              title="고객 사진" 
              onImageUpload={handleImageUpload} 
              imageUrl={originalImage?.url} 
            />
            <p className="text-xs text-gray-500 mt-2 text-center">
              * 정면 또는 측면 사진 권장<br/>
              * 헤어스타일이 잘 보이는 사진 사용
            </p>
          </div>

          <div className="w-full p-6 bg-gray-800/50 border border-gray-700 rounded-xl">
            <h2 className="text-xl text-center font-bold text-cyan-400 mb-4">2. 영상 설정</h2>
            
            {/* Duration Selection */}
            <div className="mb-4">
              <label className="block mb-2 text-sm font-medium text-gray-300">영상 길이</label>
              <select
                value={videoDuration}
                onChange={(e) => setVideoDuration(Number(e.target.value))}
                className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-blue-500 focus:border-blue-500 transition"
              >
                <option value={5}>5초 (SNS 숏폼용)</option>
                <option value={10}>10초 (상세 리뷰용)</option>
              </select>
            </div>

            {/* Motion Templates */}
            <div className="mb-4">
              <label className="block mb-2 text-sm font-medium text-gray-300">헤어 영상 템플릿</label>
              <select
                value={selectedTemplate}
                onChange={handleTemplateChange}
                className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-blue-500 focus:border-blue-500 transition text-sm"
              >
                <option value="">✍️ 직접 입력 (영어 권장)</option>
                <optgroup label="💇‍♀️ 헤어 모델 포즈">
                  <option value="hairModelPose1">머리 좌우로 돌리며 스타일 보여주기</option>
                  <option value="hairModelPose2">손으로 머리 쓸어올리기</option>
                  <option value="hairModelPose3">다이나믹하게 머리 흔들기</option>
                </optgroup>
                <optgroup label="😊 헤어 리뷰 모션">
                  <option value="hairReview1">만족하며 거울보듯 확인하기</option>
                  <option value="hairReview2">행복하게 머리 만지며 감탄</option>
                  <option value="hairReview3">앞머리 정리하며 수줍은 미소</option>
                </optgroup>
                <optgroup label="🙈 자연스러운 일반인 포즈">
                  <option value="naturalPose1">수줍다가 자신감 있게 웃기</option>
                  <option value="naturalPose2">부끄러워하다가 활짝 웃기</option>
                  <option value="naturalPose3">머리 넘기며 수줍게 웃기</option>
                </optgroup>
                <optgroup label="✨ 헤어 디테일 보여주기">
                  <option value="showDetail1">180도 회전하며 뒷머리 보여주기</option>
                  <option value="showDetail2">레이어드컷/펌 움직임 보여주기</option>
                  <option value="showDetail3">머리 질감과 결 보여주기</option>
                </optgroup>
                <optgroup label="🎉 변화 리액션">
                  <option value="transformation1">변화에 놀란 표정</option>
                  <option value="transformation2">새 스타일에 감탄하기</option>
                </optgroup>
                <optgroup label="💕 살롱 분위기">
                  <option value="salonVibe1">시술 후 만족스럽게 일어나기</option>
                  <option value="salonVibe2">즐거운 분위기 표현</option>
                </optgroup>
              </select>
            </div>

            {/* Custom Prompt */}
            <div className="mb-4">
              <label className="block mb-2 text-sm font-medium text-gray-300">
                {selectedTemplate ? '선택된 템플릿 사용 중' : '커스텀 프롬프트 (영어 권장)'}
              </label>
              <textarea
                value={prompt}
                onChange={(e) => {
                  setPrompt(e.target.value);
                  setSelectedTemplate('');
                }}
                placeholder={selectedTemplate ? 
                  '템플릿이 선택되었습니다. 직접 입력하려면 위에서 "직접 입력"을 선택하세요.' :
                  '예시:\n영어(권장): Person checking their new hairstyle with shy smile, slowly turning head to show all angles\n\n한국어도 가능하지만 영어가 더 정확하게 반영됩니다.'}
                className="w-full h-32 p-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-blue-500 focus:border-blue-500 transition resize-none text-sm"
                disabled={!!selectedTemplate}
              />
              {!selectedTemplate && (
                <p className="text-xs text-gray-500 mt-1">
                  💡 영어 프롬프트가 더 정확하게 반영됩니다 | 최대 2500자
                </p>
              )}
            </div>
            
            {progress && (
              <div className="mt-3 text-sm text-cyan-400 animate-pulse">
                {progress}
              </div>
            )}
            
            <button
              onClick={handleGenerateVideo}
              disabled={isLoading || !originalImage || (!prompt && !selectedTemplate)}
              className="w-full mt-4 flex items-center justify-center px-6 py-3.5 text-base font-semibold text-white bg-gradient-to-r from-blue-600 to-cyan-600 rounded-lg hover:from-blue-700 hover:to-cyan-700 focus:ring-4 focus:outline-none focus:ring-blue-800 disabled:bg-gray-600 disabled:cursor-not-allowed transition-all duration-300"
            >
              {isLoading ? (
                '처리 중... (최대 5분 소요)'
              ) : (
                <>
                  <VideoIcon className="w-5 h-5 mr-2" />
                  영상 생성하기
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right Panel - Result */}
        <div className="lg:w-2/3 flex flex-col relative min-h-[500px]">
          {isLoading && <Loader />}
          
          {error && (
            <div className="w-full h-full flex items-center justify-center bg-gray-800/50 border border-gray-700 rounded-xl">
              <div className="text-center text-red-300 p-4">
                <h3 className="text-lg font-bold">오류 발생</h3>
                <p className="text-sm">{error}</p>
                {error.includes('CORS') && (
                  <div className="mt-3 text-xs text-gray-400">
                    <p>브라우저 보안 정책으로 인한 문제입니다.</p>
                    <p>서버 측 프록시 구현이 필요합니다.</p>
                  </div>
                )}
                {error.includes('balance') && (
                  <div className="mt-3 text-xs text-gray-400">
                    <p>API 크레딧이 부족합니다.</p>
                    <p>Kling API 리소스 패키지를 구매해주세요.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {!isLoading && !error && (
            <div className="w-full h-full bg-gray-800/50 border border-gray-700 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-gray-300 mb-4 text-center">결과 영상</h3>
              {generatedVideoUrl ? (
                <>
                  {/* 저장 안내 배너 */}
                  {!videoSaved && (
                    <div className="mb-4 bg-yellow-500/10 border border-yellow-500/50 rounded-lg p-3 flex items-center gap-3">
                      <svg className="w-5 h-5 text-yellow-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      <p className="text-yellow-200 text-sm">
                        ⚠️ 영상을 저장하지 않으면 페이지를 나갈 때 사라집니다!
                      </p>
                    </div>
                  )}
                  
                  <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden">
                    <video 
                      controls 
                      autoPlay
                      loop
                      muted
                      playsInline
                      webkit-playsinline="true"
                      className="w-full h-full"
                      src={generatedVideoUrl}
                      onError={(e) => {
                        console.error('Video playback error:', e);
                        setError('비디오 재생 오류: 형식이 지원되지 않을 수 있습니다.');
                      }}
                    >
                      브라우저가 비디오 재생을 지원하지 않습니다.
                    </video>
                    
                    {/* 다운로드 버튼 */}
                    <button
                      onClick={handleDownload}
                      className={`absolute bottom-4 right-4 p-3 backdrop-blur-sm rounded-full text-white transition-all group ${
                        videoSaved 
                          ? 'bg-green-600/70 hover:bg-green-700' 
                          : 'bg-red-600/70 hover:bg-red-700 animate-pulse'
                      }`}
                      title={videoSaved ? '저장 완료' : '영상 다운로드 (필수!)'}
                    >
                      {videoSaved ? (
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <svg className="w-6 h-6 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                      )}
                    </button>
                    
                    {/* iOS용 추가 안내 */}
                    {/iPad|iPhone|iPod/.test(navigator.userAgent) && !videoSaved && (
                      <div className="absolute top-4 left-4 right-14 bg-black/80 text-white text-xs p-3 rounded-lg">
                        <p className="font-bold mb-1">📱 iOS 저장 방법:</p>
                        <p>1. 다운로드 버튼 터치</p>
                        <p>2. 새 탭에서 영상 열림</p>
                        <p>3. 화면 길게 누르기</p>
                        <p>4. "비디오 저장" 선택</p>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="w-full aspect-video bg-gray-800 rounded-xl flex flex-col items-center justify-center text-gray-500">
                  <VideoIcon className="w-16 h-16 mb-4" />
                  <p className="text-lg font-medium">헤어 리뷰 영상 대기 중</p>
                  <p className="text-sm mt-2 text-gray-600">사진을 업로드하고 템플릿을 선택한 후 생성 버튼을 눌러주세요</p>
                  <div className="mt-6 text-xs text-gray-600 max-w-md text-center">
                    <p className="font-medium mb-2">💡 활용 팁</p>
                    <p>• 고객이 직접 포즈를 취하기 부담스러워할 때</p>
                    <p>• SNS 마케팅용 동영상이 필요할 때</p>
                    <p>• 시술 전후 비교 영상을 만들고 싶을 때</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
