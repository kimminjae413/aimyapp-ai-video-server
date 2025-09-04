import React, { useState } from 'react';
import { ImageIcon } from './icons/ImageIcon';
import { DownloadIcon } from './icons/DownloadIcon';
import { ImageProcessor } from '../utils/imageProcessor';
import { DownloadGuide } from './DownloadGuide';

interface ImageDisplayProps {
  originalImage: string | undefined | null;
  generatedImage: string | undefined | null;
}

export const ImageDisplay: React.FC<ImageDisplayProps> = ({ originalImage, generatedImage }) => {
    const [showDownloadGuide, setShowDownloadGuide] = useState(false);
    
    const handleDownload = async () => {
        if (!generatedImage) return;
        
        // 다운로드 가이드를 보여줄지 확인
        const hideGuide = localStorage.getItem('hideDownloadGuide');
        const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        
        // 모바일이고 가이드를 숨기지 않았다면 가이드 표시
        if (isMobile && !hideGuide) {
            setShowDownloadGuide(true);
        }
        
        try {
            // 메타데이터가 이미 제거된 상태지만, 다운로드 시 한번 더 확실히 처리
            const cleanImageUrl = await ImageProcessor.removeMetadataFromUrl(generatedImage);
            
            // 다운로드 실행
            const link = document.createElement('a');
            link.href = cleanImageUrl;
            
            const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
            link.download = `face-swap-${timestamp}.jpg`;
            
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
        } catch (error) {
            console.error('Clean download failed, using fallback:', error);
            // 에러 시 기본 다운로드
            const link = document.createElement('a');
            link.href = generatedImage;
            
            const mimeType = generatedImage.substring(5, generatedImage.indexOf(';'));
            const extension = mimeType.split('/')[1] ?? 'png';
            const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
            link.download = `face-swap-${timestamp}.${extension}`;
            
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
      
      {/* 다운로드 가이드 모달 */}
      <DownloadGuide 
        isVisible={showDownloadGuide}
        onClose={() => setShowDownloadGuide(false)}
      />
    </>
  );
};
