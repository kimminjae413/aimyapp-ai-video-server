// ImageDisplay.tsx 수정 버전
const handleCleanDownload = async () => {
    if (!generatedImage) return;
    
    try {
        // 메타데이터 제거된 깨끗한 이미지 생성
        const cleanImageUrl = await ImageProcessor.removeMetadata(generatedImage);
        
        // 다운로드
        const link = document.createElement('a');
        link.href = cleanImageUrl;
        link.download = `face-swap-${Date.now()}.jpg`;
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
    } catch (error) {
        console.error('Clean download failed:', error);
        // 기본 다운로드로 폴백
        const link = document.createElement('a');
        link.href = generatedImage;
        link.download = `face-swap-${Date.now()}.jpg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
};

// 기존 다운로드 버튼을 이 함수로 교체
<button
    onClick={handleCleanDownload}  // 👈 여기 수정
    className="absolute top-3 right-3 p-2 bg-gray-900/70 backdrop-blur-sm rounded-full text-white hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-blue-500 transition-colors duration-200"
    aria-label="깨끗한 이미지 다운로드"
    title="이미지 다운로드"
>
    <DownloadIcon className="w-6 h-6" />
</button>
