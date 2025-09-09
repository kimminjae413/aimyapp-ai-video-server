import React, { useState } from 'react';
import { ImageIcon } from './icons/ImageIcon';
import { DownloadIcon } from './icons/DownloadIcon';
import { downloadHelper } from '../utils/downloadHelper';

interface ImageDisplayProps {
  originalImage: string | undefined | null;
  generatedImage: string | undefined | null;
}

export const ImageDisplay: React.FC<ImageDisplayProps> = ({ originalImage, generatedImage }) => {
    const [showTip, setShowTip] = useState(false);
    
    const handleDownload = async () => {
        if (!generatedImage) return;
        
        // 파일명 생성
        const timestamp = new Date().toISOString().slice(0, 10);
        const filename = `faceswap-${timestamp}.jpg`;
        
        // downloadHelper 사용
        const success = await downloadHelper.downloadImage(generatedImage, filename);
        
        // iOS에서 저장 확인 모달 표시
        if (downloadHelper.isIOS() && success) {
            setTimeout(() => {
                downloadHelper.showSaveConfirmation(
                    () => {
                        // 저장 완료
                        console.log('Image saved successfully');
                    },
                    () => {
                        // 다시 안내 표시
                        setShowTip(true);
                    }
                );
            }, 2000);
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
      
      {/* 저장 팁 */}
      {showTip && (
        <div className="fixed bottom-4 left-4 right-4 bg-blue-600 text-white p-4 rounded-lg shadow-lg z-50 mx-auto max-w-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="font-semibold text-sm">💡 저장 팁</p>
              <p className="text-xs mt-1">새 창에서 이미지를 길게 터치 → "이미지 저장" 선택</p>
            </div>
            <button
              onClick={() => {
                setShowTip(false);
              }}
              className="text-white ml-2 text-lg leading-none"
            >
              ×
            </button>
          </div>
        </div>
      )}
    </>
  );
};
