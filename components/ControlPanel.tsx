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

// 강화된 얼굴 변환 옵션 - 더 극적인 변화를 위한 프롬프트
const faceOptions = [
    { 
        value: 'COMPLETELY REPLACE the face with an entirely different East Asian male teenager, age 17-19: baby-faced with chubby cheeks, completely smooth hairless skin, very small narrow monolid eyes, extremely low flat nose bridge, thin small lips, round innocent face shape, youthful appearance that looks much younger than actual age', 
        label: '남성: 10대',
        gender: 'male'
    },
    { 
        value: 'TOTALLY TRANSFORM into a completely different East Asian male in early twenties, age 22-25: sharp angular jaw, well-defined cheekbones, clear skin with light stubble, large parallel double eyelids, prominent straight nose bridge, full lips with defined cupid bow, confident masculine facial structure, fresh handsome appearance', 
        label: '남성: 20대',
        gender: 'male'
    },
    { 
        value: 'COMPLETELY CHANGE to an entirely different East Asian male in thirties, age 32-36: strong square jaw, deep-set mature eyes with slight crow feet, visible nasolabial folds, broader nose, weathered skin texture, fuller lower lip, distinguished masculine features showing life experience and maturity', 
        label: '남성: 30대',
        gender: 'male'
    },
    { 
        value: 'ENTIRELY REPLACE with a different East Asian male in forties, age 42-46: rectangular face with pronounced jaw, deep forehead wrinkles, hooded eyes with eye bags, wider flatter nose, thinner lips, graying temples, weathered mature skin showing age, distinguished older gentleman appearance', 
        label: '남성: 40대',
        gender: 'male'
    },
    { 
        value: 'COMPLETELY REPLACE the face with an entirely different East Asian female teenager, age 17-19: perfect V-line face shape, porcelain doll-like skin, very large round eyes with prominent aegyo sal, tiny button nose, small plump pink lips, innocent youthful features that look much younger than age', 
        label: '여성: 10대',
        gender: 'female'
    },
    { 
        value: 'TOTALLY TRANSFORM into a completely different East Asian female in early twenties, age 22-25: elegant oval face with high cheekbones, glass-like perfect skin, large almond-shaped eyes with natural double eyelids, refined narrow nose tip, gradient coral lips, sophisticated beautiful features', 
        label: '여성: 20대',
        gender: 'female'
    },
    { 
        value: 'COMPLETELY CHANGE to an entirely different East Asian female in thirties, age 32-36: heart-shaped face with mature features, subtle fine lines around eyes, sophisticated eye makeup, contoured nose, well-defined lip shape, elegant mature beauty with confident expression', 
        label: '여성: 30대',
        gender: 'female'
    },
    { 
        value: 'ENTIRELY REPLACE with a different East Asian female in forties, age 42-46: diamond-shaped face, visible smile lines and crow feet, gentle wise eyes, natural aging skin, softer lip line, dignified mature features showing life experience and wisdom', 
        label: '여성: 40대',
        gender: 'female'
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
                            {faceOptions.map(option => (
                                <option 
                                    key={option.value} 
                                    value={option.value}
                                    style={{
                                        color: option.gender === 'male' ? '#60a5fa' : '#f472b6'
                                    }}
                                >
                                    {option.label}
                                </option>
                            ))}
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
