// utils/downloadHelper.ts - 개선된 버전

interface DownloadResult {
  success: boolean;
  method: string;
  message?: string;
}

export const downloadHelper = {
  // 디바이스 감지
  isIOS: () => /iPad|iPhone|iPod/.test(navigator.userAgent),
  isAndroid: () => /Android/i.test(navigator.userAgent),
  
  // iOS 버전 감지
  getIOSVersion: () => {
    const match = navigator.userAgent.match(/OS (\d+)_/);
    return match ? parseInt(match[1], 10) : 0;
  },
  
  // Share API 지원 확인
  supportsShareAPI: () => {
    return 'share' in navigator && 'canShare' in navigator;
  },
  
  // Canvas를 이용한 이미지 다운로드 (iOS 14+)
  downloadImageViaCanvas: async (imageUrl: string, filename: string): Promise<DownloadResult> => {
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = imageUrl;
      });
      
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas context not available');
      
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      
      // Blob으로 변환
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Canvas to blob conversion failed'));
        }, 'image/jpeg', 0.95);
      });
      
      // Share API 시도
      if (downloadHelper.supportsShareAPI()) {
        const file = new File([blob], filename, { type: 'image/jpeg' });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file] });
          return { success: true, method: 'share-api' };
        }
      }
      
      // Blob 다운로드 시도
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
      
      return { success: true, method: 'blob-download' };
      
    } catch (error) {
      console.error('Canvas download failed:', error);
      return { success: false, method: 'canvas', message: error instanceof Error ? error.message : 'Unknown error' };
    }
  },
  
  // 새 창에서 이미지 열기 (가이드 포함)
  openImageInNewWindow: (imageUrl: string, filename: string): DownloadResult => {
    try {
      const newWindow = window.open('', '_blank');
      if (!newWindow) {
        throw new Error('Popup blocked');
      }
      
      newWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>${filename}</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
              body {
                margin: 0;
                padding: 20px;
                background: #000;
                color: white;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                text-align: center;
              }
              img {
                max-width: 100%;
                height: auto;
                margin: 20px 0;
                border: 2px solid #333;
                border-radius: 8px;
              }
              .guide {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                padding: 20px;
                border-radius: 12px;
                margin-bottom: 20px;
                box-shadow: 0 4px 20px rgba(0,0,0,0.3);
              }
              .step {
                margin: 12px 0;
                padding: 12px;
                background: rgba(255,255,255,0.1);
                border-radius: 8px;
                backdrop-filter: blur(10px);
              }
              .highlight {
                color: #4FC3F7;
                font-weight: bold;
                text-shadow: 0 1px 2px rgba(0,0,0,0.5);
              }
              .emoji {
                font-size: 1.2em;
                margin-right: 8px;
              }
            </style>
          </head>
          <body>
            <div class="guide">
              <h2><span class="emoji">📱</span>이미지 저장 방법</h2>
              <div class="step">
                <span class="emoji">👆</span>
                아래 이미지를 <span class="highlight">길게 터치</span>하세요
              </div>
              <div class="step">
                <span class="emoji">📋</span>
                메뉴에서 <span class="highlight">"이미지 저장"</span> 선택
              </div>
              <div class="step">
                <span class="emoji">✅</span>
                사진 앱에서 확인 가능!
              </div>
            </div>
            <img src="${imageUrl}" alt="${filename}" style="max-width: 100%; height: auto;">
            <p style="margin-top: 20px; opacity: 0.7;">위 이미지를 길게 눌러서 저장하세요</p>
          </body>
        </html>
      `);
      
      return { success: true, method: 'new-window' };
    } catch (error) {
      console.error('New window failed:', error);
      return { success: false, method: 'new-window', message: 'Popup blocked or failed' };
    }
  },
  
  // 이미지 다운로드 메인 함수
  downloadImage: async (imageUrl: string, filename: string = 'image.jpg'): Promise<DownloadResult> => {
    const isIOS = downloadHelper.isIOS();
    
    if (isIOS) {
      const iosVersion = downloadHelper.getIOSVersion();
      
      // iOS 14 이상에서는 Canvas + Share API 시도
      if (iosVersion >= 14) {
        const canvasResult = await downloadHelper.downloadImageViaCanvas(imageUrl, filename);
        if (canvasResult.success) {
          return canvasResult;
        }
      }
      
      // Canvas 실패 시 새 창에서 열기
      return downloadHelper.openImageInNewWindow(imageUrl, filename);
      
    } else {
      // Android/PC - 기존 방식 (잘 작동함)
      try {
        const link = document.createElement('a');
        link.href = imageUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        return { success: true, method: 'standard-download' };
      } catch (error) {
        return { success: false, method: 'standard-download', message: error instanceof Error ? error.message : 'Download failed' };
      }
    }
  },
  
  // 비디오 다운로드 (iOS 최적화)
  downloadVideo: async (videoUrl: string, filename: string = 'video.mp4'): Promise<DownloadResult> => {
    const isIOS = downloadHelper.isIOS();
    
    if (isIOS) {
      // iOS에서는 직접 새 창에서 비디오 열기가 가장 안정적
      try {
        // Share API 먼저 시도 (iOS 12+)
        if (downloadHelper.supportsShareAPI()) {
          try {
            const response = await fetch(videoUrl);
            const blob = await response.blob();
            const file = new File([blob], filename, { type: 'video/mp4' });
            
            if (navigator.canShare({ files: [file] })) {
              await navigator.share({ files: [file] });
              return { success: true, method: 'share-api' };
            }
          } catch (shareError) {
            console.log('Share API failed, trying alternative method');
          }
        }
        
        // Share API 실패 시 새 창에서 비디오 열기
        const newWindow = window.open('', '_blank');
        if (!newWindow) {
          throw new Error('Popup blocked');
        }
        
        newWindow.document.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>${filename}</title>
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <style>
                body {
                  margin: 0;
                  padding: 20px;
                  background: #000;
                  color: white;
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                  text-align: center;
                }
                video {
                  max-width: 100%;
                  height: auto;
                  margin: 20px 0;
                  border: 2px solid #333;
                  border-radius: 8px;
                }
                .guide {
                  background: linear-gradient(135deg, #FF6B6B 0%, #4ECDC4 100%);
                  padding: 20px;
                  border-radius: 12px;
                  margin-bottom: 20px;
                }
                .step {
                  margin: 12px 0;
                  padding: 12px;
                  background: rgba(255,255,255,0.1);
                  border-radius: 8px;
                }
                .highlight {
                  color: #FFE082;
                  font-weight: bold;
                }
                .warning {
                  background: #FF5722;
                  color: white;
                  padding: 12px;
                  border-radius: 8px;
                  margin-top: 15px;
                  font-weight: bold;
                }
              </style>
            </head>
            <body>
              <div class="guide">
                <h2>🎥 비디오 저장 방법</h2>
                <div class="step">
                  1. 아래 비디오를 <span class="highlight">길게 터치</span>
                </div>
                <div class="step">
                  2. <span class="highlight">"비디오 저장"</span> 또는 <span class="highlight">"공유"</span> 선택
                </div>
                <div class="step">
                  3. 사진 앱에서 확인 가능!
                </div>
                <div class="warning">
                  ⚠️ 이 창을 닫기 전에 반드시 저장하세요!
                </div>
              </div>
              <video controls autoplay loop playsinline webkit-playsinline src="${videoUrl}"></video>
            </body>
          </html>
        `);
        
        return { success: true, method: 'new-window-video' };
        
      } catch (error) {
        return { success: false, method: 'ios-video', message: error instanceof Error ? error.message : 'iOS video download failed' };
      }
      
    } else {
      // Android/PC - 기존 Blob 다운로드 방식 유지
      try {
        const response = await fetch(videoUrl);
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
        
        return { success: true, method: 'blob-download' };
      } catch (error) {
        // 실패 시 새 탭에서 열기
        window.open(videoUrl, '_blank');
        return { success: false, method: 'fallback-newtab', message: 'Downloaded via new tab' };
      }
    }
  },
  
  // 다운로드 완료 확인 모달
  showDownloadGuide: (type: 'image' | 'video', onConfirm: () => void, onRetry: () => void) => {
    const modal = document.createElement('div');
    modal.innerHTML = `
      <div style="position: fixed; inset: 0; background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; z-index: 9999; backdrop-filter: blur(5px);">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border: 1px solid rgba(255,255,255,0.2); border-radius: 16px; padding: 28px; max-width: 380px; margin: 16px; box-shadow: 0 20px 40px rgba(0,0,0,0.3);">
          <div style="text-align: center; margin-bottom: 20px;">
            <div style="font-size: 3em; margin-bottom: 10px;">${type === 'video' ? '🎥' : '🖼️'}</div>
            <h3 style="color: white; margin: 0 0 8px 0; font-size: 20px; font-weight: bold;">저장하셨나요?</h3>
            <p style="color: rgba(255,255,255,0.8); margin: 0; font-size: 14px;">
              ${type === 'video' ? '비디오를' : '이미지를'} 저장하지 않으면 다시 볼 수 없습니다.
            </p>
          </div>
          
          <div style="background: rgba(255,255,255,0.1); border-radius: 12px; padding: 16px; margin-bottom: 20px;">
            <p style="color: white; margin: 0; font-size: 13px; line-height: 1.4;">
              💡 <strong>저장 방법:</strong><br>
              ${type === 'video' ? '비디오를' : '이미지를'} 길게 터치 → "${type === 'video' ? '비디오 저장' : '이미지 저장'}" 선택
            </p>
          </div>
          
          <div style="display: flex; gap: 12px;">
            <button id="downloadConfirm" style="flex: 1; padding: 12px 16px; background: linear-gradient(135deg, #4CAF50, #45A049); color: white; border: none; border-radius: 10px; cursor: pointer; font-weight: bold; font-size: 14px;">
              저장했어요! ✅
            </button>
            <button id="downloadRetry" style="flex: 1; padding: 12px 16px; background: linear-gradient(135deg, #FF7043, #F4511E); color: white; border: none; border-radius: 10px; cursor: pointer; font-weight: bold; font-size: 14px;">
              다시 시도 🔄
            </button>
          </div>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    document.getElementById('downloadConfirm')?.addEventListener('click', () => {
      document.body.removeChild(modal);
      onConfirm();
    });
    
    document.getElementById('downloadRetry')?.addEventListener('click', () => {
      document.body.removeChild(modal);
      onRetry();
    });
    
    // 3초 후 자동으로 확인 버튼 강조
    setTimeout(() => {
      const confirmBtn = document.getElementById('downloadConfirm');
      if (confirmBtn) {
        confirmBtn.style.animation = 'pulse 1s infinite';
        confirmBtn.style.transform = 'scale(1.05)';
      }
    }, 3000);
  }
};
