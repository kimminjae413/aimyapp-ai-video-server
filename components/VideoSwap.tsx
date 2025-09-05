import React, { useState } from 'react';
import { VideoIcon } from './icons/VideoIcon';
import { ImageUploader } from './ImageUploader';
import { Loader } from './Loader';
import { generateVideoWithKling, motionTemplates } from '../services/klingService';
import type { ImageFile } from '../types';

export const VideoSwap: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [originalImage, setOriginalImage] = useState<ImageFile | null>(null);
  const [prompt, setPrompt] = useState<string>('');
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string | null>(null);
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
      setGeneratedVideoUrl(null);
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

    try {
      const videoUrl = await generateVideoWithKling(originalImage, finalPrompt);
      setGeneratedVideoUrl(videoUrl);
    } catch (err) {
      setError(`영상 생성 중 오류가 발생했습니다: ${err instanceof Error ? err.message : 'Unknown error'}`);
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

  return (
    <div className="min-h-screen bg-gray-900 text-gray-200 flex flex-col items-center p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <header className="text-center w-full mb-6">
        <button
          onClick={onBack}
          className="absolute left-4 top-4 p-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
          AI 영상 변환
        </h1>
        <p className="mt-2 text-lg text-gray-400">
          사진을 업로드하고 원하는 동작을 입력하면 AI가 영상으로 변환해드립니다.
        </p>
      </header>

      <main className="w-full max-w-7xl flex flex-col lg:flex-row gap-8">
        {/* Left Panel */}
        <div className="lg:w-1/3 flex flex-col gap-6">
          <div className="w-full p-6 bg-gray-800/50 border border-gray-700 rounded-xl">
            <h2 className="text-xl text-center font-bold text-cyan-400 mb-4">1. 이미지 업로드</h2>
            <ImageUploader 
              title="원본 이미지" 
              onImageUpload={handleImageUpload} 
              imageUrl={originalImage?.url} 
            />
          </div>

          <div className="w-full p-6 bg-gray-800/50 border border-gray-700 rounded-xl">
            <h2 className="text-xl text-center font-bold text-cyan-400 mb-4">2. 영상 설명</h2>
            
            {/* Duration Selection */}
            <div className="mb-4">
              <label className="block mb-2 text-sm font-medium text-gray-300">영상 길이</label>
              <select
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-blue-500 focus:border-blue-500 transition"
              >
                <option value={5}>5초</option>
                <option value={10}>10초</option>
              </select>
            </div>

            {/* Motion Templates */}
            <div className="mb-4">
              <label className="block mb-2 text-sm font-medium text-gray-300">모션 템플릿</label>
              <select
                value={selectedTemplate}
                onChange={handleTemplateChange}
                className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-blue-500 focus:border-blue-500 transition"
              >
                <option value="">직접 입력</option>
                <option value="smile">자연스러운 미소</option>
                <option value="wink">윙크</option>
                <option value="headTurn">고개 돌리기</option>
                <option value="hairFlow">바람에 날리는 머리</option>
                <option value="laugh">웃는 표정</option>
                <option value="talk">말하는 모습</option>
                <option value="nod">고개 끄덕이기</option>
                <option value="blink">자연스러운 눈 깜빡임</option>
                <option value="wave">손 흔들기</option>
                <option value="lookAround">주변 둘러보기</option>
              </select>
            </div>

            {/* Custom Prompt */}
            <textarea
              value={prompt}
              onChange={(e) => {
                setPrompt(e.target.value);
                setSelectedTemplate('');
              }}
              placeholder="예: 머리를 좌우로 흔들며 웃는 모습, 윙크하는 모습, 바람에 머리카락이 날리는 모습"
              className="w-full h-32 p-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-blue-500 focus:border-blue-500 transition resize-none"
              disabled={!!selectedTemplate}
            />
            
            {progress && (
              <div className="mt-3 text-sm text-cyan-400">
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
                <p>{error}</p>
              </div>
            </div>
          )}

          {!isLoading && !error && (
            <div className="w-full h-full bg-gray-800/50 border border-gray-700 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-gray-300 mb-4 text-center">결과 영상</h3>
              {generatedVideoUrl ? (
                <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden">
                  <video 
                    controls 
                    className="w-full h-full"
                    src={generatedVideoUrl}
                  >
                    Your browser does not support the video tag.
                  </video>
                </div>
              ) : (
                <div className="w-full aspect-video bg-gray-800 rounded-xl flex flex-col items-center justify-center text-gray-500">
                  <VideoIcon className="w-16 h-16 mb-4" />
                  <p>헤어 리뷰 영상 대기 중</p>
                  <p className="text-sm mt-2 text-gray-600">사진을 업로드하고 템플릿을 선택한 후 생성 버튼을 눌러주세요</p>
                  <div className="mt-4 text-xs text-gray-600 max-w-md text-center">
                    💡 Tip: 고객이 직접 포즈를 취하기 부담스러워할 때,<br/>
                    AI 영상으로 자연스러운 리뷰 영상을 만들어보세요!
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
