import React from 'react';

interface LoaderProps {
  type?: 'image' | 'video';
}

const imageMessages = [
  "얼굴 특징을 분석하고 있습니다...",
  "새로운 얼굴을 디자인하는 중...",
  "이미지에 자연스럽게 합성하고 있습니다...",
  "새로운 모습이 거의 완성되었습니다!"
];

const videoMessages = [
  "이미지를 영상으로 변환 중입니다...",
  "AI가 움직임을 생성하고 있습니다...",
  "자연스러운 모션을 적용하는 중...",
  "영상 렌더링을 진행하고 있습니다...",
  "최종 영상을 처리하고 있습니다..."
];

export const Loader: React.FC<LoaderProps> = ({ type = 'image' }) => {
  const messages = type === 'video' ? videoMessages : imageMessages;
  const [message, setMessage] = React.useState(messages[0]);

  React.useEffect(() => {
    const interval = setInterval(() => {
      setMessage(prevMessage => {
        const currentIndex = messages.indexOf(prevMessage);
        const nextIndex = (currentIndex + 1) % messages.length;
        return messages[nextIndex];
      });
    }, type === 'video' ? 5000 : 4000); // 영상은 더 오래 걸리므로 5초

    return () => clearInterval(interval);
  }, [messages, type]);

  return (
    <div className="absolute inset-0 bg-gray-900/80 backdrop-blur-sm flex flex-col items-center justify-center z-10 rounded-xl">
        <div className="w-16 h-16 border-4 border-blue-400 border-dashed rounded-full animate-spin"></div>
        <p className="mt-6 text-lg text-white font-medium transition-opacity duration-500">{message}</p>
        {type === 'video' && (
          <p className="mt-2 text-sm text-gray-400">영상 생성은 최대 5분 정도 소요될 수 있습니다</p>
        )}
    </div>
  );
};
