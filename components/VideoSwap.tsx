// VideoSwap.tsx의 handleDownload 함수만 수정
const handleDownload = async () => {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  
  if (isIOS) {
    // iOS: Netlify Functions 프록시를 통해 다운로드 가능한 URL 생성
    try {
      const proxyUrl = `/.netlify/functions/video-download-proxy?url=${encodeURIComponent(generatedVideoUrl!)}`;
      
      // 프록시를 통해 다운로드 링크 생성
      const a = document.createElement('a');
      a.href = proxyUrl;
      a.download = `hairgator-${Date.now()}.mp4`;
      a.target = '_blank';
      
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      // 다운로드 안내 모달 표시
      setTimeout(() => {
        setShowIOSGuide(true);
      }, 500);
      
    } catch (error) {
      console.error('iOS download failed:', error);
      // 실패시 기존 방식으로 폴백
      window.open(generatedVideoUrl!, '_blank');
      setTimeout(() => setShowIOSGuide(true), 500);
    }
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
      window.open(generatedVideoUrl!, '_blank');
    }
  }
};

// iOS 가이드 모달도 개선된 내용으로 수정
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
