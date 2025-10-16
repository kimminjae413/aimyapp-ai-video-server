// components/MainPage.tsx
import React, { useState } from 'react';
import { MenuIcon } from './icons/MenuIcon';
import { HistoryIcon } from './icons/HistoryIcon';
import { GenerationHistory } from './GenerationHistory';
import type { UserCredits } from '../types';

interface MainPageProps {
  onFaceSwapClick: () => void;
  onVideoSwapClick: () => void;
  credits: UserCredits | null;
}

export function MainPage({ onFaceSwapClick, onVideoSwapClick, credits }: MainPageProps) {
  const [showHistory, setShowHistory] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
      {/* Header */}
      <div className="bg-gray-800/50 backdrop-blur-sm border-b border-gray-700 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <MenuIcon className="w-8 h-8 text-white" />
            <h1 className="text-2xl font-bold bg-gradient-to-r from-pink-400 to-blue-400 bg-clip-text text-transparent">
              AI 변환 스튜디오
            </h1>
          </div>
          
          <div className="flex items-center space-x-4">
            {/* 크레딧 표시 */}
            {credits && (
              <div className="bg-gradient-to-r from-purple-600 to-blue-600 px-4 py-2 rounded-full shadow-lg">
                <span className="text-sm font-bold">
                  💎 {credits.remainingCredits}회
                </span>
              </div>
            )}
            
            {/* 생성 내역 버튼 */}
            <button
              onClick={() => setShowHistory(true)}
              className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
              title="생성 내역"
            >
              <HistoryIcon className="w-6 h-6" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 py-12">
        {/* Welcome Section */}
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold mb-4 bg-gradient-to-r from-pink-300 via-purple-300 to-blue-300 bg-clip-text text-transparent">
            AI 얼굴변환 & 영상변환 
          </h2>
          <p className="text-gray-400 text-lg">
            얼굴 변환부터 영상 생성까지, 한 번에!
          </p>
        </div>

        {/* Service Cards */}
        <div className="grid md:grid-cols-2 gap-8 mb-8">
          {/* Face Swap Card */}
          <div className="bg-gradient-to-br from-pink-100 to-pink-200 rounded-2xl p-6 shadow-xl transform transition-all duration-300 hover:scale-105 hover:shadow-2xl relative">
            {/* 크레딧 요구사항 배지 */}
            <div className="absolute top-3 right-3 bg-white/90 px-2 py-1 rounded-full">
              <span className="text-xs font-semibold text-pink-600">1회 차감</span>
            </div>
            
            <div className="flex flex-col items-center text-center space-y-3">
              <div className="relative">
                <div className="absolute inset-0 bg-white rounded-full blur-xl opacity-50"></div>
                <div className="relative w-32 h-32 rounded-full overflow-hidden border-4 border-white shadow-lg">
                  <img 
                    src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'%3E%3Cdefs%3E%3ClinearGradient id='grad1' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' style='stop-color:%23fce4ec;stop-opacity:1' /%3E%3Cstop offset='100%25' style='stop-color:%23f8bbd0;stop-opacity:1' /%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='200' height='200' fill='url(%23grad1)' /%3E%3Ccircle cx='70' cy='80' r='35' fill='%23fff' opacity='0.9'/%3E%3Ccircle cx='130' cy='90' r='40' fill='%23fff' opacity='0.8'/%3E%3Cpath d='M 60 150 Q 100 170 140 150' stroke='%23e91e63' stroke-width='3' fill='none'/%3E%3C/svg%3E" 
                    alt="Face Swap Preview" 
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <h2 className="text-xl font-bold text-gray-800">AI얼굴변환</h2>
                <p className="text-gray-700 text-xs px-2">
                  초상권 없는 모델로<br />
                  자연스럽게 변환!
                </p>
              </div>
              <button
                onClick={onFaceSwapClick}
                disabled={!credits || credits.remainingCredits < 1}
                className={`group relative px-6 py-2 font-bold rounded-full shadow-lg transform transition-all duration-300 text-sm ${
                  credits && credits.remainingCredits >= 1
                    ? 'bg-gradient-to-r from-pink-500 to-pink-600 text-white hover:shadow-xl hover:scale-105'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                <span className="relative z-10">
                  {credits && credits.remainingCredits >= 1 ? '시작하기 >' : '크레딧 부족'}
                </span>
                {credits && credits.remainingCredits >= 1 && (
                  <div className="absolute inset-0 bg-gradient-to-r from-pink-600 to-pink-700 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                )}
              </button>
            </div>
          </div>

          {/* Video Swap Card */}
          <div className="bg-gradient-to-br from-blue-100 to-blue-200 rounded-2xl p-6 shadow-xl transform transition-all duration-300 hover:scale-105 hover:shadow-2xl relative">
            {/* ✅ 크레딧 요구사항 배지 - 4-8회로 수정 */}
            <div className="absolute top-3 right-3 bg-white/90 px-2 py-1 rounded-full">
              <span className="text-xs font-semibold text-blue-600">4-8회 차감</span>
            </div>
            
            <div className="flex flex-col items-center text-center space-y-3">
              <div className="relative">
                <div className="absolute inset-0 bg-white rounded-2xl blur-xl opacity-50"></div>
                <div className="relative w-32 h-32 flex items-center justify-center">
                  <div className="w-24 h-32 bg-gradient-to-br from-cyan-300 to-cyan-400 rounded-xl shadow-lg transform rotate-6 transition-transform duration-300 hover:rotate-12">
                    <div className="w-full h-full flex items-center justify-center">
                      <div className="w-12 h-12 bg-white/80 rounded-full flex items-center justify-center">
                        <svg className="w-8 h-8 text-cyan-600" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M8 5v14l11-7z"/>
                        </svg>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="space-y-1">
                <h2 className="text-xl font-bold text-gray-800">AI영상변환</h2>
                <p className="text-gray-700 text-xs px-2">
                  헤어사진을 더욱 생생한<br />
                  리뷰 영상으로 전달!
                </p>
              </div>
              <button
                onClick={onVideoSwapClick}
                disabled={!credits || credits.remainingCredits < 4}
                className={`group relative px-6 py-2 font-bold rounded-full shadow-lg transform transition-all duration-300 text-sm ${
                  credits && credits.remainingCredits >= 4
                    ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:shadow-xl hover:scale-105'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                <span className="relative z-10">
                  {credits && credits.remainingCredits >= 4 ? '시작하기 >' : '크레딧 부족'}
                </span>
                {credits && credits.remainingCredits >= 4 && (
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-blue-700 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* 크레딧 부족 안내 */}
        {credits && credits.remainingCredits === 0 && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
            <p className="text-sm text-red-600 font-medium">크레딧이 모두 소진되었습니다</p>
            <p className="text-xs text-red-500 mt-1">앱에서 크레딧을 구매해주세요</p>
          </div>
        )}

        {/* ✅ 영상 변환 크레딧 안내 추가 */}
        <div className="mt-6 p-4 bg-cyan-500/10 border border-cyan-500/30 rounded-xl">
          <div className="text-center">
            <p className="text-sm text-cyan-300 font-medium mb-2">
              💡 영상 변환 크레딧 안내
            </p>
            <div className="flex justify-center gap-4 text-xs text-cyan-200">
              <span>⏱️ 4초 = 4회</span>
              <span>⏱️ 6초 = 6회</span>
              <span>⏱️ 8초 = 8회</span>
            </div>
            <p className="text-xs text-cyan-400 mt-2">
              원하는 영상 길이를 선택하세요!
            </p>
          </div>
        </div>
      </div>

      {/* 생성 내역 모달 */}
      {showHistory && credits && (
        <GenerationHistory 
          isOpen={showHistory}
          onClose={() => setShowHistory(false)}
          userId={credits.userId}
        />
      )}
    </div>
  );
}
