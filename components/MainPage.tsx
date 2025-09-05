import React from 'react';

interface MainPageProps {
  onFaceSwapClick: () => void;
  onVideoSwapClick: () => void;
}

export const MainPage: React.FC<MainPageProps> = ({ onFaceSwapClick, onVideoSwapClick }) => {
  return (
    <div className="min-h-screen bg-gradient-to-b from-pink-50 to-blue-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-4">
        {/* Face Swap Card - 크기 축소 */}
        <div className="bg-gradient-to-br from-pink-100 to-pink-200 rounded-2xl p-6 shadow-xl transform transition-all duration-300 hover:scale-105 hover:shadow-2xl">
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
              className="group relative px-6 py-2 bg-gradient-to-r from-pink-500 to-pink-600 text-white font-bold rounded-full shadow-lg transform transition-all duration-300 hover:shadow-xl hover:scale-105 text-sm"
            >
              <span className="relative z-10">시작하기 &gt;</span>
              <div className="absolute inset-0 bg-gradient-to-r from-pink-600 to-pink-700 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            </button>
          </div>
        </div>

        {/* Video Swap Card - 크기 축소 */}
        <div className="bg-gradient-to-br from-blue-100 to-blue-200 rounded-2xl p-6 shadow-xl transform transition-all duration-300 hover:scale-105 hover:shadow-2xl">
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
              className="group relative px-6 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white font-bold rounded-full shadow-lg transform transition-all duration-300 hover:shadow-xl hover:scale-105 text-sm"
            >
              <span className="relative z-10">시작하기 &gt;</span>
              <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-blue-700 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
