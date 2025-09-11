import React, { useState, useEffect } from 'react';
import { XIcon } from './icons/XIcon';
import { DownloadIcon } from './icons/DownloadIcon';
import { downloadHelper } from '../utils/downloadHelper';
import { getGenerationHistory, cleanupExpiredGenerations } from '../services/bullnabiService';
import type { GenerationResult } from '../types';

interface GenerationHistoryProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
}

export const GenerationHistory: React.FC<GenerationHistoryProps> = ({ 
  isOpen, 
  onClose, 
  userId 
}) => {
  const [history, setHistory] = useState<GenerationResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && userId) {
      loadHistory();
    }
  }, [isOpen, userId]);

  const loadHistory = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // 만료된 데이터 정리 먼저 실행
      await cleanupExpiredGenerations(userId);
      
      // 최근 3일간의 내역 조회
      const results = await getGenerationHistory(userId, 50); // 최대 50개
      setHistory(results);
    } catch (err) {
      setError('내역을 불러오는데 실패했습니다.');
      console.error('Failed to load history:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = async (item: GenerationResult) => {
    try {
      if (item.type === 'image') {
        await downloadHelper.downloadImage(
          item.resultUrl, 
          `faceswap-${item.createdAt.slice(0, 10)}.jpg`
        );
      } else {
        await downloadHelper.downloadVideo(
          item.resultUrl, 
          `video-${item.createdAt.slice(0, 10)}.mp4`
        );
      }
    } catch (error) {
      console.error('Download failed:', error);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return '오늘';
    if (diffDays === 1) return '어제';
    if (diffDays === 2) return '2일 전';
    return `${diffDays}일 전`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 border border-gray-600 rounded-xl w-full max-w-4xl h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <h2 className="text-xl font-bold text-white">내 작품 보기</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
          >
            <XIcon className="w-6 h-6 text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="w-8 h-8 border-4 border-blue-400 border-dashed rounded-full animate-spin"></div>
              <span className="ml-3 text-gray-400">내역을 불러오는 중...</span>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <p className="text-red-400 mb-2">{error}</p>
                <button
                  onClick={loadHistory}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  다시 시도
                </button>
              </div>
            </div>
          ) : history.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center text-gray-500">
                <p className="text-lg mb-2">아직 생성한 작품이 없습니다</p>
                <p className="text-sm">얼굴 변환이나 영상 변환을 해보세요!</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {history.map((item) => (
                <div
                  key={item._id}
                  className="bg-gray-700/50 border border-gray-600 rounded-xl overflow-hidden hover:border-gray-500 transition-colors"
                >
                  {/* Thumbnail */}
                  <div className="relative aspect-square bg-gray-800">
                    {item.type === 'image' ? (
                      <img
                        src={item.resultUrl}
                        alt="Generated result"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.src = item.originalImageUrl; // 결과 이미지 로드 실패 시 원본 표시
                        }}
                      />
                    ) : (
                      <div className="relative w-full h-full">
                        <video
                          src={item.resultUrl}
                          className="w-full h-full object-cover"
                          muted
                          loop
                          onMouseEnter={(e) => (e.target as HTMLVideoElement).play()}
                          onMouseLeave={(e) => (e.target as HTMLVideoElement).pause()}
                        />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="w-12 h-12 bg-black/50 rounded-full flex items-center justify-center">
                            <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M8 5v14l11-7z"/>
                            </svg>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {/* Download button */}
                    <button
                      onClick={() => handleDownload(item)}
                      className="absolute top-2 right-2 p-2 bg-black/50 backdrop-blur-sm rounded-full text-white hover:bg-black/70 transition-colors"
                      title="다운로드"
                    >
                      <DownloadIcon className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Info */}
                  <div className="p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                        item.type === 'image' 
                          ? 'bg-pink-500/20 text-pink-300' 
                          : 'bg-blue-500/20 text-blue-300'
                      }`}>
                        {item.type === 'image' ? '얼굴변환' : '영상변환'}
                      </span>
                      <span className="text-xs text-gray-400">
                        {formatDate(item.createdAt)}
                      </span>
                    </div>
                    
                    {item.facePrompt && (
                      <p className="text-xs text-gray-400 mb-1 truncate">
                        {item.facePrompt.length > 30 
                          ? `${item.facePrompt.slice(0, 30)}...` 
                          : item.facePrompt
                        }
                      </p>
                    )}
                    
                    {item.type === 'video' && item.videoDuration && (
                      <p className="text-xs text-gray-500">
                        {item.videoDuration}초 영상 • {item.creditsUsed}회 차감
                      </p>
                    )}
                    
                    {item.type === 'image' && (
                      <p className="text-xs text-gray-500">
                        {item.creditsUsed}회 차감
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-700 bg-gray-800/50">
          <p className="text-xs text-gray-500 text-center">
            생성된 작품은 3일 후 자동으로 삭제됩니다. 필요한 작품은 다운로드해서 보관하세요.
          </p>
        </div>
      </div>
    </div>
  );
};
