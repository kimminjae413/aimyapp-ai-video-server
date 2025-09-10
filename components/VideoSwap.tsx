// VideoSwap.tsx의 다운로드 관련 부분만 수정 (전체 파일에서 이 부분들을 교체)

import { downloadHelper } from '../utils/downloadHelper';

// ... 기존 imports 및 interface 유지 ...

const VideoSwap: React.FC<VideoSwapProps> = ({ 
  onBack, 
  userId, 
  credits, 
  onCreditsUsed, 
  preservedVideoUrl, 
  onVideoGenerated 
}) => {
  // ... 기존 states 유지 ...
  
  // 다운로드 관련 state 추가/수정
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [downloadStatus, setDownloadStatus] = useState<string | null>(null);

  // ... 기존 useEffect들 유지 ...

  // 개선된 다운로드 핸들러
  const handleDownload = async () => {
    if (!generatedVideoUrl || isDownloading) return;
    
    setIsDownloading(true);
    setDownloadStatus('다운로드 준비 중...');
    
    try {
      // 파일명 생성
      const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '');
      const filename = `hairgator-video-${timestamp}.mp4`;
      
      setDownloadStatus('비디오 다운로드 중...');
      
      // 개선된 downloadHelper 사용
      const result = await downloadHelper.downloadVideo(generatedVideoUrl, filename);
      
      if (result.success) {
        setDownloadStatus(`✅ ${result.method}로 다운로드 시도됨`);
        
        // iOS에서 수동 저장이 필요한 경우 가이드 표시
        if (result.method === 'new-window-video' || downloadHelper.isIOS()) {
          setTimeout(() => {
            downloadHelper.showDownloadGuide(
              'video',
              () => {
                setVideoSaved(true);
                setDownloadStatus('비디오 저장 완료! ✅');
              },
              () => {
                // 다시 시도
                handleDownload();
              }
            );
          }, 1500);
        } else {
          // Android/PC 자동 다운로드 성공
          setVideoSaved(true);
          setDownloadStatus('비디오 저장 완료! ✅');
        }
        
      } else {
        setDownloadStatus(`❌ 다운로드 실패: ${result.message || '알 수 없는 오류'}`);
        
        // 실패 시 대안 제공
        setTimeout(() => {
          setDownloadStatus('다시 시도하거나 비디오를 길게 터치해서 저장하세요');
        }, 3000);
      }
      
    } catch (error) {
      console.error('Video download error:', error);
      setDownloadStatus('❌ 비디오 다운로드 중 오류가 발생했습니다');
    } finally {
      setIsDownloading(false);
      
      // 상태 메시지 자동 클리어
      setTimeout(() => {
        if (!videoSaved) {
          setDownloadStatus(null);
        }
      }, 8000);
    }
  };

  // ... 기존 코드들 유지 ...

  return (
    <div className="min-h-screen bg-gray-900 text-gray-200 flex flex-col items-center p-4 sm:p-6 lg:p-8">
      {/* ... 기존 모달들과 헤더 유지 ... */}

      <main className="w-full max-w-7xl flex flex-col lg:flex-row gap-8">
        {/* ... 기존 Left Panel 유지 ... */}

        {/* Right Panel - 비디오 결과 부분만 수정 */}
        <div className="lg:w-2/3 flex flex-col relative min-h-[500px]">
          {isLoading && <Loader />}
          
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
                  {/* 저장 안내 배너 - iOS에만 표시 */}
                  {downloadHelper.isIOS() && !videoSaved && (
                    <div className="mb-4 bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-500/50 rounded-lg p-4">
                      <div className="flex items-center gap-3">
                        <div className="text-2xl">⚠️</div>
                        <div className="flex-1">
                          <p className="text-yellow-200 text-sm font-medium">
                            📱 iOS 사용자: 비디오를 저장하지 않으면 페이지를 나갈 때 사라집니다!
                          </p>
                          <p className="text-yellow-300 text-xs mt-1">
                            다운로드 버튼을 눌러 저장하세요
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
                    
                    {/* 개선된 다운로드 버튼 */}
                    <button
                      onClick={handleDownload}
                      disabled={isDownloading}
                      className={`absolute bottom-4 right-4 p-3 backdrop-blur-sm rounded-full text-white transition-all duration-300 group ${
                        videoSaved 
                          ? 'bg-green-600/80 hover:bg-green-700' 
                          : isDownloading
                            ? 'bg-blue-600/80 animate-pulse cursor-wait'
                            : !videoSaved && downloadHelper.isIOS()
                              ? 'bg-red-600/80 hover:bg-red-700 animate-bounce'
                              : 'bg-gray-900/70 hover:bg-blue-600 hover:scale-110'
                      }`}
                      title={
                        videoSaved 
                          ? '저장 완료' 
                          : isDownloading 
                            ? '다운로드 중...' 
                            : '비디오 다운로드 (필수!)'
                      }
                    >
                      {isDownloading ? (
                        <svg className="w-6 h-6 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                      ) : videoSaved ? (
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                      )}
                    </button>
                    
                    {/* 다운로드 상태 오버레이 */}
                    {downloadStatus && (
                      <div className={`absolute top-4 left-4 right-4 p-3 rounded-lg backdrop-blur-sm border transition-all duration-300 ${
                        downloadStatus.includes('✅') 
                          ? 'bg-green-600/80 border-green-400 text-green-100' 
                          : downloadStatus.includes('❌')
                            ? 'bg-red-600/80 border-red-400 text-red-100'
                            : 'bg-blue-600/80 border-blue-400 text-blue-100'
                      }`}>
                        <p className="text-sm text-center font-medium">{downloadStatus}</p>
                      </div>
                    )}
                  </div>

                  {/* 플랫폼별 저장 가이드 */}
                  <div className="mt-4 p-4 bg-gray-700/30 border border-gray-600 rounded-lg">
                    <div className="flex items-start gap-3">
                      <div className="text-2xl">
                        {downloadHelper.isIOS() ? '📱' : downloadHelper.isAndroid() ? '🤖' : '💻'}
                      </div>
                      <div className="flex-1">
                        <h4 className="text-sm font-semibold text-gray-300 mb-2">
                          {downloadHelper.isIOS() ? 'iOS 저장 방법' : downloadHelper.isAndroid() ? 'Android 저장 방법' : 'PC 저장 방법'}
                        </h4>
                        {downloadHelper.isIOS() ? (
                          <div className="space-y-1 text-xs text-gray-400">
                            <p>• 다운로드 버튼 클릭 → 새 창에서 비디오 재생</p>
                            <p>• 비디오를 <strong className="text-white">길게 터치</strong> → "비디오 저장" 선택</p>
                            <p>• 또는 공유 → 사진 앱으로 저장</p>
                            <p className="text-yellow-300 font-medium">⚠️ 저장 후 새 창을 닫으셔도 됩니다</p>
                          </div>
                        ) : downloadHelper.isAndroid() ? (
                          <div className="space-y-1 text-xs text-gray-400">
                            <p>• 다운로드 버튼 클릭 → 자동 다운로드</p>
                            <p>• 갤러리 또는 다운로드 폴더에서 확인</p>
                            <p>• Chrome: 하단 알림에서 바로 열기 가능</p>
                          </div>
                        ) : (
                          <div className="space-y-1 text-xs text-gray-400">
                            <p>• 다운로드 버튼 클릭 → 파일 자동 저장</p>
                            <p>• 브라우저 다운로드 폴더에서 확인</p>
                          </div>
                        )}
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
