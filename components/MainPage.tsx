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

export const MainPage: React.FC<MainPageProps> = ({ onFaceSwapClick, onVideoSwapClick, credits }) => {
  const [showMenu, setShowMenu] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const handleHistoryClick = () => {
    setShowMenu(false);
    setShowHistory(true);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-pink-50 to-blue-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-4">
        {/* 크레딧 표시 카드 */}
        {credits && (
          <div className="bg-white/80 backdrop-blur rounded-2xl p-4 shadow-lg mb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">안녕하세요, {credits.nickname || '사용자'}님</p>
                <p className="text-xs text-gray-500">{credits.email}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500">남은 횟수</p>
                <p className="text-2xl font-bold text-blue-600">{credits.remainingCredits}</p>
              </div>
            </div>
          </div>
        )}

        {/* 메뉴 버튼 - 크레딧 카드 아래 */}
        {credits && (
          <div className="flex justify-end mb-2">
            <div className="relative">
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="p-2 bg-white/80 backdrop-blur rounded-lg shadow-md hover:shadow-lg transition-all duration-200 border border-gray-200"
              >
                <MenuIcon className="w-5 h-5 text-gray-600" />
              </button>
              
              {/* 드롭다운 메뉴 */}
              {showMenu && (
                <div className="absolute right-0 top-12 bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden z-10 min-w-[160px]">
                  <button
                    onClick={handleHistoryClick}
                    className="w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors flex items-center gap-3"
                  >
                    <HistoryIcon className="w-4 h-4 text-gray-500" />
                    <span className="text-sm text-gray-700">내 작품 보기</span>
                  </button>
                  
                  {/* 추후 다른 메뉴 항목 추가 가능 */}
                  <div className="border-t border-gray-100">
                    <div className="px-4 py-2">
                      <p className="text-xs text-gray-400">최근 3일간의 작품만 표시됩니다</p>
                    </div>
                  </div>
                </div>
              )}
              
              {/* 메뉴 외부 클릭 시 닫기 */}
              {showMenu && (
                <div 
                  className="fixed inset-0 z-0" 
                  onClick={() => setShowMenu(false)}
                />
              )}
            </div>
          </div>
        )}

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
          {/* 크레딧 요구사항 배지 - 동적으로 변경됨 */}
          <div className="absolute top-3 right-3 bg-white/90 px-2 py-1 rounded-full">
            <span className="text-xs font-semibold text-blue-600">2-3회 차감</span>
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
                헤어시진을 더욱 생생한<br />
                리뷰 영상으로 전달!
              </p>
            </div>
            <button
              onClick={onVideoSwapClick}
              disabled={!credits || credits.remainingCredits < 2}
              className={`group relative px-6 py-2 font-bold rounded-full shadow-lg transform transition-all duration-300 text-sm ${
                credits && credits.remainingCredits >= 2
                  ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:shadow-xl hover:scale-105'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              <span className="relative z-10">
                {credits && credits.remainingCredits >= 2 ? '시작하기 >' : '크레딧 부족'}
              </span>
              {credits && credits.remainingCredits >= 2 && (
                <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-blue-700 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              )}
            </button>
          </div>
        </div>

        {/* 크레딧 부족 안내 */}
        {credits && credits.remainingCredits === 0 && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
            <p className="text-sm text-red-600 font-medium">크레딧이 모두 소진되었습니다</p>
            <p className="text-xs text-red-500 mt-1">앱에서 크레딧을 구매해주세요</p>
          </div>
        )}
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
};
