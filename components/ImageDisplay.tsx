import React, { useState } from 'react';
import { ImageIcon } from './icons/ImageIcon';
import { DownloadIcon } from './icons/DownloadIcon';
import { downloadHelper } from '../utils/downloadHelper';

interface ImageDisplayProps {
  originalImage: string | undefined | null;
  generatedImage: string | undefined | null;
}

export const ImageDisplay: React.FC<ImageDisplayProps> = ({ originalImage, generatedImage }) => {
    const [isDownloading, setIsDownloading] = useState(false);
    const [downloadStatus, setDownloadStatus] = useState<string | null>(null);
    const [imageSaved, setImageSaved] = useState(false);
    
    const handleDownload = async () => {
        if (!generatedImage || isDownloading) return;
        
        setIsDownloading(true);
        setDownloadStatus('다운로드 중...');
        
        try {
            // 파일명 생성
            const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '');
            const filename = `faceswap-${timestamp}.jpg`;
            
            // 개선된 downloadHelper 사용
            const result = await downloadHelper.downloadImage(generatedImage, filename);
            
            if (result.success) {
                setDownloadStatus(`✅ ${result.method}로 다운로드 시도됨`);
                
                // iOS에서 수동 저장이 필요한 경우 가이드 표시
                if (result.method === 'new-window' || result.method === 'blob-download') {
                    setTimeout(() => {
                        downloadHelper.showDownloadGuide(
                            'image',
                            () => {
                                setImageSaved(true);
                                setDownloadStatus('저장 완료! ✅');
                            },
                            () => {
                                // 다시 시도
                                handleDownload();
                            }
                        );
                    }, downloadHelper.isIOS() ? 2000 : 500);
                } else {
                    // Share API나 자동 다운로드 성공
                    setImageSaved(true);
                    setDownloadStatus('저장 완료! ✅');
                }
            } else {
                setDownloadStatus(`❌ 다운로드 실패: ${result.message || '알 수 없는 오류'}`);
                
                // 실패 시 3초 후 재시도 옵션 제공
                setTimeout(() => {
                    setDownloadStatus('다시 시도하려면 다운로드 버튼을 눌러주세요');
                }, 3000);
            }
            
        } catch (error) {
            console.error('Download error:', error);
            setDownloadStatus('❌ 다운로드 중 오류가 발생했습니다');
        } finally {
            setIsDownloading(false);
            
            // 5초 후 상태 메시지 자동 클리어
            setTimeout(() => {
                if (!imageSaved) {
                    setDownloadStatus(null);
                }
            }, 5000);
        }
    };

    if (!originalImage && !generatedImage) {
        return (
             <div className="w-full h-full bg-gray-800/50 border border-gray-700 rounded-xl flex flex-col items-center justify-center p-8 text-center text-gray-500">
                <ImageIcon className="w-24 h-24" />
                <h2 className="mt-6 text-2xl pink-bold-title">AI 얼굴 변환</h2>
                <p className="mt-2 max-w-md">좌측에 이미지를 업로드하고 원하는 스타일을 선택한 후, 변환 버튼을 눌러주세요.</p>
            </div>
        );
    }

  return (
    <>
      <div className="w-full h-full grid grid-cols-1 md:grid-cols-2 gap-6 p-6 bg-gray-800/50 border border-gray-700 rounded-xl">
          {/* Original Image Card */}
          <div className="w-full flex flex-col items-center">
              <h3 className="text-lg font-semibold text-gray-300 mb-3">원본</h3>
              <div className="relative w-full aspect-square bg-gray-800 rounded-xl border border-gray-700 flex items-center justify-center overflow-hidden">
                  {originalImage ? (
                      <img src={originalImage} alt="원본" className="object-contain w-full h-full" />
                  ) : (
                      <div className="text-center text-gray-500 p-4">
                          <ImageIcon className="w-12 h-12 mx-auto" />
                          <p className="mt-2 text-sm">이미지를 업로드 해주세요</p>
                      </div>
                  )}
              </div>
          </div>

          {/* Generated Image Card */}
          <div className="w-full flex flex-col items-center">
              <h3 className="text-lg font-semibold text-gray-300 mb-3">결과</h3>
              <div className="relative w-full aspect-square bg-gray-800 rounded-xl border border-gray-700 flex items-center justify-center overflow-hidden">
                  {generatedImage ? (
                      <>
                          <img src={generatedImage} alt="Generated Result" className="object-contain w-full h-full" />
                          
                          {/* 다운로드 버튼 */}
                          <button
                              onClick={handleDownload}
                              disabled={isDownloading}
                              className={`absolute top-3 right-3 p-3 backdrop-blur-sm rounded-full text-white transition-all duration-300 group ${
                                  imageSaved 
                                      ? 'bg-green-600/80 hover:bg-green-700' 
                                      : isDownloading
                                          ? 'bg-blue-600/80 animate-pulse cursor-wait'
                                          : 'bg-gray-900/70 hover:bg-blue-600 hover:scale-110'
                              }`}
                              aria-label={imageSaved ? '저장 완료' : '이미지 다운로드'}
                              title={imageSaved ? '저장 완료' : '이미지 다운로드'}
                          >
                              {isDownloading ? (
                                  <svg className="w-6 h-6 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                  </svg>
                              ) : imageSaved ? (
                                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                  </svg>
                              ) : (
                                  <DownloadIcon className="w-6 h-6" />
                              )}
                          </button>
                          
                          {/* 다운로드 상태 표시 */}
                          {downloadStatus && (
                              <div className={`absolute bottom-3 left-3 right-3 p-3 rounded-lg backdrop-blur-sm border transition-all duration-300 ${
                                  downloadStatus.includes('✅') 
                                      ? 'bg-green-600/80 border-green-400 text-green-100' 
                                      : downloadStatus.includes('❌')
                                          ? 'bg-red-600/80 border-red-400 text-red-100'
                                          : 'bg-blue-600/80 border-blue-400 text-blue-100'
                              }`}>
                                  <p className="text-sm text-center font-medium">{downloadStatus}</p>
                              </div>
                          )}
                          
                          {/* iOS 전용 저장 알림 */}
                          {downloadHelper.isIOS() && !imageSaved && generatedImage && (
                              <div className="absolute top-12 left-3 right-3 p-2 bg-yellow-600/80 border border-yellow-400 rounded-lg backdrop-blur-sm">
                                  <p className="text-xs text-center text-yellow-100">
                                      📱 iOS: 다운로드 후 새 창에서 이미지를 길게 터치하여 저장하세요
                                  </p>
                              </div>
                          )}
                      </>
                  ) : (
                      <div className="text-center text-gray-500 p-4">
                          <ImageIcon className="w-12 h-12 mx-auto" />
                          <p className="mt-2 text-sm">얼굴 변환 대기 중</p>
                      </div>
                  )}
              </div>
          </div>
      </div>
      
      {/* 디바이스별 사용 팁 */}
      {generatedImage && (
          <div className="mt-4 p-4 bg-gray-800/30 border border-gray-600 rounded-lg">
              <div className="flex items-start gap-3">
                  <div className="text-2xl">💡</div>
                  <div className="flex-1">
                      <h4 className="text-sm font-semibold text-gray-300 mb-2">저장 가이드</h4>
                      {downloadHelper.isIOS() ? (
                          <div className="space-y-1 text-xs text-gray-400">
                              <p>• 다운로드 버튼 클릭 → 새 창에서 이미지 표시</p>
                              <p>• 이미지를 <strong className="text-white">길게 터치</strong> → "이미지 저장" 선택</p>
                              <p>• 사진 앱에서 확인 가능합니다</p>
                          </div>
                      ) : downloadHelper.isAndroid() ? (
                          <div className="space-y-1 text-xs text-gray-400">
                              <p>• 다운로드 버튼 클릭 → 자동으로 다운로드</p>
                              <p>• 갤러리 또는 다운로드 폴더에서 확인 가능</p>
                          </div>
                      ) : (
                          <div className="space-y-1 text-xs text-gray-400">
                              <p>• 다운로드 버튼 클릭 → 파일 자동 저장</p>
                              <p>• 브라우저 다운로드 폴더에서 확인 가능</p>
                          </div>
                      )}
                  </div>
              </div>
          </div>
      )}
    </>
  );
};
