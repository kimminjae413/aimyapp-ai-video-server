import React, { useState, useEffect } from 'react';
import { XIcon } from './icons/XIcon';

interface DownloadGuideProps {
  isVisible: boolean;
  onClose: () => void;
}

export const DownloadGuide: React.FC<DownloadGuideProps> = ({ isVisible, onClose }) => {
  const [deviceType, setDeviceType] = useState<'ios' | 'android' | 'desktop'>('desktop');

  useEffect(() => {
    const userAgent = navigator.userAgent;
    if (/iPad|iPhone|iPod/.test(userAgent)) {
      setDeviceType('ios');
    } else if (/Android/.test(userAgent)) {
      setDeviceType('android');
    } else {
      setDeviceType('desktop');
    }
  }, []);

  if (!isVisible) return null;

  const getGuideContent = () => {
    switch (deviceType) {
      case 'ios':
        return {
          title: '📱 iOS 다운로드 안내',
          steps: [
            '다운로드 버튼을 누르면 Safari 다운로드가 시작됩니다',
            '화면 우상단의 다운로드 아이콘(↓)을 터치하세요',
            '다운로드된 이미지를 터치한 후 "공유" 버튼을 누르세요',
            '"이미지 저장"을 선택하면 사진 앱에 저장됩니다'
          ],
          tip: '💡 또는 파일 앱 > 다운로드 폴더에서도 확인 가능합니다'
        };
      case 'android':
        return {
          title: '📱 Android 다운로드 안내',
          steps: [
            '다운로드 버튼을 누르면 자동으로 다운로드가 시작됩니다',
            '갤러리 또는 사진 앱에서 바로 확인할 수 있습니다',
            '알림창에서 "다운로드 완료"를 터치해도 바로 확인 가능합니다'
          ],
          tip: '💡 다운로드 폴더나 갤러리에서 확인하세요'
        };
      default:
        return {
          title: '💻 PC 다운로드 안내',
          steps: [
            '다운로드 버튼을 클릭하면 자동으로 저장됩니다',
            '브라우저 기본 다운로드 폴더에 저장됩니다',
            '보통 "다운로드" 또는 "Downloads" 폴더입니다'
          ],
          tip: '💡 Ctrl+J (Windows) 또는 Cmd+Shift+J (Mac)로 다운로드 내역을 확인할 수 있습니다'
        };
    }
  };

  const guide = getGuideContent();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 max-w-md w-full mx-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-white">{guide.title}</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <XIcon className="w-5 h-5" />
          </button>
        </div>
        
        <div className="space-y-3 mb-4">
          {guide.steps.map((step, index) => (
            <div key={index} className="flex items-start space-x-3">
              <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white text-sm rounded-full flex items-center justify-center font-medium">
                {index + 1}
              </span>
              <p className="text-gray-300 text-sm leading-relaxed">{step}</p>
            </div>
          ))}
        </div>
        
        <div className="bg-blue-900/30 border border-blue-700/50 rounded-lg p-3 mb-4">
          <p className="text-blue-200 text-sm">{guide.tip}</p>
        </div>
        
        <div className="flex justify-between items-center">
          <label className="flex items-center space-x-2 text-sm text-gray-400">
            <input
              type="checkbox"
              onChange={(e) => {
                if (e.target.checked) {
                  localStorage.setItem('hideDownloadGuide', 'true');
                }
              }}
              className="rounded border-gray-600 text-blue-600 focus:ring-blue-500 focus:ring-offset-gray-800"
            />
            <span>다시 보지 않기</span>
          </label>
          
          <button
            onClick={onClose}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            확인
          </button>
        </div>
      </div>
    </div>
  );
};
