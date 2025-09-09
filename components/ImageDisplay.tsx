import React, { useState } from 'react';
import { ImageIcon } from './icons/ImageIcon';
import { DownloadIcon } from './icons/DownloadIcon';

interface ImageDisplayProps {
  originalImage: string | undefined | null;
  generatedImage: string | undefined | null;
}

export const ImageDisplay: React.FC<ImageDisplayProps> = ({ originalImage, generatedImage }) => {
    const [showIOSGuide, setShowIOSGuide] = useState(false);
    
    const handleDownload = () => {
        if (!generatedImage) return;
        
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        
        if (isIOS) {
            // iOS: 직접 새 탭에서 이미지 URL 열기 (단순하게)
            window.open(generatedImage, '_blank');
            
            // 가이드 표시
            setTimeout(() => {
                setShowIOSGuide(true);
            }, 500);
        } else {
            // 기타 기기: 기존 다운로드 방식
            const link = document.createElement('a');
            link.href = generatedImage;
            const mimeType = generatedImage.substring(5, generatedImage.indexOf(';'));
            const extension = mimeType.split('/')[1] ?? 'png';
            link.download = `faceswap-result.${extension}`;
            
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    };

    if (!originalImage && !generatedImage) {
        return (
             <div className="w-full h-full bg-gray-800/50 border border-gray-700 rounded-xl flex flex-col items-center justify-center p-8 text-center text-gray-500">
                <ImageIcon className="w-24 h-24" />
                <h2 className="mt-6 text-2xl pink-bold-title">AI 얼굴 변환</h2>
                <p className="mt-2 max-w-md">좌측에 이미지를 업로드하고 원하는 스타일을 선택한 후, 변환 버튼을 눌러주세요.</p>
            </div>
        );
    }

  return (
    <>
      <div className="w-full h-full grid grid-cols-1 md:grid-cols-2 gap-6 p-6 bg-gray-800/50 border border-gray-700 rounded-xl">
          {/* Original Image Card */}
          <div className="w-full flex flex-col items-center">
              <h3 className="text-lg font-semibold text-gray-300 mb-3">원본</h3>
              <div className="relative w-full aspect-square bg-gray-800 rounded-xl border border-gray-700 flex items-center justify-center overflow-hidden">
                  {originalImage ? (
                      <img src={originalImage} alt="원본" className="object-contain w-full h-full" />
                  ) : (
                      <div className="text-center text-gray-500 p-4">
                          <ImageIcon className="w-12 h-12 mx-auto" />
                          <p className="mt-2 text-sm">이미지를 업로드 해주세요</p>
                      </div>
                  )}
              </div>
          </div>

          {/* Generated Image Card */}
          <div className="w-full flex flex-col items-center">
              <h3 className="text-lg font-semibold text-gray-300 mb-3">결과</h3>
              <div className="relative w-full aspect-square bg-gray-800 rounded-xl border border-gray-700 flex items-center justify-center overflow-hidden">
                  {generatedImage ? (
                      <>
                          <img src={generatedImage} alt="Generated Result" className="object-contain w-full h-full" />
                          <button
                              onClick={handleDownload}
                              className="absolute top-3 right-3 p-2 bg-gray-900/70 backdrop-blur-sm rounded-full text-white hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-blue-500 transition-colors duration-200"
                              aria-label="결과 이미지 다운로드"
                              title="이미지 다운로드"
                          >
                              <DownloadIcon className="w-6 h-6" />
                          </button>
                      </>
                  ) : (
                      <div className="text-center text-gray-500 p-4">
                          <ImageIcon className="w-12 h-12 mx-auto" />
                          <p className="mt-2 text-sm">얼굴 변환 대기 중</p>
                      </div>
                  )}
              </div>
          </div>
      </div>
      
      {/* iOS 다운로드 가이드 모달 */}
      {showIOSGuide && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 border border-gray-600 rounded-xl p-6 max-w-sm w-full">
            <h3 className="text-lg font-bold text-white mb-4">📱 iOS 저장 방법</h3>
            
            <div className="space-y-3 mb-4">
              <div className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white text-sm rounded-full flex items-center justify-center">1</span>
                <p className="text-sm text-gray-300">새 탭에서 이미지가 열렸습니다</p>
              </div>
              <div className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white text-sm rounded-full flex items-center justify-center">2</span>
                <p className="text-sm text-gray-300">이미지를 <strong className="text-white">길게 터치</strong>하세요</p>
              </div>
              <div className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white text-sm rounded-full flex items-center justify-center">3</span>
                <p className="text-sm text-gray-300"><strong className="text-white">"이미지 저장"</strong>을 선택하세요</p>
              </div>
              <div className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-green-600 text-white text-sm rounded-full flex items-center justify-center">✓</span>
                <p className="text-sm text-gray-300">사진 앱에서 확인 가능!</p>
              </div>
            </div>
            
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 mb-4">
              <p className="text-xs text-yellow-200">
                💡 팁: 새 탭이 안 열렸다면 Safari 팝업 차단을 확인하세요
              </p>
            </div>
            
            <button
              onClick={() => setShowIOSGuide(false)}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              확인
            </button>
          </div>
        </div>
      )}
    </>
  );
};
