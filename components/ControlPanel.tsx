import React, { useState } from 'react';
import { SparklesIcon } from './icons/SparklesIcon';
import type { UserCredits } from '../types';

interface ControlPanelProps {
  facePrompt: string;
  setFacePrompt: (prompt: string) => void;
  clothingPrompt: string;
  setClothingPrompt: (prompt: string) => void;
  onGenerate: () => void;
  isLoading: boolean;
  disabled: boolean;
  credits: UserCredits | null;
}

// 강화된 얼굴 변환 옵션 (구체적인 시각적 특징 포함)
const faceOptions = [
    { 
        value: 'Completely different East Asian male face, age 17-19, soft round face shape, smooth skin without facial hair, small monolid eyes, low nose bridge, thin lips, youthful innocent appearance, black hair', 
        label: '남성: 10대' 
    },
    { 
        value: 'Totally new East Asian male face, age 22-25, oval face shape, clear skin with slight stubble, parallel double eyelids, defined nose bridge, medium lips with clear cupid\'s bow, fresh vibrant appearance', 
        label: '남성: 20대' 
    },
    { 
        value: 'Completely transformed East Asian male face, age 32-36, square jawline, visible nasolabial folds, hooded eyes with crow\'s feet beginning, prominent nose, fuller lower lip, mature masculine features', 
        label: '남성: 30대' 
    },
    { 
        value: 'Entirely different East Asian male face, age 42-46, rectangular face with strong jaw, forehead wrinkles, deep-set eyes with visible eye bags, wider nose, thinner lips, distinguished gray temples', 
        label: '남성: 40대' 
    },
    { 
        value: 'Completely different East Asian female face, age 17-19, soft V-line face shape, porcelain smooth skin, large round eyes with aegyo sal, button nose, plump pink lips, innocent youthful glow', 
        label: '여성: 10대' 
    },
    { 
        value: 'Totally transformed East Asian female face, age 22-25, oval face with high cheekbones, glass skin texture, almond eyes with natural double eyelids, refined nose tip, gradient lips, vibrant fresh beauty', 
        label: '여성: 20대' 
    },
    { 
        value: 'Entirely new East Asian female face, age 32-36, elegant heart-shaped face, fine lines around eyes, sophisticated eye shape with subtle eyeshadow, contoured nose, defined lip shape, mature graceful features', 
        label: '여성: 30대' 
    },
    { 
        value: 'Completely different East Asian female face, age 42-46, diamond face shape, smile lines and crow\'s feet, gentle eyes with wisdom, natural nose, softer lip line, dignified mature beauty', 
        label: '여성: 40대' 
    },
];

// 스타일 옵션 (조각상 제거, 2개만 유지)
const styleOptions = [
    { 
        value: 'Transform into a movie star face with perfect golden ratio proportions, symmetrical features, professional lighting quality skin, charismatic deep eyes, sculpted cheekbones, photogenic angles', 
        label: '영화 배우' 
    },
    { 
        value: 'Transform into soft watercolor painting style face, dreamy ethereal features, pastel skin tones, artistic brush stroke textures, romantic atmosphere, delicate features', 
        label: '수채화' 
    },
];

// 표정 옵션 (더 구체적으로)
const expressionOptions = [
    { 
        value: 'Big genuine smile showing teeth, eyes crinkled with joy, raised cheeks, warm happy expression', 
        label: '웃는 얼굴' 
    },
    { 
        value: 'Serious professional expression, focused eyes, neutral mouth, confident authoritative look', 
        label: '진지한 얼굴' 
    },
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
    isLoading, disabled,
    credits 
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
                            placeholder="예: 완전히 다른 40대 남성의 각진 얼굴, 짙은 눈썹, 깊은 눈 (인물 이름 불가)"
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
            
            {/* 크레딧 부족 경고 */}
            {credits && !hasEnoughCredits && (
                <div className="bg-red-900/30 border border-red-600/50 rounded-lg p-3">
                    <p className="text-sm text-red-400">
                        크레딧이 부족합니다. 얼굴 변환에는 1개의 크레딧이 필요합니다.
                    </p>
                </div>
            )}
            
            <button
                onClick={onGenerate}
                disabled={isDisabled}
                className={`w-full flex items-center justify-center px-6 py-3.5 text-base font-semibold text-white rounded-lg focus:ring-4 focus:outline-none transition-all duration-300 ${
                    isDisabled 
                        ? 'bg-gray-600 cursor-not-allowed' 
                        : 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-800'
                }`}
            >
                {isLoading ? (
                    '처리 중...'
                ) : !hasEnoughCredits ? (
                    '크레딧 부족 (1개 필요)'
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
