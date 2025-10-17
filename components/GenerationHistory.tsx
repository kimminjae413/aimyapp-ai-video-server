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
  const [downloadingIds, setDownloadingIds] = useState<Set<string>>(new Set());
  const [downloadStatuses, setDownloadStatuses] = useState<Map<string, string>>(new Map());

  // ✅ URL 유효성 검사 함수
  const isValidImageUrl = (url: string): boolean => {
    if (!url) return false;
    if (url.startsWith('blob:')) return false;
    if (url.includes('...[truncated]')) return false;
    return url.startsWith('http://') || url.startsWith('https://');
  };

  const isValidVideoUrl = (url: string): boolean => {
    if (!url) return false;
    if (url.startsWith('blob:')) return false;
    return url.startsWith('http://') || url.startsWith('https://');
  };

  // 🎯 Gemini Video URL 감지
  const isGeminiVideoUrl = (url: string): boolean => {
    return url.includes('generativelanguage.googleapis.com');
  };

  // 🎬 비디오 썸네일 컴포넌트 - 개선 버전!
  const VideoThumbnail: React.FC<{ 
    videoUrl: string; 
    thumbnailUrl?: string;
    itemId: string;
  }> = ({ videoUrl, thumbnailUrl, itemId }) => {
    const isGemini = isGeminiVideoUrl(videoUrl);
    
    // ✅ 1순위: DB에 저장된 썸네일 사용
    if (thumbnailUrl) {
      return (
        <div className="relative w-full h-full">
          <img
            src={thumbnailUrl}
            alt="Video thumbnail"
            className="w-full h-full object-cover"
            onError={(e) => {
              console.warn(`❌ [썸네일] 이미지 로드 실패: ${itemId}`);
              // 썸네일 로드 실패 시 플레이스홀더로 대체
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
            }}
          />
          
          {/* 재생 아이콘 오버레이 */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-16 h-16 rounded-full bg-black/50 hover:bg-black/70 transition-all flex items-center justify-center backdrop-blur-sm">
              <svg className="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z"/>
              </svg>
            </div>
          </div>
          
          {/* 비디오 배지 */}
          <div className="absolute top-2 left-2 px-2 py-1 bg-purple-600/80 backdrop-blur-sm rounded-full">
            <span className="text-xs text-white font-medium">🎬 영상</span>
          </div>
        </div>
      );
    }
    
    // ✅ 2순위: Gemini Video는 플레이스홀더 표시
    if (isGemini) {
      return (
        <div className="relative w-full h-full bg-gradient-to-br from-purple-900/50 to-blue-900/50">
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center mb-3">
              <svg className="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z"/>
              </svg>
            </div>
            <p className="text-white text-sm font-medium">Hairgator Video</p>
            <p className="text-white/60 text-xs mt-1">다운로드하여 재생</p>
          </div>
          
          {/* 애니메이션 효과 */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-shimmer"></div>
        </div>
      );
    }
    
    // ✅ 3순위: 일반 비디오 (Cloudinary 등) - 직접 재생 가능
    const [thumbnailError, setThumbnailError] = useState(false);
    const [videoLoaded, setVideoLoaded] = useState(false);
    
    return (
      <div className="relative w-full h-full">
        {!thumbnailError && (
          <video
            src={videoUrl}
            className="w-full h-full object-cover"
            muted
            loop
            playsInline
            onLoadedData={() => {
              setVideoLoaded(true);
              console.log(`✅ [썸네일] 비디오 로드 성공: ${itemId}`);
            }}
            onMouseEnter={(e) => {
              if (videoLoaded) {
                try {
                  (e.target as HTMLVideoElement).play();
                } catch (err) {
                  console.warn('Video preview play failed:', err);
                }
              }
            }}
            onMouseLeave={(e) => {
              try {
                (e.target as HTMLVideoElement).pause();
              } catch (err) {
                console.warn('Video preview pause failed:', err);
              }
            }}
            onError={(e) => {
              console.warn(`❌ [썸네일] 비디오 로드 실패: ${itemId}`);
              setThumbnailError(true);
            }}
          />
        )}
        
        <div className="absolute inset-0 flex items-center justify-center">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200 ${
            thumbnailError 
              ? 'bg-gray-600/80' 
              : videoLoaded 
                ? 'bg-black/30 hover:bg-black/60' 
                : 'bg-black/50'
          }`}>
            {thumbnailError ? (
              <svg className="w-6 h-6 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            ) : (
              <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z"/>
              </svg>
            )}
          </div>
        </div>
        
        {thumbnailError && (
          <div className="absolute bottom-1 left-1 right-1">
            <div className="bg-gray-800/80 text-white text-xs px-2 py-1 rounded text-center">
              영상 미리보기 불가
            </div>
          </div>
        )}
      </div>
    );
  };

  useEffect(() => {
    if (isOpen && userId) {
      loadHistory();
    }
  }, [isOpen, userId]);

  const loadHistory = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      await cleanupExpiredGenerations(userId);
      const results = await getGenerationHistory(userId, 50);
      
      // 콘솔에 썸네일 정보 출력
      console.log('📊 작품 내역 로드:', {
        total: results.length,
        withThumbnails: results.filter(r => r.type === 'video' && r.thumbnailUrl).length,
        videos: results.filter(r => r.type === 'video').length
      });
      
      setHistory(results);
    } catch (err) {
      setError('내역을 불러오는데 실패했습니다.');
      console.error('Failed to load history:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // 🔥 Gemini Video 전용 프록시 다운로드
  const downloadVideoViaProxy = async (originalUrl: string, filename: string): Promise<{ success: boolean; message?: string }> => {
    try {
      const proxyUrl = `/.netlify/functions/video-download-proxy?url=${encodeURIComponent(originalUrl)}`;
      
      console.log('📥 Gemini 비디오 다운로드 시작:', {
        urlPreview: originalUrl.substring(0, 80) + '...'
      });
      
      const response = await fetch(proxyUrl, {
        method: 'GET',
        headers: { 'Accept': 'video/mp4,video/*,*/*' }
      });

      if (!response.ok) {
        throw new Error(`프록시 응답 오류: ${response.status}`);
      }

      const blob = await response.blob();
      
      if (blob.size === 0) {
        throw new Error('빈 파일 응답');
      }

      console.log('✅ 비디오 다운로드 완료:', {
        size: blob.size,
        sizeMB: (blob.size / 1024 / 1024).toFixed(2) + ' MB'
      });

      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      
      // iOS Share API 시도
      if (isIOS && 'share' in navigator) {
        const file = new File([blob], filename, { type: 'video/mp4' });
        
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file] });
          return { success: true, message: '✅ Share API로 저장 완료!' };
        }
      }
      
      // 일반 다운로드
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      link.target = '_blank';
      link.rel = 'noopener';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
      
      return { 
        success: true, 
        message: isIOS ? '📱 파일 앱 또는 다운로드 폴더 확인' : '🎉 비디오 다운로드 완료!' 
      };

    } catch (error) {
      console.error('❌ 프록시 비디오 다운로드 실패:', error);
      return { 
        success: false, 
        message: '다운로드 실패' 
      };
    }
  };

  const handleDownload = async (item: GenerationResult) => {
    const baseId = item._id?.toString() || `${item.type}-${item.userId}-${Date.parse(item.createdAt)}`;
    const itemIndex = history.findIndex(h => h === item);
    const itemId = `${baseId}-idx${itemIndex}`;
    
    if (downloadingIds.has(itemId)) {
      return;
    }

    try {
      setDownloadingIds(prev => new Set(prev).add(itemId));
      setDownloadStatuses(prev => new Map(prev).set(itemId, '다운로드 중...'));

      if (item.type === 'image') {
        const timestamp = new Date(item.createdAt).toISOString().slice(0, 10);
        const filename = `faceswap-${timestamp}-${itemId.slice(-6)}.jpg`;
        
        const result = await downloadHelper.downloadImage(item.resultUrl, filename);
        
        if (result.success) {
          setDownloadStatuses(prev => new Map(prev).set(itemId, '✅ 저장 완료!'));
        } else {
          setDownloadStatuses(prev => new Map(prev).set(itemId, `❌ ${result.message || '다운로드 실패'}`));
        }
        
      } else if (item.type === 'video') {
        const timestamp = new Date(item.createdAt).toISOString().slice(0, 10);
        const filename = `hairgator-video-${timestamp}-${itemId.slice(-6)}.mp4`;
        
        // 🔑 Gemini Video는 무조건 프록시 사용
        if (isGeminiVideoUrl(item.resultUrl)) {
          const result = await downloadVideoViaProxy(item.resultUrl, filename);
          
          if (result.success) {
            setDownloadStatuses(prev => new Map(prev).set(itemId, '✅ 저장 완료!'));
          } else {
            setDownloadStatuses(prev => new Map(prev).set(itemId, `❌ ${result.message || '다운로드 실패'}`));
          }
        } else {
          // Cloudinary 등 일반 URL은 직접 다운로드
          const result = await downloadHelper.downloadVideo(item.resultUrl, filename);
          
          if (result.success) {
            setDownloadStatuses(prev => new Map(prev).set(itemId, '✅ 저장 완료!'));
          } else {
            setDownloadStatuses(prev => new Map(prev).set(itemId, `❌ ${result.message || '다운로드 실패'}`));
          }
        }
      }
      
    } catch (error) {
      console.error('❌ 다운로드 중 오류:', error);
      setDownloadStatuses(prev => new Map(prev).set(itemId, '❌ 다운로드 오류'));
    } finally {
      setDownloadingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(itemId);
        return newSet;
      });
      
      setTimeout(() => {
        setDownloadStatuses(prev => {
          const newMap = new Map(prev);
          newMap.delete(itemId);
          return newMap;
        });
      }, 5000);
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
              {history.map((item, index) => {
                const baseId = item._id?.toString() || `${item.type}-${item.userId}-${Date.parse(item.createdAt)}`;
                const itemId = `${baseId}-idx${index}`;
                const isDownloading = downloadingIds.has(itemId);
                const downloadStatus = downloadStatuses.get(itemId);
                
                // ✅ URL 유효성 검사
                const hasValidImageUrl = item.type === 'image' && isValidImageUrl(item.resultUrl);
                const hasValidVideoUrl = item.type === 'video' && isValidVideoUrl(item.resultUrl);
                const isExpired = !hasValidImageUrl && !hasValidVideoUrl;
                
                return (
                  <div
                    key={itemId}
                    className="bg-gray-700/50 border border-gray-600 rounded-xl overflow-hidden hover:border-gray-500 transition-colors"
                  >
                    {/* Thumbnail */}
                    <div className="relative aspect-square bg-gray-800">
                      {item.type === 'image' ? (
                        hasValidImageUrl ? (
                          <img
                            src={item.resultUrl}
                            alt="Generated result"
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              console.warn('Image load failed:', item.resultUrl);
                              const target = e.target as HTMLImageElement;
                              target.style.display = 'none';
                              const parent = target.parentElement;
                              if (parent) {
                                parent.innerHTML = `
                                  <div class="w-full h-full bg-gray-700 flex flex-col items-center justify-center">
                                    <svg class="w-12 h-12 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                                        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                    <p class="text-xs text-gray-400 text-center px-2">이미지 로드 실패</p>
                                  </div>
                                `;
                              }
                            }}
                          />
                        ) : (
                          <div className="w-full h-full bg-gray-700 flex flex-col items-center justify-center">
                            <svg className="w-12 h-12 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <p className="text-xs text-gray-400 text-center px-2">이미지 URL 만료됨</p>
                            <p className="text-xs text-gray-500 text-center px-2 mt-1">{formatDate(item.createdAt)}</p>
                          </div>
                        )
                      ) : hasValidVideoUrl ? (
                        <VideoThumbnail 
                          videoUrl={item.resultUrl}
                          thumbnailUrl={item.thumbnailUrl}
                          itemId={itemId}
                        />
                      ) : (
                        <div className="w-full h-full bg-gray-700 flex flex-col items-center justify-center">
                          <svg className="w-12 h-12 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                              d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                          <p className="text-xs text-gray-400 text-center px-2">영상 URL 만료됨</p>
                          <p className="text-xs text-gray-500 text-center px-2 mt-1">{formatDate(item.createdAt)}</p>
                        </div>
                      )}
                      
                      {/* Download button */}
                      <button
                        onClick={() => handleDownload(item)}
                        disabled={isDownloading || isExpired}
                        className={`absolute top-2 right-2 p-2 backdrop-blur-sm rounded-full text-white transition-colors ${
                          isExpired
                            ? 'bg-gray-600/80 cursor-not-allowed'
                            : isDownloading
                              ? 'bg-blue-500/80 cursor-wait'
                              : downloadStatus?.includes('✅')
                                ? 'bg-green-500/80'
                                : downloadStatus?.includes('❌')
                                  ? 'bg-red-500/80'
                                  : 'bg-black/50 hover:bg-black/70'
                        }`}
                        title={isExpired ? "URL 만료로 다운로드 불가" : downloadStatus || "다운로드"}
                      >
                        {isDownloading ? (
                          <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                        ) : downloadStatus?.includes('✅') ? (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        ) : isExpired ? (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636" />
                          </svg>
                        ) : (
                          <DownloadIcon className="w-4 h-4" />
                        )}
                      </button>
                      
                      {/* Download status overlay */}
                      {downloadStatus && (
                        <div className={`absolute bottom-2 left-2 right-2 px-2 py-1 rounded text-xs text-center font-medium backdrop-blur-sm ${
                          downloadStatus.includes('✅')
                            ? 'bg-green-600/90 text-green-100'
                            : downloadStatus.includes('❌')
                              ? 'bg-red-600/90 text-red-100'
                              : 'bg-blue-600/90 text-blue-100'
                        }`}>
                          {downloadStatus}
                        </div>
                      )}
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
                      
                      {/* ✅ Duration 표시 - Veo 2: 5초/8초 */}
                      {item.type === 'video' && item.videoDuration && (
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-xs px-2 py-0.5 bg-cyan-500/20 text-cyan-300 rounded">
                            ⏱️ {item.videoDuration}초
                          </span>
                          <span className="text-xs px-2 py-0.5 bg-yellow-500/20 text-yellow-300 rounded">
                            💎 {item.creditsUsed || item.videoDuration}회
                          </span>
                        </div>
                      )}
                      
                      {item.type === 'image' && (
                        <p className="text-xs text-gray-500 mt-2">
                          💎 {item.creditsUsed}회 차감
                        </p>
                      )}
                      
                      {/* URL 상태 표시 */}
                      {isExpired && (
                        <p className="text-xs text-red-400 mt-2">
                          ⚠️ URL 만료됨 (3일 경과)
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer - ✅ Veo 2 정보로 수정 */}
        <div className="p-4 border-t border-gray-700 bg-gray-800/50">
          <p className="text-xs text-gray-500 text-center">
            생성된 작품은 3일 후 자동으로 삭제됩니다. 필요한 작품은 다운로드해서 보관하세요.
          </p>
          
          <div className="mt-2 text-xs text-gray-400 text-center">
            {downloadHelper.isIOS() ? (
              <span>📱 iOS: 다운로드 → 파일 앱 확인 또는 길게 터치 저장</span>
            ) : downloadHelper.isAndroid() ? (
              <span>🤖 Android: 다운로드 → 갤러리에서 확인</span>
            ) : (
              <span>💻 PC: 다운로드 → 다운로드 폴더에서 확인</span>
            )}
          </div>
          
          {/* ✅ Veo 2 정보로 수정 */}
          <div className="mt-2 p-2 bg-cyan-600/20 border border-cyan-500/50 rounded-lg">
            <p className="text-xs text-cyan-300 text-center">
              ✅ Veo 2: 영상 길이 5초/8초 선택 가능 | 크레딧 = Duration
            </p>
          </div>
        </div>
      </div>
      
      {/* CSS for shimmer animation */}
      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .animate-shimmer {
          animation: shimmer 2s infinite;
        }
      `}</style>
    </div>
  );
};
