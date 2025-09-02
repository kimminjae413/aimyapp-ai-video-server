import React from 'react';

export const Header: React.FC = () => (
  <header className="text-center w-full">
    <h1 className="text-4xl sm:text-5xl font-bold text-pink-400">
      FACE SWAP
    </h1>
    <p className="mt-2 text-lg text-gray-400">
      사진을 업로드하고, 얼굴과 의상 스타일을 선택하여 새로운 인물 사진을 만들어보세요.
    </p>
  </header>
);