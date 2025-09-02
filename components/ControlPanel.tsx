import React, { useState } from 'react';
import { SparklesIcon } from './icons/SparklesIcon';

interface ControlPanelProps {
  facePrompt: string;
  setFacePrompt: (prompt: string) => void;
  clothingPrompt: string;
  setClothingPrompt: (prompt: string) => void;
  onGenerate: () => void;
  isLoading: boolean;
  disabled: boolean;
}

const faceOptions = [
    { value: 'The youthful face of an East Asian male in his late teens.', label: '남성: 10대' },
    { value: 'The fresh face of an East Asian male in his early 20s.', label: '남성: 20대' },
    { value: 'The mature and intellectual face of an East Asian male in his 30s.', label: '남성: 30대' },
    { value: 'The dignified and charismatic face of an East Asian male in his 40s.', label: '남성: 40대' },
    { value: 'The innocent face of an East Asian female in her late teens.', label: '여성: 10대' },
    { value: 'The vibrant and lively face of an East Asian female in her early 20s.', label: '여성: 20대' },
    { value: 'The elegant and sophisticated face of an East Asian female in her 30s.', label: '여성: 30대' },
    { value: 'The graceful and gentle face of an East Asian female in her 40s.', label: '여성: 40대' },
];

const styleOptions = [
    { value: 'The face of a movie star with intense charisma and a sharp jawline.', label: '영화 배우' },
    { value: 'A face like an ancient sculpture with perfect golden ratio proportions.', label: '조각상' },
    { value: 'A face that looks like a soft, dreamy watercolor painting.', label: '수채화' },
];

const expressionOptions = [
    { value: 'A face with a big, happy smile.', label: '웃는 얼굴' },
    { value: 'A face with a charismatic and serious expression.', label: '진지한 얼굴' },
];

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
}

export const ControlPanel: React.FC<ControlPanelProps> = ({ 
    facePrompt, setFacePrompt, 
    clothingPrompt, setClothingPrompt, 
    onGenerate, 
    isLoading, disabled 
}) => {
    const [isCustomFace, setIsCustomFace] = useState(false);

    const handleFaceSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const value = e.target.value;
        if (value === 'custom') {
            setIsCustomFace(true);
            setFacePrompt('');
        } else {
            setIsCustomFace(false);
            setFacePrompt(value);
        }
    };
    
  return (
    <div className="w-full p-6 bg-gray-800/50 border border-gray-700 rounded-xl flex flex-col gap-6">
        <div className="flex flex-col gap-6">
            <h2 className="text-xl font-bold text-white">2. 얼굴 변환 설정</h2>
            <div className="space-y-4">
                <div>
                    <label className="block mb-2 text-sm font-medium text-gray-300">얼굴 스타일</label>
                    <select
                        onChange={handleFaceSelectChange}
                        className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-blue-500 focus:border-blue-500 transition"
                        value={isCustomFace ? 'custom' : facePrompt}
                    >
                        <option value="">옵션을 선택하세요</option>
                        <optgroup label="인물 (성별/나이)">
                            {faceOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                        </optgroup>
                        <optgroup label="아트 스타일">
                            {styleOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                        </optgroup>
                        <optgroup label="표정">
                            {expressionOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                        </optgroup>
                        <option value="custom">직접 입력</option>
                    </select>
                    {isCustomFace && (
                        <input
                            type="text"
                            value={facePrompt}
                            onChange={(e) => setFacePrompt(e.target.value)}
                            placeholder="예: 50대 남성의 온화한 얼굴 (인물 이름 불가)"
                            className="w-full mt-2 p-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-blue-500 focus:border-blue-500 transition"
                        />
                    )}
                </div>
                <div>
                    <label className="block mb-2 text-sm font-medium text-gray-300">의상 바꾸기</label>
                    <select
                        value={clothingPrompt}
                        onChange={(e) => setClothingPrompt(e.target.value)}
                        className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-blue-500 focus:border-blue-500 transition"
                    >
                        <option value="">없음</option>
                        <optgroup label="남성 의상">
                            {clothingOptions.male.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                        </optgroup>
                        <optgroup label="여성 의상">
                            {clothingOptions.female.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                        </optgroup>
                    </select>
                </div>
            </div>
            <button
                onClick={onGenerate}
                disabled={isLoading || disabled}
                className="w-full flex items-center justify-center px-6 py-3.5 text-base font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:ring-4 focus:outline-none focus:ring-blue-800 disabled:bg-gray-600 disabled:cursor-not-allowed transition-all duration-300"
            >
                {isLoading ? (
                    '처리 중...'
                ) : (
                    <>
                    <SparklesIcon className="w-5 h-5 mr-2" />
                    얼굴 변환하기
                    </>
                )}
            </button>
        </div>
    </div>
  );
};