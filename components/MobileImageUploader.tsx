import React, { useCallback, useState } from 'react';
import { Camera } from '@capacitor/camera';
import { CameraResultType, CameraSource } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';
import { UploadIcon } from './icons/UploadIcon';

interface MobileImageUploaderProps {
  onImageUpload: (file: File) => void;
  imageUrl: string | undefined;
  title: string;
}

export const MobileImageUploader: React.FC<MobileImageUploaderProps> = ({ 
  onImageUpload, 
  imageUrl, 
  title 
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // 파일 선택 핸들러
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onImageUpload(e.target.files[0]);
    }
  };

  // 카메라 촬영
  const takePicture = async () => {
    if (!Capacitor.isNativePlatform()) {
      // 웹 환경에서는 파일 입력 사용
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.capture = 'environment'; // 후면 카메라 우선
      input.onchange = (e: any) => {
        if (e.target.files && e.target.files[0]) {
          onImageUpload(e.target.files[0]);
        }
      };
      input.click();
      return;
    }

    try {
      setIsLoading(true);
      const image = await Camera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Camera
      });

      if (image.dataUrl) {
        // DataURL을 File 객체로 변환
        const response = await fetch(image.dataUrl);
        const blob = await response.blob();
        const file = new File([blob], 'camera-photo.jpg', { type: 'image/jpeg' });
        onImageUpload(file);
      }
    } catch (error) {
      console.error('카메라 사진 촬영 실패:', error);
      alert('카메라 사진 촬영에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  // 갤러리에서 선택
  const selectFromGallery = async () => {
    if (!Capacitor.isNativePlatform()) {
      // 웹 환경에서는 파일 입력 사용
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = (e: any) => {
        if (e.target.files && e.target.files[0]) {
          onImageUpload(e.target.files[0]);
        }
      };
      input.click();
      return;
    }

    try {
      setIsLoading(true);
      const image = await Camera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Photos
      });

      if (image.dataUrl) {
        // DataURL을 File 객체로 변환
        const response = await fetch(image.dataUrl);
        const blob = await response.blob();
        const file = new File([blob], 'gallery-photo.jpg', { type: 'image/jpeg' });
        onImageUpload(file);
      }
    } catch (error) {
      console.error('갤러리 사진 선택 실패:', error);
      alert('갤러리에서 사진을 선택하는데 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  // 드래그 앤 드롭 핸들러
  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      onImageUpload(e.dataTransfer.files[0]);
    }
  }, [onImageUpload]);

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };
  
  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const baseClasses = "relative flex flex-col items-center justify-center w-full h-64 rounded-xl border-2 border-dashed transition-all duration-300";
  const inactiveClasses = "border-gray-600 bg-gray-800";
  const activeClasses = "border-blue-400 bg-blue-900/50 scale-105";

  return (
    <div className="w-full">
      <h3 className="text-lg font-semibold text-gray-300 mb-3 text-center">{title}</h3>
      
      {/* 이미지 미리보기 또는 업로드 영역 */}
      <div
        className={`${baseClasses} ${isDragging ? activeClasses : inactiveClasses}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
      >
        {isLoading ? (
          <div className="flex flex-col items-center justify-center text-gray-400">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-400 mb-3"></div>
            <p className="text-sm">이미지 처리 중...</p>
          </div>
        ) : imageUrl ? (
          <img src={imageUrl} alt="Uploaded preview" className="object-cover w-full h-full rounded-xl" />
        ) : (
          <div className="flex flex-col items-center justify-center pt-5 pb-6 text-gray-400">
            <UploadIcon className="w-10 h-10 mb-3" />
            <p className="mb-2 text-sm font-semibold text-center">이미지를 선택하세요</p>
            <p className="text-xs text-center">PNG, JPG, WEBP</p>
          </div>
        )}
      </div>

      {/* 모바일 친화적인 버튼들 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
        {/* 카메라 버튼 */}
        <button
          onClick={takePicture}
          disabled={isLoading}
          className="flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded-lg transition-colors font-medium"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          카메라
        </button>

        {/* 갤러리 버튼 */}
        <button
          onClick={selectFromGallery}
          disabled={isLoading}
          className="flex items-center justify-center gap-2 px-4 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white rounded-lg transition-colors font-medium"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          갤러리
        </button>

        {/* 파일 선택 버튼 */}
        <label
          htmlFor={`file-input-${title.replace(/\s+/g, '-')}`}
          className="flex items-center justify-center gap-2 px-4 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors font-medium cursor-pointer"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          파일 선택
        </label>
      </div>

      {/* 숨겨진 파일 입력 */}
      <input
        id={`file-input-${title.replace(/\s+/g, '-')}`}
        type="file"
        className="hidden"
        onChange={handleFileChange}
        accept="image/png, image/jpeg, image/webp"
      />
    </div>
  );
};