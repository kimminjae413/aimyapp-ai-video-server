import React, { useState } from 'react';

interface VideoSwapProps {
  onBack: () => void;
  userId: string | null;
  credits: any;
  onCreditsUsed: () => void;
  preservedVideoUrl: string | null;
  onVideoGenerated: (result: string | null) => void;
}

const VideoSwap: React.FC<VideoSwapProps> = ({
  onBack,
  userId,
  credits,
  onCreditsUsed,
  preservedVideoUrl,
  onVideoGenerated
}) => {
  const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string | null>(preservedVideoUrl);
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [videoSaved, setVideoSaved] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDownload = async () => {
    if (!generatedVideoUrl) return;
    
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    
    if (isIOS) {
      try {
        const proxyUrl = `/.netlify/functions/video-download-proxy?url=${encodeURIComponent(generatedVideoUrl)}`;
        
        const a = document.createElement('a');
        a.href = proxyUrl;
        a.download = `hairgator-${Date.now()}.mp4`;
        a.target = '_blank';
        
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        setTimeout(() => {
          setShowIOSGuide(true);
        }, 500);
        
      } catch (error) {
        console.error('iOS download failed:', error);
        window.open(generatedVideoUrl, '_blank');
        setTimeout(() => setShowIOSGuide(true), 500);
      }
    } else {
      try {
        const response = await fetch(generatedVideoUrl);
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

  const handleGenerate = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // 임시로 샘플 비디오 URL 생성 (실제로는 API 호출)
      setTimeout(() => {
        const sampleVideoUrl = 'https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_1mb.mp4';
        setGeneratedVideoUrl(sampleVideoUrl);
        onVideoGenerated(sampleVideoUrl);
        setIsLoading(false);
      }, 3000);
      
    } catch (err) {
      setError('비디오 생성 중 오류가 발생했습니다.');
      setIsLoading(false);
    }
  };

  const IOSGuideModal = () => (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 border border-gray-600 rounded-xl p-6 max-w-sm w-full">
        <h3 className="text-lg font-bold text-white mb-4">📱 iOS 영상 저장 방법</h3>
        
        <div className="space-y-3 mb-4">
          <div className="flex items-start gap-3">
            <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white text-sm rounded-full flex items-center justify-center">1</span>
            <p className="text-sm text-gray-300">다운로드가 자동으로 시작되었습니다</p>
          </div>
          <div className="flex items-start gap-3">
            <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white text-sm rounded-full flex items-center justify-center">2</span>
            <p className="text-sm text-gray-300">Safari 상단의 <strong className="text-white">↓ 아이콘</strong>을 터치하세요</p>
          </div>
          <div className="flex items-start gap-3">
            <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white text-sm rounded-full flex items-center justify-center">3</span>
            <p className="text-sm text-gray-300">다운로드된 영상을 터치하면 재생됩니다</p>
          </div>
          <div className="flex items-start gap-3">
            <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white text-sm rounded-full flex items-center justify-center">4</span>
            <p className="text-sm text-gray-300">영상을 <strong className="text-white">길게 터치</strong> → <strong className="text-white">공유</strong> → <strong className="text-white">비디오 저장</strong></p>
          </div>
          <div className="flex items-start gap-3">
            <span className="flex-shrink-0 w-6 h-6 bg-green-600 text-white text-sm rounded-full flex items-center justify-center">✓</span>
            <p className="text-sm text-gray-300">사진 앱에 저장 완료!</p>
          </div>
        </div>
        
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 mb-4">
          <p className="text-xs text-blue-200">
            💡 <strong>대안:</strong> 파일 앱 → 다운로드에서도 영상을 확인할 수 있어요
          </p>
        </div>
        
        <button
          onClick={() => {
            setShowIOSGuide(false);
            setVideoSaved(true);
          }}
          className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
        >
          확인했습니다
        </button>
      </div>
    </div>
  );

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

      {/* 헤더 */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">AI 영상 변환</h1>
        <p className="text-gray-400">얼굴을 바꾼 영상을 생성하세요</p>
      </div>

      {/* 메인 컨텐츠 */}
      <main className="w-full max-w-4xl">
        <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6 mb-6">
          <h2 className="text-xl font-bold text-center mb-4">영상 업로드</h2>
          
          <div className="border-2 border-dashed border-gray-600 rounded-lg p-8 text-center">
            <div className="mb-4">
              <svg className="w-12 h-12 text-gray-500 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4V2a1 1 0 011-1h8a1 1 0 011 1v2m-9 2v12a2 2 0 002 2h8a2 2 0 002-2V6H7z" />
              </svg>
              <p className="text-gray-400">영상 파일을 업로드하세요</p>
            </div>
            
            <input
              type="file"
              accept="video/*"
              className="hidden"
              id="video-upload"
            />
            <label
              htmlFor="video-upload"
              className="inline-block px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg cursor-pointer transition-colors"
            >
              파일 선택
            </label>
          </div>
        </div>

        {/* 생성 버튼 */}
        <div className="text-center mb-6">
          <button
            onClick={handleGenerate}
            disabled={isLoading}
            className="px-8 py-3 bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white font-bold rounded-lg disabled:opacity-50 transition-all"
          >
            {isLoading ? '생성 중...' : 'AI 영상 생성'}
          </button>
        </div>

        {/* 로딩 */}
        {isLoading && (
          <div className="text-center py-8">
            <div className="w-16 h-16 border-4 border-blue-400 border-dashed rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-400">AI가 영상을 생성하고 있습니다...</p>
          </div>
        )}

        {/* 에러 메시지 */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-center text-red-400">
            {error}
          </div>
        )}

        {/* 생성된 영상 */}
        {generatedVideoUrl && !isLoading && (
          <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
            <h3 className="text-xl font-bold text-center mb-4">생성된 영상</h3>
            
            <div className="aspect-video bg-gray-900 rounded-lg mb-4 flex items-center justify-center">
              <video
                src={generatedVideoUrl}
                controls
                className="w-full h-full rounded-lg"
              >
                Your browser does not support the video tag.
              </video>
            </div>
            
            <div className="text-center">
              <button
                onClick={handleDownload}
                className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
              >
                영상 다운로드
              </button>
            </div>
          </div>
        )}
      </main>

      {/* iOS 가이드 모달 */}
      {showIOSGuide && <IOSGuideModal />}
    </div>
  );
};

export default VideoSwap;
