import React, { useState } from 'react';
import { SparklesIcon } from './icons/SparklesIcon';
import { ImageUploader } from './ImageUploader';
import type { UserCredits, ImageFile } from '../types';

interface ControlPanelProps {
  facePrompt: string;
  setFacePrompt: (prompt: string) => void;
  clothingPrompt: string;
  setClothingPrompt: (prompt: string) => void;
  onGenerate: (referenceImage?: ImageFile | null) => void; // 🔄 수정: 참고이미지 파라미터 추가
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
    // 🆕 VModel 관련 상태들
    const [useReferenceImage, setUseReferenceImage] = useState(true); // VModel 우선 사용
    const [referenceImage, setReferenceImage] = useState<ImageFile | null>(null);

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

    // 🆕 참고이미지 업로드 핸들러
    const handleReferenceImageUpload = (file: File) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const newImageFile = {
                base64: (reader.result as string).split(',')[1],
                mimeType: file.type,
                url: URL.createObjectURL(file),
            };
            setReferenceImage(newImageFile);
        };
        reader.onerror = () => {
            console.error('참고 이미지 파일을 읽는 데 실패했습니다.');
        };
        reader.readAsDataURL(file);
    };

    // 🆕 변환 방식 변경 핸들러
    const handleMethodChange = (useRef: boolean) => {
        setUseReferenceImage(useRef);
        if (!useRef) {
            setReferenceImage(null);
        }
    };

    // 🆕 생성 버튼 클릭 핸들러
    const handleGenerateClick = () => {
        // VModel 방식: 참고이미지 필요
        if (useReferenceImage && !referenceImage) {
            alert('참고할 얼굴 이미지를 업로드해주세요.');
            return;
        }
        
        // Gemini 방식: 텍스트 프롬프트 필요
        if (!useReferenceImage && !facePrompt) {
            alert('변환하려는 얼굴 스타일을 선택해주세요.');
            return;
        }

        // 참고이미지를 onGenerate에 전달
        onGenerate(useReferenceImage ? referenceImage : null);
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

                {/* 🆕 변환 방식 선택 */}
                <div className="space-y-4">
                    <div>
                        <label className="block mb-3 text-sm font-medium text-gray-300">변환 방식 선택</label>
                        <div className="grid grid-cols-1 gap-3">
                            {/* VModel 방식 */}
                            <div 
                                className={`relative p-4 border-2 rounded-lg cursor-pointer transition-all ${
                                    useReferenceImage 
                                        ? 'border-blue-500 bg-blue-500/10' 
                                        : 'border-gray-600 bg-gray-700/30 hover:border-gray-500'
                                }`}
                                onClick={() => handleMethodChange(true)}
                            >
                                <div className="flex items-start gap-3">
                                    <input
                                        type="radio"
                                        checked={useReferenceImage}
                                        onChange={() => handleMethodChange(true)}
                                        className="mt-1"
                                    />
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-2">
                                            <h3 className="font-medium text-white">🎯 참고 이미지 방식</h3>
                                            <span className="text-xs bg-blue-600/80 text-blue-100 px-2 py-1 rounded-full">추천</span>
                                            <span className="text-xs bg-green-600/80 text-green-100 px-2 py-1 rounded-full">$0.02</span>
                                        </div>
                                        <p className="text-sm text-gray-400 mb-2">
                                            원하는 얼굴 사진을 업로드하면 VModel AI가 정확하게 교체해드립니다.
                                        </p>
                                        <div className="text-xs text-blue-300">
                                            ✅ 높은 정확도 | ✅ 자연스러운 결과 | ✅ 빠른 처리 | ✅ 법적 안전
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Gemini 방식 */}
                            <div 
                                className={`relative p-4 border-2 rounded-lg cursor-pointer transition-all ${
                                    !useReferenceImage 
                                        ? 'border-purple-500 bg-purple-500/10' 
                                        : 'border-gray-600 bg-gray-700/30 hover:border-gray-500'
                                }`}
                                onClick={() => handleMethodChange(false)}
                            >
                                <div className="flex items-start gap-3">
                                    <input
                                        type="radio"
                                        checked={!useReferenceImage}
                                        onChange={() => handleMethodChange(false)}
                                        className="mt-1"
                                    />
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-2">
                                            <h3 className="font-medium text-white">📝 텍스트 설명 방식</h3>
                                            <span className="text-xs bg-purple-600/80 text-purple-100 px-2 py-1 rounded-full">폴백</span>
                                        </div>
                                        <p className="text-sm text-gray-400 mb-2">
                                            텍스트로 원하는 얼굴을 설명하면 Gemini AI가 생성해드립니다.
                                        </p>
                                        <div className="text-xs text-purple-300">
                                            ✅ 이미지 불필요 | ⚠️ 결과 예측 어려움 | ⚠️ 느린 처리
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 🆕 VModel 참고 이미지 업로드 */}
                    {useReferenceImage && (
                        <div className="bg-blue-500/5 border border-blue-500/30 rounded-lg p-4">
                            <div className="mb-4">
                                <h4 className="text-sm font-medium text-blue-300 mb-2">📸 참고할 얼굴 이미지 업로드</h4>
                                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded p-3 mb-3">
                                    <p className="text-xs text-yellow-300 leading-relaxed">
                                        <strong>⚠️ 개인정보보호 안내:</strong><br/>
                                        본 서비스는 개인정보보호법에 따라 얼굴을 직접 생성하지 않습니다. 
                                        사용자가 직접 참고하고 싶은 이미지를 업로드해주세요.
                                        타인의 사진 사용 시 당사자 동의를 받으시기 바랍니다.
                                    </p>
                                </div>
                                <ImageUploader
                                    title="참고 얼굴 이미지"
                                    onImageUpload={handleReferenceImageUpload}
                                    imageUrl={referenceImage?.url}
                                />
                                <div className="mt-2 text-xs text-gray-400">
                                    💡 팁: 정면을 보고 있는 선명한 얼굴 사진이 가장 좋은 결과를 만듭니다.
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 🔄 기존 Gemini 텍스트 프롬프트 (조건부 표시) */}
                    {!useReferenceImage && (
                        <div className="bg-purple-500/5 border border-purple-500/30 rounded-lg p-4">
                            <div>
                                <label className="block mb-2 text-sm font-medium text-purple-300">얼굴 스타일 (폴백용)</label>
                                <select
                                    onChange={handleFaceSelectChange}
                                    className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-purple-500 focus:border-purple-500 transition"
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
                                        className="w-full mt-2 p-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-purple-500 focus:border-purple-500 transition"
                                    />
                                )}
                            </div>
                        </div>
                    )}

                    {/* ✅ 기존 의상 변경 (그대로 유지) */}
                    <div>
                        <label className="block mb-2 text-sm font-medium text-gray-300">의상 바꾸기 (선택사항)</label>
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
                        <div className="mt-1 text-xs text-gray-500">
                            Gemini AI가 최종 단계에서 의상을 변경합니다.
                        </div>
                    </div>
                </div>
                
                {/* ✅ 기존 크레딧 부족 경고 (그대로 유지) */}
                {credits && !hasEnoughCredits && (
                    <div className="bg-red-900/30 border border-red-600/50 rounded-lg p-3">
                        <p className="text-sm text-red-400">
                            크레딧이 부족합니다. 얼굴 변환에는 1개의 크레딧이 필요합니다.
                        </p>
                    </div>
                )}
                
                {/* 🔄 기존 생성 버튼 (동적 텍스트 변경) */}
                <button
                    onClick={handleGenerateClick}
                    disabled={isDisabled}
                    className={`w-full flex items-center justify-center px-6 py-3.5 text-base font-semibold text-white rounded-lg focus:ring-4 focus:outline-none transition-all duration-300 ${
                        isDisabled 
                            ? 'bg-gray-600 cursor-not-allowed' 
                            : useReferenceImage
                                ? 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-800'
                                : 'bg-purple-600 hover:bg-purple-700 focus:ring-purple-800'
                    }`}
                >
                    {isLoading ? (
                        '처리 중...'
                    ) : !hasEnoughCredits ? (
                        '크레딧 부족 (1개 필요)'
                    ) : (
                        <>
                            <SparklesIcon className="w-5 h-5 mr-2" />
                            {useReferenceImage ? 'VModel AI로 얼굴교체 (1회 차감)' : 'Gemini로 얼굴변환 (1회 차감)'}
                        </>
                    )}
                </button>

                {/* 🆕 처리 방식 설명 */}
                <div className="bg-gray-700/30 border border-gray-600 rounded-lg p-3">
                    <div className="text-xs text-gray-400 space-y-1">
                        <div className="font-medium text-gray-300 mb-2">🔄 처리 과정:</div>
                        {useReferenceImage ? (
                            <>
                                <div>1️⃣ <span className="text-blue-300">VModel AI</span>: 참고이미지 → 원본이미지 얼굴교체</div>
                                <div>2️⃣ <span className="text-purple-300">Gemini AI</span>: 의상변경 (선택시)</div>
                                <div className="text-green-300">✅ 예상 소요시간: 30초~1분</div>
                            </>
                        ) : (
                            <>
                                <div>1️⃣ <span className="text-purple-300">Gemini AI</span>: 텍스트 → 얼굴생성 및 교체</div>
                                <div>2️⃣ <span className="text-purple-300">Gemini AI</span>: 의상변경 (선택시)</div>
                                <div className="text-yellow-300">⚠️ 예상 소요시간: 1분~2분</div>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
