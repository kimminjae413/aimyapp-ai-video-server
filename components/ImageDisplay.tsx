import React from 'react';
import { ImageIcon } from './icons/ImageIcon';

interface ImageDisplayProps {
  originalImage: string | undefined | null;
  generatedImage: string | undefined | null;
}

const ImageCard: React.FC<{ title: string, src: string | null | undefined, placeholderText: string }> = ({ title, src, placeholderText }) => (
    <div className="w-full flex flex-col items-center">
        <h3 className={'text-lg font-semibold mb-3 text-gray-300'}>{title}</h3>
        <div className="relative w-full aspect-square bg-gray-800 rounded-xl border border-gray-700 flex items-center justify-center overflow-hidden">
            {src ? (
                <img src={src} alt={title} className="object-contain w-full h-full" />
            ) : (
                <div className="text-center text-gray-500 p-4">
                    <ImageIcon className="w-12 h-12 mx-auto" />
                    <p className="mt-2 text-sm">{placeholderText}</p>
                </div>
            )}
        </div>
    </div>
);

export const ImageDisplay: React.FC<ImageDisplayProps> = ({ originalImage, generatedImage }) => {
    if (!originalImage && !generatedImage) {
        return (
             <div className="w-full h-full bg-gray-800/50 border border-gray-700 rounded-xl flex flex-col items-center justify-center p-8 text-center text-gray-500">
                <ImageIcon className="w-24 h-24" />
                <h2 className="mt-6 text-2xl font-bold text-gray-300">AI 얼굴 변환</h2>
                <p className="mt-2 max-w-md">좌측에 이미지를 업로드하고 원하는 스타일을 선택한 후, 변환 버튼을 눌러주세요.</p>
            </div>
        );
    }

  return (
    <div className="w-full h-full grid grid-cols-1 md:grid-cols-2 gap-6 p-6 bg-gray-800/50 border border-gray-700 rounded-xl">
        <ImageCard title="원본" src={originalImage} placeholderText="이미지를 업로드 해주세요" />
        <div className="w-full flex flex-col items-center">
            <h3 className="text-lg font-semibold mb-3 text-blue-400">결과</h3>
            <div className="relative w-full aspect-square bg-gray-800 rounded-xl border border-gray-700 flex items-center justify-center overflow-hidden">
                {generatedImage ? (
                    <img src={generatedImage} alt="Generated Result" className="object-contain w-full h-full" />
                ) : (
                    <div className="text-center text-gray-500 p-4">
                        <ImageIcon className="w-12 h-12 mx-auto" />
                        <p className="mt-2 text-sm">얼굴 변환 대기 중</p>
                    </div>
                )}
            </div>
        </div>
    </div>
  );
};