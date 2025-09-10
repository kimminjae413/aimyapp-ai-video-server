import React, { useState, useEffect } from 'react';
import { VideoIcon } from './icons/VideoIcon';
import { ImageUploader } from './ImageUploader';
import { Loader } from './Loader';
import { generateVideoWithKling, motionTemplates } from '../services/klingService';
import { useCredits, restoreCredits } from '../services/bullnabiService';
import type { ImageFile, UserCredits } from '../types';

interface VideoSwapProps {
  onBack: () => void;
  userId: string | null;
  credits: UserCredits | null;
  onCreditsUsed: () => void;
  preservedVideoUrl?: string | null;
  onVideoGenerated?: (url: string | null) => void;
}

const VideoSwap: React.FC<VideoSwapProps> = ({ 
  onBack, 
  userId, 
  credits, 
  onCreditsUsed, 
  preservedVideoUrl, 
  onVideoGenerated 
}) => {
  // States
  const [originalImage, setOriginalImage] = useState<ImageFile | null>(null);
  const [prompt, setPrompt] = useState<string>('');
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [videoDuration, setVideoDuration] = useState<number>(5);
  const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string | null>(preservedVideoUrl || null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string>('');
  const [showExitWarning, setShowExitWarning] = useState<boolean>(false);
  const [videoSaved, setVideoSaved] = useState<boolean>(false);
  const [showIOSGuide, setShowIOSGuide] = useState<boolean>(false);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [downloadStatus, setDownloadStatus] = useState<string | null>(null);

  // 환경 감지 함수들
  const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isAndroid = () => /Android/i.test(navigator.userAgent);
  const isWebView = () => {
    const ua = navigator.userAgent;
    return (
      isIOS() && !ua.includes('Safari/') ||
      isAndroid() && ua.includes('wv') ||
      // 기타 웹뷰 패턴들
      ua.includes('WebView') ||
      ua.includes('Version/') && !ua.includes('Mobile Safari')
    );
  };

  // preservedVideoUrl이 있으면 복원
  useEffect(() => {
    if (preservedVideoUrl) {
      setGeneratedVideoUrl(preservedVideoUrl);
    }
  }, [preservedVideoUrl]);

  // Pull-to-refresh 방지 (기존 유지)
  useEffect(() => {
    let touchStartY = 0;
    let touchEndY = 0;

    const handleTouchStart = (e: TouchEvent) => {
      touchStartY = e.touches[0].clientY;
    };

    const handleTouchMove = (e: TouchEvent) => {
      touchEndY = e.touches[0].clientY;
      
      if (window.scrollY === 0 && touchEndY > touchStartY && touchEndY - touchStartY > 10) {
        e.preventDefault();
      }
    };

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

  // 페이지 나가기 방지 (기존 유지)
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (generatedVideoUrl && !videoSaved) {
        e.preventDefault();
        e.returnValue = '생성된 영상을 저장하지 않았습니다. 페이지를 나가면 영상을 다시 볼 수 없습니다.';
        return e.returnValue;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [generatedVideoUrl, videoSaved]);

  // 브라우저 뒤로가기 방지 (기존 유지)
  useEffect(() => {
    if (generatedVideoUrl && !videoSaved) {
      window.history.pushState(null, '', window.location.href);
      
      const handlePopState = () => {
        if (generatedVideoUrl && !videoSaved) {
          setShowExitWarning(true);
          window.history.pushState(null, '', window.location.href);
        }
      };

      window.addEventListener('popstate', handlePopState);
      return () => window.removeEventListener('popstate', handlePopState);
    }
  }, [generatedVideoUrl, videoSaved]);

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
      if (onVideoGenerated) {
        onVideoGenerated(null);
      }
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

    if (!userId) {
      setError('사용자 정보를 찾을 수 없습니다.');
      return;
    }
    
    if (!credits || credits.remainingCredits < 2) {
      setError('크레딧이 부족합니다. (필요: 2개, 보유: ' + (credits?.remainingCredits || 0) + '개)');
      return;
    }

    setIsLoading(true);
    setError(null);
    setVideoSaved(false);
    setProgress('비디오 생성 작업을 시작하고 있습니다...');

    try {
      const videoUrl = await generateVideoWithKling(originalImage, finalPrompt, videoDuration);
      
      setGeneratedVideoUrl(videoUrl);
      if (onVideoGenerated) {
        onVideoGenerated(videoUrl);
      }
      setProgress('');
      
      setTimeout(async () => {
        const creditUsed = await useCredits(userId, 'video', 2);
        if (creditUsed) {
          onCreditsUsed();
        }
      }, 100);
      
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

  // 🔥 네이티브 앱 웹뷰용 - URL 클립보드 복사 방식 다운로드 핸들러
  const handleDownload = async () => {
    if (!generatedVideoUrl || isDownloading) return;
    
    setIsDownloading(true);
    setDownloadStatus('URL 복사 중...');
    
    try {
      if (isWebView()) {
        // 🚀 웹뷰 환경: URL을 클립보드에 복사
        console.log('WebView detected, copying URL to clipboard');
        
        try {
          // Clipboard API 사용 (HTTPS 환경에서만 작동)
          await navigator.clipboard.writeText(generatedVideoUrl);
          
          setDownloadStatus('✅ URL이 클립보드에 복사되었습니다!');
          setVideoSaved(false); // URL 복사는 실제 저장이 아니므로 false 유지
          
          // 안내 메시지 표시
          setTimeout(() => {
            setShowIOSGuide(true);
            setDownloadStatus(null);
          }, 2000);
          
        } catch (clipboardError) {
          console.warn('Clipboard API failed, trying fallback method:', clipboardError);
          
          // Fallback: 텍스트 선택 방식
          try {
            const textArea = document.createElement('textarea');
            textArea.value = generatedVideoUrl;
            textArea.style.position = 'fixed';
            textArea.style.opacity = '0';
            document.body.appendChild(textArea);
            textArea.select();
            textArea.setSelectionRange(0, 99999); // 모바일용
            
            const successful = document.execCommand('copy');
            document.body.removeChild(textArea);
            
            if (successful) {
              setDownloadStatus('✅ URL이 복사되었습니다!');
              setTimeout(() => {
                setShowIOSGuide(true);
                setDownloadStatus(null);
              }, 2000);
            } else {
              throw new Error('execCommand copy failed');
            }
            
          } catch (fallbackError) {
            console.error('All clipboard methods failed:', fallbackError);
            // 최후의 수단: URL을 alert로 표시
            alert(`비디오 URL을 복사하세요:\n\n${generatedVideoUrl}`);
            setDownloadStatus('URL을 수동으로 복사하세요');
            setShowIOSGuide(true);
          }
        }
        
      } else if (isIOS()) {
        // iOS Safari: 기존 방식 유지 (새 탭 열기)
        console.log('iOS Safari detected, using new tab method');
        setDownloadStatus('iOS에서 새 탭 열기...');
        
        const link = document.createElement('a');
        link.href = generatedVideoUrl;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        setDownloadStatus('✅ 새 탭에서 비디오를 열었습니다');
        
        setTimeout(() => {
          setShowIOSGuide(true);
          setDownloadStatus(null);
        }, 2000);
        
      } else {
        // Android/PC: 기존 Blob 다운로드 방식 유지
        console.log('Desktop/Android detected, using blob download');
        setDownloadStatus('비디오를 다운로드하는 중...');
        
        const response = await fetch(generatedVideoUrl);
        if (!response.ok) throw new Error('다운로드 실패');
        
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = `hairgator-video-${Date.now()}.mp4`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
        setVideoSaved(true);
        setDownloadStatus('✅ 비디오 다운로드 완료!');
      }
      
    } catch (error) {
      console.error('Download process failed:', error);
      setDownloadStatus('❌ 처리 실패');
      
      // 에러 시에도 URL 표시
      alert(`수동으로 URL을 복사하세요:\n\n${generatedVideoUrl}`);
      
    } finally {
      setIsDownloading(false);
      
      // 상태 메시지 자동 클리어 (에러 메시지 제외)
      setTimeout(() => {
        if (downloadStatus && !downloadStatus.includes('❌')) {
          setDownloadStatus(null);
        }
      }, 5000);
    }
  };

  // 웹뷰용 맞춤 안내 모달 - URL 복사 방식 설명
  const IOSGuideModal = () => (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 border border-gray-600 rounded-xl p-6 max-w-sm w-full animate-in fade-in zoom-in duration-300">
        <div className="text-center mb-4">
          <div className="text-4xl mb-2">📋</div>
          <h3 className="text-lg font-bold text-white">앱에서 비디오 저장하기</h3>
          <p className="text-sm text-gray-400 mt-1">URL이 클립보드에 복사되었습니다</p>
        </div>
        
        <div className="space-y-3 mb-6">
          <div className="flex items-start gap-3 p-3 bg-blue-700/50 rounded-lg">
            <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white text-sm rounded-full flex items-center justify-center font-bold">1</span>
            <p className="text-sm text-blue-200">앱을 나가서 <strong className="text-white">Safari 브라우저</strong>를 열어주세요</p>
          </div>
          <div className="flex items-start gap-3 p-3 bg-blue-700/50 rounded-lg">
            <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white text-sm rounded-full flex items-center justify-center font-bold">2</span>
            <p className="text-sm text-blue-200">주소창을 <strong className="text-yellow-300">길게 터치</strong> → <strong className="text-white">"붙여넣기"</strong> 선택</p>
          </div>
          <div className="flex items-start gap-3 p-3 bg-blue-700/50 rounded-lg">
            <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white text-sm rounded-full flex items-center justify-center font-bold">3</span>
            <p className="text-sm text-blue-200">비디오가 재생되면 화면을 <strong className="text-yellow-300">길게 터치</strong></p>
          </div>
          <div className="flex items-start gap-3 p-3 bg-green-600/20 border border-green-500/50 rounded-lg">
            <span className="flex-shrink-0 w-6 h-6 bg-green-600 text-white text-sm rounded-full flex items-center justify-center">✓</span>
            <p className="text-sm text-green-200"><strong>"비디오 저장"</strong> 선택하면 사진 앱에 저장됩니다!</p>
          </div>
        </div>
        
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 mb-4">
          <div className="flex items-center gap-2">
            <span className="text-amber-400">💡</span>
            <p className="text-xs text-amber-200">
              URL이 복사 안 되었다면 직접 복사해서 Safari에 붙여넣으세요
            </p>
          </div>
        </div>
        
        <div className="flex gap-3">
          <button
            onClick={() => {
              // URL 다시 복사 시도
              navigator.clipboard.writeText(generatedVideoUrl!).catch(() => {
                alert(`URL: ${generatedVideoUrl}`);
              });
            }}
            className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold"
          >
            URL 다시복사 📋
          </button>
          <button
            onClick={() => {
              setShowIOSGuide(false);
              setVideoSaved(true); // 사용자가 확인했으므로 저장된 것으로 처리
            }}
            className="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-semibold"
          >
            저장완료! ✅
          </button>
        </div>
      </div>
    </div>
  );

  // 경고 모달 (기존 유지)
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
          비디오를 저장하셨나요?
        </h3>
        
        <p className="text-gray-300 text-sm text-center mb-4">
          아직 비디오를 저장하지 않으셨다면, 페이지를 나가면 <span className="text-red-400 font-bold">생성된 비디오를 다시 볼 수 없습니다.</span>
        </p>
        
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 mb-6">
          <p className="text-yellow-200 text-xs text-center">
            💡 앱 내부: URL 복사 → Safari에서 붙여넣기 → 길게 터치 → 저장<br/>
            💡 Android/PC: 다운로드 버튼 → 자동 저장
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

  const hasEnoughCredits = credits ? credits.remainingCredits >= 2 : false;

  return (
    <div className="min-h-screen bg-gray-900 text-gray-200 flex flex-col items-center p-4 sm:p-6 lg:p-8">
      {/* 모달들 */}
      {showExitWarning && <ExitWarningModal />}
      {showIOSGuide && <IOSGuideModal />}
      
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
        
        {/* 크레딧 표시 */}
        {credits && (
          <div className="absolute right-4 top-4 bg-gray-800 px-4 py-2 rounded-lg">
            <span className="text-sm text-gray-400">남은 횟수: </span>
            <span className="text-lg font-bold text-cyan-400">{credits.remainingCredits}</span>
          </div>
        )}
        
        <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
          AI 헤어 영상 변환
        </h1>
        <p className="mt-2 text-lg text-gray-400">
          헤어 시술 후 사진을 자연스러운 리뷰 영상으로 변환해드립니다.
        </p>
      </header>

      <main className="w-full max-w-7xl flex flex-col lg:flex-row gap-8">
        {/* Left Panel - 설정 (기존 유지) */}
        <div className="lg:w-1/3 flex flex-col gap-6">
          <div className="w-full p-6 bg-gray-800/50 border border-gray-700 rounded-xl">
            <h2 className="text-xl text-center font-bold text-cyan-400 mb-4">1. 헤어 시술 후 사진 업로드</h2>
            <ImageUploader 
              title="고객 사진" 
              onImageUpload={handleImageUpload} 
              imageUrl={originalImage?.url} 
            />
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
                <option value="">직접 입력</option>
                <optgroup label="헤어 모델 포즈">
                  <option value="hairModelPose1">머리 좌우로 돌리며 스타일 보여주기</option>
                  <option value="hairModelPose2">손으로 머리 쓸어올리기</option>
                  <option value="hairModelPose3">다이나믹하게 머리 흔들기</option>
                </optgroup>
                <optgroup label="헤어 리뷰 모션">
                  <option value="hairReview1">만족하며 거울보듯 확인하기</option>
                  <option value="hairReview2">행복하게 머리 만지며 감탄</option>
                  <option value="hairReview3">앞머리 정리하며 수줍은 미소</option>
                </optgroup>
                <optgroup label="자연스러운 일반인 포즈">
                  <option value="naturalPose1">수줍은 표정에서 환한 미소로</option>
                  <option value="naturalPose2">손으로 얼굴 가리다 웃음 터뜨리기</option>
                  <option value="naturalPose3">귀 뒤로 머리카락 넘기며 미소</option>
                </optgroup>
                <optgroup label="헤어 디테일 보여주기">
                  <option value="showDetail1">180도 회전하며 뒷머리 스타일 공개</option>
                  <option value="showDetail2">고개 숙였다 들며 레이어드 움직임</option>
                  <option value="showDetail3">바람에 날리듯 자연스러운 헤어 무브먼트</option>
                </optgroup>
                <optgroup label="변신 완료 리액션">
                  <option value="transformation1">놀라며 감탄하는 변신 확인</option>
                  <option value="transformation2">거울 보듯 새로운 모습에 감탄</option>
                </optgroup>
                <optgroup label="살롱 분위기">
                  <option value="salonVibe1">시술 후 만족스럽게 일어서기</option>
                  <option value="salonVibe2">디자이너와 하이파이브하듯 기뻐하기</option>
                </optgroup>
              </select>
            </div>

            {/* Custom Prompt */}
            <div className="mb-4">
              <label className="block mb-2 text-sm font-medium text-gray-300">
                {selectedTemplate ? '선택된 템플릿 사용 중' : '커스텀 프롬프트'}
              </label>
              <textarea
                value={prompt}
                onChange={(e) => {
                  setPrompt(e.target.value);
                  setSelectedTemplate('');
                }}
                placeholder="영상으로 만들 동작을 설명하세요..."
                className="w-full h-32 p-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-blue-500 focus:border-blue-500 transition resize-none text-sm"
                disabled={!!selectedTemplate}
              />
            </div>
            
            {/* 크레딧 부족 경고 */}
            {credits && !hasEnoughCredits && (
              <div className="bg-red-900/30 border border-red-600/50 rounded-lg p-3 mb-4">
                <p className="text-sm text-red-400">
                  크레딧이 부족합니다. 영상 변환에는 2개의 크레딧이 필요합니다.
                </p>
              </div>
            )}
            
            <button
              onClick={handleGenerateVideo}
              disabled={isLoading || !originalImage || (!prompt && !selectedTemplate) || !hasEnoughCredits}
              className={`w-full mt-4 flex items-center justify-center px-6 py-3.5 text-base font-semibold text-white rounded-lg transition-all duration-300 ${
                isLoading || !originalImage || (!prompt && !selectedTemplate) || !hasEnoughCredits
                  ? 'bg-gray-600 cursor-not-allowed'
                  : 'bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700'
              }`}
            >
              {isLoading ? (
                '처리 중... (최대 5분 소요)'
              ) : !hasEnoughCredits ? (
                '크레딧 부족 (2개 필요)'
              ) : (
                <>
                  <VideoIcon className="w-5 h-5 mr-2" />
                  영상 생성하기 (2회 차감)
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right Panel - 비디오 결과 */}
        <div className="lg:w-2/3 flex flex-col relative min-h-[500px]">
          {isLoading && <Loader type="video" />}
          
          {error && (
            <div className="w-full h-full flex items-center justify-center bg-gray-800/50 border border-gray-700 rounded-xl">
              <div className="text-center text-red-300 p-4">
                <h3 className="text-lg font-bold">오류 발생</h3>
                <p className="text-sm">{error}</p>
              </div>
            </div>
          )}

          {!isLoading && !error && (
            <div className="w-full h-full bg-gray-800/50 border border-gray-700 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-gray-300 mb-4 text-center">결과 영상</h3>
              
              {generatedVideoUrl ? (
                <>
                  {/* 웹뷰 환경별 맞춤 경고 배너 - URL 복사 방식 */}
                  {!videoSaved && (
                    <div className="mb-4 bg-blue-500/20 border-blue-500/50 border rounded-lg p-4">
                      <div className="flex items-center gap-3">
                        <div className="text-2xl">📋</div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-blue-200">
                            📱 앱 내부: 다운로드 버튼 → URL 복사 → Safari에서 붙여넣기
                          </p>
                          <p className="text-xs mt-1 text-blue-300">
                            클립보드에 URL을 복사한 후 Safari에서 재생하여 저장하세요
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* 비디오 플레이어 */}
                  <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden">
                    <video 
                      controls 
                      autoPlay
                      loop
                      muted
                      playsInline
                      className="w-full h-full"
                      src={generatedVideoUrl}
                      onError={(e) => {
                        console.error('Video playback error:', e);
                        setError('비디오 재생 오류: 형식이 지원되지 않을 수 있습니다.');
                      }}
                    >
                      브라우저가 비디오 재생을 지원하지 않습니다.
                    </video>
                    
                    {/* 환경별 맞춤 다운로드 버튼 */}
                    <button
                      onClick={handleDownload}
                      disabled={isDownloading}
                      className={`absolute bottom-4 right-4 p-3 backdrop-blur-sm rounded-full text-white transition-all duration-300 group font-bold ${
                        videoSaved 
                          ? 'bg-green-600/90 hover:bg-green-700 scale-110' 
                          : isDownloading
                            ? 'bg-blue-600/90 animate-pulse cursor-wait'
                            : isWebView()
                              ? 'bg-blue-600/90 hover:bg-blue-700 animate-bounce shadow-lg shadow-blue-500/50'
                              : isIOS()
                                ? 'bg-amber-600/90 hover:bg-amber-700 animate-bounce shadow-lg shadow-amber-500/50'
                                : 'bg-blue-600/90 hover:bg-blue-700 hover:scale-110 shadow-lg'
                      }`}
                      title={
                        videoSaved 
                          ? '저장 완료! ✅' 
                          : isDownloading 
                            ? '다운로드 중...' 
                            : isWebView()
                              ? 'URL 클립보드 복사'
                              : isIOS()
                                ? 'iOS 다운로드 (터치 필요)'
                                : '클릭하여 다운로드'
                      }
                    >
                      <div className="flex flex-col items-center">
                        {isDownloading ? (
                          <svg className="w-6 h-6 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                        ) : videoSaved ? (
                          <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          <>
                            <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                            <span className="text-xs">
                              {isWebView() ? 'URL복사' : isIOS() ? 'iOS' : 'PC'}
                            </span>
                          </>
                        )}
                      </div>
                    </button>
                    
                    {/* 다운로드 상태 오버레이 */}
                    {downloadStatus && (
                      <div className={`absolute top-4 left-4 right-4 p-3 rounded-lg backdrop-blur-sm border transition-all duration-300 animate-in slide-in-from-top ${
                        downloadStatus.includes('✅') 
                          ? 'bg-green-600/90 border-green-400 text-green-100' 
                          : downloadStatus.includes('❌')
                            ? 'bg-red-600/90 border-red-400 text-red-100 animate-pulse'
                            : 'bg-blue-600/90 border-blue-400 text-blue-100'
                      }`}>
                        <p className="text-sm text-center font-semibold">{downloadStatus}</p>
                      </div>
                    )}
                  </div>

                  {/* 환경별 저장 가이드 - 웹뷰용 수정 */}
                  <div className={`mt-4 p-4 rounded-lg border ${
                    isWebView() 
                      ? 'bg-blue-700/20 border-blue-600/50'
                      : isIOS() 
                        ? 'bg-amber-700/20 border-amber-600/50'
                        : 'bg-blue-700/20 border-blue-600/50'
                  }`}>
                    <div className="flex items-start gap-3">
                      <div className="text-2xl">
                        {isWebView() ? '📋' : isIOS() ? '🍎' : isAndroid() ? '🤖' : '💻'}
                      </div>
                      <div className="flex-1">
                        <h4 className="text-sm font-bold text-gray-200 mb-2">
                          {isWebView() 
                            ? '📋 앱 내부 URL 복사 방식'
                            : isIOS() 
                              ? '🍎 iOS 저장 가이드'
                              : isAndroid()
                                ? '🤖 안드로이드 저장'
                                : '💻 PC 저장'
                          }
                        </h4>
                        <div className="space-y-1 text-xs text-gray-300">
                          {isWebView() ? (
                            <>
                              <p className="text-blue-200">• 다운로드 버튼 클릭 → <strong>URL이 클립보드에 복사됩니다</strong></p>
                              <p>• 앱에서 나가서 Safari 브라우저 실행</p>
                              <p>• 주소창 길게 터치 → "붙여넣기" → 비디오 재생</p>
                              <p>• 비디오 화면 길게 터치 → "비디오 저장"</p>
                            </>
                          ) : isIOS() ? (
                            <>
                              <p className="text-amber-200">• <strong>1단계:</strong> 다운로드 버튼 → 새 창에서 비디오 재생</p>
                              <p className="text-amber-200">• <strong>2단계:</strong> 비디오를 <strong>길게 터치</strong> (1-2초)</p>
                              <p className="text-amber-200">• <strong>3단계:</strong> "비디오 저장" 또는 "공유" 선택</p>
                              <p className="text-green-200">• ✅ 사진 앱에서 확인 완료</p>
                            </>
                          ) : isAndroid() ? (
                            <>
                              <p>• 다운로드 버튼 클릭 → 자동 다운로드</p>
                              <p>• 갤러리 또는 다운로드 폴더에서 확인</p>
                              <p>• Chrome: 하단 알림에서 바로 열기 가능</p>
                            </>
                          ) : (
                            <>
                              <p>• 다운로드 버튼 클릭 → 파일 자동 저장</p>
                              <p>• 브라우저 다운로드 폴더에서 확인</p>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="w-full aspect-video bg-gray-800 rounded-xl flex flex-col items-center justify-center text-gray-500">
                  <VideoIcon className="w-16 h-16 mb-4" />
                  <p className="text-lg font-medium">헤어 리뷰 영상 대기 중</p>
                  <p className="text-sm mt-2 text-gray-600">사진을 업로드하고 템플릿을 선택한 후 생성 버튼을 눌러주세요</p>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default VideoSwap;
