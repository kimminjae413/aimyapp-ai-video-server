import React, { useState, useCallback } from 'react';
import { MainPage } from './components/MainPage';
import { VideoSwap } from './components/VideoSwap';
import { Header } from './components/Header';
import { ImageUploader } from './components/ImageUploader';
import { Loader } from './components/Loader';
import { ImageDisplay } from './components/ImageDisplay';
import { ControlPanel } from './components/ControlPanel';
import { changeFaceInImage } from './services/geminiService';
import type { ImageFile } from './types';

type PageType = 'main' | 'faceSwap' | 'videoSwap';

// 기존 FaceSwap 기능을 별도 컴포넌트로 분리
const FaceSwapPage: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [originalImage, setOriginalImage] = useState<ImageFile | null>(null);
  const [generatedImage, setGeneratedImage] = useState<ImageFile | null>(null);
  const [facePrompt, setFacePrompt] = useState<string>('');
  const [clothingPrompt, setClothingPrompt] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

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
      setError(null);
    };
    reader.onerror = () => {
        setError('이미지 파일을 읽는 데 실패했습니다.');
    };
    reader.readAsDataURL(file);
  };

  const handleGenerateClick = useCallback(async () => {
    if (!originalImage) {
      setError('얼굴 이미지를 업로드해주세요.');
      return;
    }
    if (!facePrompt) {
        setError('변환하려는 얼굴 스타일을 선택해주세요.');
        return;
    }
    
    setIsLoading(true);
    setError(null);
    setGeneratedImage(null);

    try {
      const resultImage = await changeFaceInImage(originalImage, facePrompt, clothingPrompt);
      if (resultImage) {
        setGeneratedImage(resultImage);
      } else {
        setError('모델이 이미지를 생성하지 못했습니다. 다른 이미지를 시도해보세요.');
      }
    } catch (err) {
      setError(`생성 중 오류가 발생했습니다: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  }, [originalImage, facePrompt, clothingPrompt]);

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
      
      <Header />
      <main className="w-full max-w-7xl flex flex-col lg:flex-row gap-8 mt-4">
        <div className="lg:w-1/3 flex flex-col gap-6">
          <div className="w-full p-6 bg-gray-800/50 border border-gray-700 rounded-xl flex flex-col gap-6">
            <h2 className="text-xl text-center pink-bold-title">1. 이미지 업로드</h2>
            <ImageUploader title="원본 이미지" onImageUpload={handleImageUpload} imageUrl={originalImage?.url} />
          </div>
          <ControlPanel
            facePrompt={facePrompt}
            setFacePrompt={setFacePrompt}
            clothingPrompt={clothingPrompt}
            setClothingPrompt={setClothingPrompt}
            onGenerate={handleGenerateClick}
            isLoading={isLoading}
            disabled={!originalImage}
          />
        </div>
        <div className="lg:w-2/3 flex flex-col relative min-h-[500px]">
            {isLoading && <Loader />}
            {error && (
              <div className="w-full h-full flex items-center justify-center bg-gray-800/50 border border-gray-700 rounded-xl">
                  <div className="text-center text-red-300 p-4">
                    <h3 className="text-lg font-bold">오류 발생</h3>
                    <p>{error}</p>
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

// 메인 App 컴포넌트 - 라우팅 담당
const App: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<PageType>('main');

  const handleFaceSwapClick = () => {
    setCurrentPage('faceSwap');
  };

  const handleVideoSwapClick = () => {
    setCurrentPage('videoSwap');
  };

  const handleBackToMain = () => {
    setCurrentPage('main');
  };

  // 페이지별 렌더링
  switch (currentPage) {
    case 'main':
      return (
        <MainPage 
          onFaceSwapClick={handleFaceSwapClick} 
          onVideoSwapClick={handleVideoSwapClick} 
        />
      );
    case 'faceSwap':
      return <FaceSwapPage onBack={handleBackToMain} />;
    case 'videoSwap':
      return <VideoSwap onBack={handleBackToMain} />;
    default:
      return null;
  }
};

export default App;
