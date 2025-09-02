import React from 'react';

const imageMessages = [
  "얼굴 특징을 분석하고 있습니다...",
  "새로운 얼굴을 디자인하는 중...",
  "이미지에 자연스럽게 합성하고 있습니다...",
  "새로운 모습이 거의 완성되었습니다!"
];

export const Loader: React.FC = () => {
  const [message, setMessage] = React.useState(imageMessages[0]);

  React.useEffect(() => {
    const interval = setInterval(() => {
      setMessage(prevMessage => {
        const currentIndex = imageMessages.indexOf(prevMessage);
        const nextIndex = (currentIndex + 1) % imageMessages.length;
        return imageMessages[nextIndex];
      });
    }, 4000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="absolute inset-0 bg-gray-900/80 backdrop-blur-sm flex flex-col items-center justify-center z-10 rounded-xl">
        <div className="w-16 h-16 border-4 border-blue-400 border-dashed rounded-full animate-spin"></div>
        <p className="mt-6 text-lg text-white font-medium transition-opacity duration-500">{message}</p>
    </div>
  );
};