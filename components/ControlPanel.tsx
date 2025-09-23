import React, { useState } from 'react';
import { SparklesIcon } from './icons/SparklesIcon';
import { ImageUploader } from './ImageUploader';
import type { UserCredits, ImageFile } from '../types';

interface ControlPanelProps {
  facePrompt: string;
  setFacePrompt: (prompt: string) => void;
  clothingPrompt: string;
  setClothingPrompt: (prompt: string) => void;
  onGenerate: (referenceImage?: ImageFile | null) => void;
  isLoading: boolean;
  disabled: boolean;
  credits: UserCredits | null;
}

// 의상 옵션만 유지
const clothingOptions = {
  male: [
    { value: 'A sophisticated and stylish modern business suit.', label: '세련된 정장'},
    { value: 'A comfortable and casual hoodie with jeans.', label: '캐주얼 후드티'},
    { value: 'A clean white t-shirt and dark denim jeans.', label: '청바지와 흰 티'},
    { value: 'A warm and comfortable knit sweater.', label: '따뜻한 니트'},
  ],
  female: [
    { value: 'A chic and professional office blouse with trousers.', label: '단정한 오피스룩' },
    { value: 'Comfortable and stylish athletic sportswear.', label: '활동적인 운동복' },
    { value: 'A casual and cute knit cardigan over a t-shirt.', label: '니트 가디건' },
    { value: 'A simple and modern one-piece dress.', label: '심플한 원피스' },
  ]
};

export const ControlPanel: React.FC<ControlPanelProps> = ({ 
  clothingPrompt, setClothingPrompt, 
  onGenerate, 
  isLoading, disabled,
  credits 
}) => {
  const [referenceImage, setReferenceImage] = useState<ImageFile | null>(null);

  const handleReferenceImageUpload = (file: File) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const imageFile = {
        base64: (reader.result as string).split(',')[1],
        mimeType: file.type,
        url: URL.createObjectURL(file),
      };
      setReferenceImage(imageFile);
    };
    reader.readAsDataURL(file);
  };

  const handleGenerateClick = () => {
    onGenerate(referenceImage);
  };
  
  const hasEnoughCredits = credits ? credits.remainingCredits >= 1 : false;
  const isDisabled = isLoading || disabled || !hasEnoughCredits;
  
  return (
    <div className="w-full p-6 bg-gray-800/50 border border-gray-700 rounded-xl flex flex-col gap-6">
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl pink-bold-title">2. 얼굴 변환 설정</h2>
          {credits && (
            <div className="flex items-center gap-2 bg-gray-700/50 px-3 py-1 rounded-lg">
              <span className="text-xs text-gray-400">남은:</span>
              <span className={`text-sm font-bold ${hasEnoughCredits ? 'text-cyan-400' : 'text-red-400'}`}>
                {credits.remainingCredits}
              </span>
            </div>
          )}
        </div>
        
        <div className="space-y-4">
          {/* 참조 얼굴 이미지 업로드 */}
          <div>
            <label className="block mb-2 text-sm font-medium text-gray-300">참조 얼굴 이미지</label>
            <ImageUploader 
              title="바꾸고 싶은 얼굴" 
              onImageUpload={handleReferenceImageUpload} 
              imageUrl={referenceImage?.url} 
            />
            <p className="text-xs text-gray-500 mt-2">
              이 얼굴로 원본 이미지의 얼굴이 교체됩니다
            </p>
          </div>

          {/* 의상 변경 옵션 */}
          <div>
            <label className="block mb-2 text-sm font-medium text-gray-300">의상 바꾸기 (선택사항)</label>
            <select
              value={clothingPrompt}
              onChange={(e) => setClothingPrompt(e.target.value)}
              className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-blue-500 focus:border-blue-500 transition"
            >
              <option value="">의상 유지</option>
              <optgroup label="남성 의상">
                {clothingOptions.male.map(option => 
                  <option key={option.value} value={option.value}>{option.label}</option>
                )}
              </optgroup>
              <optgroup label="여성 의상">
                {clothingOptions.female.map(option => 
                  <option key={option.value} value={option.value}>{option.label}</option>
                )}
              </optgroup>
            </select>
          </div>
        </div>
        
        {/* 참조이미지 없을 시 안내 */}
        {!referenceImage && (
          <div className="bg-blue-900/30 border border-blue-600/50 rounded-lg p-3">
            <p className="text-sm text-blue-400">
              참조 얼굴 이미지를 업로드하면 VModel AI로 정확한 얼굴 교체가 가능합니다
            </p>
          </div>
        )}
        
        {/* 크레딧 부족 경고 */}
        {credits && !hasEnoughCredits && (
          <div className="bg-red-900/30 border border-red-600/50 rounded-lg p-3">
            <p className="text-sm text-red-400">
              크레딧이 부족합니다. 얼굴 변환에는 1개의 크레딧이 필요합니다.
            </p>
          </div>
        )}
        
        <button
          onClick={handleGenerateClick}
          disabled={isDisabled || !referenceImage}
          className={`w-full flex items-center justify-center px-6 py-3.5 text-base font-semibold text-white rounded-lg focus:ring-4 focus:outline-none transition-all duration-300 ${
            isDisabled || !referenceImage
              ? 'bg-gray-600 cursor-not-allowed' 
              : 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-800'
          }`}
        >
          {isLoading ? (
            '처리 중...'
          ) : !hasEnoughCredits ? (
            '크레딧 부족 (1개 필요)'
          ) : !referenceImage ? (
            '참조 얼굴 이미지를 업로드하세요'
          ) : (
            <>
              <SparklesIcon className="w-5 h-5 mr-2" />
              얼굴 변환하기 (1회 차감)
            </>
          )}
        </button>
      </div>
    </div>
  );
};
