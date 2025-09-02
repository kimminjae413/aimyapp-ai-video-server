
import React, { useCallback, useState } from 'react';
import { UploadIcon } from './icons/UploadIcon';

interface ImageUploaderProps {
  onImageUpload: (file: File) => void;
  imageUrl: string | undefined;
  title: string;
}

export const ImageUploader: React.FC<ImageUploaderProps> = ({ onImageUpload, imageUrl, title }) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onImageUpload(e.target.files[0]);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      onImageUpload(e.dataTransfer.files[0]);
    }
  }, [onImageUpload]);

  const handleDragOver = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragEnter = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };
  
  const handleDragLeave = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const baseClasses = "relative flex flex-col items-center justify-center w-full h-64 rounded-xl border-2 border-dashed transition-all duration-300 cursor-pointer";
  const inactiveClasses = "border-gray-600 bg-gray-800 hover:bg-gray-700 hover:border-blue-500";
  const activeClasses = "border-blue-400 bg-blue-900/50 scale-105";

  return (
    <div className="w-full">
        <h3 className="text-lg font-semibold text-gray-300 mb-3 text-center">{title}</h3>
        <label
            htmlFor={`dropzone-file-${title.replace(/\s+/g, '-')}`}
            className={`${baseClasses} ${isDragging ? activeClasses : inactiveClasses}`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
        >
        {imageUrl ? (
            <img src={imageUrl} alt="Uploaded preview" className="object-cover w-full h-full rounded-xl" />
        ) : (
            <div className="flex flex-col items-center justify-center pt-5 pb-6 text-gray-400">
                <UploadIcon className="w-10 h-10 mb-3" />
                <p className="mb-2 text-sm font-semibold">클릭 또는 드래그하여 이미지 업로드</p>
                <p className="text-xs">PNG, JPG, WEBP</p>
            </div>
        )}
        <input id={`dropzone-file-${title.replace(/\s+/g, '-')}`} type="file" className="hidden" onChange={handleFileChange} accept="image/png, image/jpeg, image/webp" />
        </label>
    </div>
  );
};