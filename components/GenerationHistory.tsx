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

  // 🆕 비디오 썸네일 컴포넌트 - 404 에러 처리 포함
  const VideoThumbnail: React.FC<{ videoUrl: string; itemId: string }> = ({ videoUrl, itemId }) => {
    const [thumbnailError, setThumbnailError] = useState(false);
    const [videoLoaded, setVideoLoaded] = useState(false);
    
    const cleanedUrl = cleanKlingUrl(videoUrl);
    
    return (
      <div className="relative w-full h-full">
        {!thumbnailError && (
          <video
            src={cleanedUrl}
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
              console.warn(`❌ [썸네일] 비디오 로드 실패: ${itemId}`, {
                originalUrl: videoUrl.substring(0, 80) + '...',
                cleanedUrl: cleanedUrl.substring(0, 80) + '...'
              });
              setThumbnailError(true);
            }}
          />
        )}
        
        {/* 플레이 버튼 오버레이 */}
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
        
        {/* 썸네일 로드 실패시 안내 */}
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

  // 🆕 클링 URL 정리 함수 (쿼리스트링 제거)
  const cleanKlingUrl = (url: string): string => {
    if (!url || !url.includes('klingai.com')) return url;
    
    try {
      // ?x-kcdn-pid= 같은 쿼리스트링 제거
      const cleanUrl = url.split('?')[0];
      console.log('🧹 [내 작품] URL 정리:', {
        original: url.substring(0, 80) + '...',
        cleaned: cleanUrl.substring(0, 80) + '...',
        removed: url.length - cleanUrl.length + ' chars'
      });
      return cleanUrl;
    } catch (error) {
      console.error('URL 정리 실패:', error);
      return url;
    }
  };

  // 🆕 프록시를 통한 안전한 비디오 다운로드 (기존 클링 URL 처리)
  const downloadVideoViaProxy = async (originalUrl: string, filename: string): Promise<{ success: boolean; message?: string }> => {
    try {
      console.log('📹 [내 작품] 프록시 비디오 다운로드 시작:', {
        originalUrl: originalUrl.substring(0, 80) + '...',
        filename
      });

      // 1. 클링 URL 정리 (쿼리스트링 제거)
      const cleanUrl = cleanKlingUrl(originalUrl);
      
      // 2. 프록시 URL 인코딩
      const proxyUrl = `/.netlify/functions/video-download-proxy?url=${encodeURIComponent(cleanUrl)}`;
      
      console.log('🔗 [내 작품] 프록시 호출:', {
        proxyUrl: proxyUrl.substring(0, 100) + '...',
        method: 'GET with proxy'
      });

      // 3. 프록시를 통한 비디오 다운로드
      const response = await fetch(proxyUrl, {
        method: 'GET',
        headers: {
          'Accept': 'video/mp4,video/*,*/*'
        }
      });

      console.log('📊 [내 작품] 프록시 응답:', {
        status: response.status,
        ok: response.ok,
        contentType: response.headers.get('content-type'),
        contentLength: response.headers.get('content-length')
      });

      if (!response.ok) {
        // 프록시 실패시 정리된 URL로 직접 시도
        console.log('⚠️ [내 작품] 프록시 실패, 정리된 URL로 직접 시도');
        
        try {
          const directResponse = await fetch(cleanUrl);
          if (directResponse.ok) {
            const blob = await directResponse.blob();
            const blobUrl = URL.createObjectURL(blob);
            
            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
            
            return { 
              success: true, 
              message: '정리된 URL로 다운로드 성공' 
            };
          }
        } catch (directError) {
          console.error('직접 다운로드도 실패:', directError);
        }
        
        throw new Error(`프록시 응답 오류: ${response.status}`);
      }

      // 4. Blob 생성 및 다운로드
      const blob = await response.blob();
      
      if (blob.size === 0) {
        throw new Error('빈 파일 응답');
      }

      console.log('💾 [내 작품] Blob 생성 완료:', {
        size: (blob.size / 1024 / 1024).toFixed(2) + 'MB',
        type: blob.type
      });

      // 5. 플랫폼별 다운로드 처리
      const isWebView = /WebView|wv/i.test(navigator.userAgent);
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      
      if (isWebView) {
        // 웹뷰: URL을 클립보드에 복사
        try {
          await navigator.clipboard.writeText(cleanUrl);
          console.log('📋 [내 작품] 웹뷰 - URL 클립보드 복사 성공');
          return { 
            success: true, 
            message: 'URL이 클립보드에 복사되었습니다. Safari에서 붙여넣기하여 저장하세요.' 
          };
        } catch (clipError) {
          console.error('클립보드 복사 실패:', clipError);
          // 클립보드 실패시 alert로 URL 표시
          alert(`비디오 URL을 복사하세요:\n\n${cleanUrl}`);
          return { 
            success: true, 
            message: 'URL을 수동으로 복사하세요' 
          };
        }
      } else if (isIOS) {
        // iOS: 새 탭에서 비디오 열기
        window.open(cleanUrl, '_blank');
        return { 
          success: true, 
          message: '새 탭에서 비디오를 열었습니다. 길게 터치하여 저장하세요.' 
        };
      } else {
        // Android/PC: Blob 다운로드
        const blobUrl = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
        
        console.log('✅ [내 작품] Blob 다운로드 완료');
        return { 
          success: true, 
          message: '비디오 다운로드 완료!' 
        };
      }

    } catch (error) {
      console.error('❌ [내 작품] 프록시 비디오 다운로드 실패:', error);
      
      // 최종 fallback: 정리된 URL 제공
      const cleanUrl = cleanKlingUrl(originalUrl);
      console.log('🔄 [내 작품] 최종 fallback - 정리된 URL:', cleanUrl);
      
      return { 
        success: false, 
        message: `다운로드 실패. 수동 접근 URL: ${cleanUrl}` 
      };
    }
  };

  const handleDownload = async (item: GenerationResult) => {
    const itemId = item._id || `${item.userId}-${item.createdAt}`;
    
    if (downloadingIds.has(itemId)) {
      return; // 이미 다운로드 중
    }

    try {
      setDownloadingIds(prev => new Set(prev).add(itemId));
      setDownloadStatuses(prev => new Map(prev).set(itemId, '다운로드 중...'));

      if (item.type === 'image') {
        console.log('🖼️ [내 작품] 이미지 다운로드 시작:', item.resultUrl);
        
        // 파일명 생성
        const timestamp = new Date(item.createdAt).toISOString().slice(0, 10);
        const filename = `faceswap-${timestamp}-${itemId.slice(-6)}.jpg`;
        
        // downloadHelper를 사용하여 이미지 다운로드
        const result = await downloadHelper.downloadImage(item.resultUrl, filename);
        
        if (result.success) {
          setDownloadStatuses(prev => new Map(prev).set(itemId, '✅ 저장 완료!'));
          
          // iOS에서 추가 안내가 필요한 경우
          if (result.method === 'new-window' && downloadHelper.isIOS()) {
            setTimeout(() => {
              setDownloadStatuses(prev => new Map(prev).set(itemId, '💡 이미지를 길게 터치하여 저장하세요'));
            }, 2000);
          }
        } else {
          setDownloadStatuses(prev => new Map(prev).set(itemId, `❌ 다운로드 실패: ${result.message || 'Unknown error'}`));
        }
        
      } else if (item.type === 'video') {
        console.log('🎥 [내 작품] 비디오 다운로드 시작:', item.resultUrl.substring(0, 80) + '...');
        
        // 파일명 생성
        const timestamp = new Date(item.createdAt).toISOString().slice(0, 10);
        const filename = `hairgator-video-${timestamp}-${itemId.slice(-6)}.mp4`;
        
        // 🆕 클링 URL인지 확인하고 프록시 사용
        if (item.resultUrl.includes('klingai.com')) {
          console.log('🔍 [내 작품] 클링 비디오 감지 - 프록시 사용');
          const result = await downloadVideoViaProxy(item.resultUrl, filename);
          
          if (result.success) {
            setDownloadStatuses(prev => new Map(prev).set(itemId, '✅ 저장 완료!'));
            
            // 추가 안내가 필요한 경우
            if (result.message && result.message.includes('길게 터치')) {
              setTimeout(() => {
                setDownloadStatuses(prev => new Map(prev).set(itemId, '💡 비디오를 길게 터치하여 저장하세요'));
              }, 2000);
            }
          } else {
            setDownloadStatuses(prev => new Map(prev).set(itemId, `❌ ${result.message || '다운로드 실패'}`));
          }
        } else {
          // 클링이 아닌 다른 비디오는 기존 방식 사용
          const result = await downloadHelper.downloadVideo(item.resultUrl, filename);
          
          if (result.success) {
            setDownloadStatuses(prev => new Map(prev).set(itemId, '✅ 저장 완료!'));
            
            // iOS에서 추가 안내가 필요한 경우
            if (result.method === 'new-window-video' && downloadHelper.isIOS()) {
              setTimeout(() => {
                setDownloadStatuses(prev => new Map(prev).set(itemId, '💡 비디오를 길게 터치하여 저장하세요'));
              }, 2000);
            }
          } else {
            setDownloadStatuses(prev => new Map(prev).set(itemId, `❌ 다운로드 실패: ${result.message || 'Unknown error'}`));
          }
        }
      }
      
    } catch (error) {
      console.error('❌ [내 작품] 다운로드 중 오류:', error);
      setDownloadStatuses(prev => new Map(prev).set(itemId, '❌ 다운로드 오류'));
    } finally {
      setDownloadingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(itemId);
        return newSet;
      });
      
      // 5초 후 상태 메시지 클리어
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
              {history.map((item) => {
                const itemId = item._id || `${item.userId}-${item.createdAt}`;
                const isDownloading = downloadingIds.has(itemId);
                const downloadStatus = downloadStatuses.get(itemId);
                
                return (
                  <div
                    key={itemId}
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
                            src={cleanKlingUrl(item.resultUrl)} // 🆕 비디오 썸네일에도 정리된 URL 사용
                            className="w-full h-full object-cover"
                            muted
                            loop
                            onMouseEnter={(e) => {
                              try {
                                (e.target as HTMLVideoElement).play();
                              } catch (err) {
                                console.warn('Video preview play failed:', err);
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
                              console.warn('Video thumbnail load failed:', item.resultUrl);
                              // 비디오 로드 실패시 플레이 버튼만 표시
                            }}
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
                      
                      {/* Download button with status */}
                      <button
                        onClick={() => handleDownload(item)}
                        disabled={isDownloading}
                        className={`absolute top-2 right-2 p-2 backdrop-blur-sm rounded-full text-white transition-colors ${
                          isDownloading
                            ? 'bg-blue-500/80 cursor-wait'
                            : downloadStatus?.includes('✅')
                              ? 'bg-green-500/80'
                              : downloadStatus?.includes('❌')
                                ? 'bg-red-500/80'
                                : 'bg-black/50 hover:bg-black/70'
                        }`}
                        title={downloadStatus || "다운로드"}
                      >
                        {isDownloading ? (
                          <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                        ) : downloadStatus?.includes('✅') ? (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
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
                              : downloadStatus.includes('💡')
                                ? 'bg-yellow-600/90 text-yellow-100'
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
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-700 bg-gray-800/50">
          <p className="text-xs text-gray-500 text-center">
            생성된 작품은 3일 후 자동으로 삭제됩니다. 필요한 작품은 다운로드해서 보관하세요.
          </p>
          
          {/* 환경별 다운로드 가이드 */}
          <div className="mt-2 text-xs text-gray-400 text-center">
            {downloadHelper.isIOS() ? (
              <span>📱 iOS: 다운로드 → 이미지/비디오 길게 터치 → 저장</span>
            ) : downloadHelper.isAndroid() ? (
              <span>🤖 Android: 다운로드 → 갤러리에서 확인</span>
            ) : (
              <span>💻 PC: 다운로드 → 다운로드 폴더에서 확인</span>
            )}
          </div>
          
          {/* 개선된 다운로드 시스템 안내 */}
          <div className="mt-2 p-2 bg-blue-600/20 rounded-lg">
            <p className="text-xs text-blue-300 text-center">
              🎬 영상은 프록시를 통해 안전하게 다운로드됩니다
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
