// utils/downloadHelper.ts

export const downloadHelper = {
  // iOS 감지
  isIOS: () => /iPad|iPhone|iPod/.test(navigator.userAgent),
  
  // Android 감지
  isAndroid: () => /Android/i.test(navigator.userAgent),
  
  // 이미지 다운로드
  downloadImage: async (imageUrl: string, filename: string = 'image.jpg') => {
    const isIOS = downloadHelper.isIOS();
    
    if (isIOS) {
      // iOS: 새 창에서 이미지 열고 안내 표시
      const newWindow = window.open('', '_blank');
      if (newWindow) {
        newWindow.document.write(`
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
                }
                .instructions {
                  background: #1a1a1a;
                  padding: 15px;
                  border-radius: 10px;
                  margin-bottom: 20px;
                }
                .step {
                  margin: 10px 0;
                  padding: 10px;
                  background: #2a2a2a;
                  border-radius: 5px;
                }
                .highlight {
                  color: #4a9eff;
                  font-weight: bold;
                }
              </style>
            </head>
            <body>
              <div class="instructions">
                <h2>📱 이미지 저장 방법</h2>
                <div class="step">1. 아래 이미지를 <span class="highlight">길게 터치</span></div>
                <div class="step">2. <span class="highlight">"이미지 저장"</span> 선택</div>
                <div class="step">3. 사진 앱에서 확인 가능!</div>
              </div>
              <img src="${imageUrl}" alt="${filename}">
            </body>
          </html>
        `);
      }
      return true;
    } else {
      // 기타 기기: 기존 다운로드 방식
      const link = document.createElement('a');
      link.href = imageUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return true;
    }
  },
  
  // 비디오 다운로드
  downloadVideo: async (videoUrl: string, filename: string = 'video.mp4') => {
    const isIOS = downloadHelper.isIOS();
    
    if (isIOS) {
      // iOS: 새 창에서 비디오 열고 안내 표시
      const newWindow = window.open('', '_blank');
      if (newWindow) {
        newWindow.document.write(`
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
                }
                .instructions {
                  background: #1a1a1a;
                  padding: 15px;
                  border-radius: 10px;
                  margin-bottom: 20px;
                }
                .step {
                  margin: 10px 0;
                  padding: 10px;
                  background: #2a2a2a;
                  border-radius: 5px;
                }
                .highlight {
                  color: #4a9eff;
                  font-weight: bold;
                }
                .warning {
                  background: #ff4444;
                  color: white;
                  padding: 10px;
                  border-radius: 5px;
                  margin-top: 10px;
                  font-weight: bold;
                }
              </style>
            </head>
            <body>
              <div class="instructions">
                <h2>📱 영상 저장 방법</h2>
                <div class="step">1. 아래 영상을 <span class="highlight">길게 터치</span></div>
                <div class="step">2. <span class="highlight">"비디오 저장"</span> 선택</div>
                <div class="step">3. 사진 앱에서 확인 가능!</div>
                <div class="warning">⚠️ 저장하지 않고 창을 닫으면 영상이 사라집니다!</div>
              </div>
              <video controls autoplay loop playsinline webkit-playsinline src="${videoUrl}"></video>
            </body>
          </html>
        `);
      }
      return true;
    } else {
      // 기타 기기: Blob 다운로드
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
        
        setTimeout(() => URL.revokeObjectURL(blobUrl), 100);
        return true;
      } catch (error) {
        // 실패 시 새 탭에서 열기
        window.open(videoUrl, '_blank');
        return false;
      }
    }
  },
  
  // 저장 완료 확인 모달
  showSaveConfirmation: (onConfirm: () => void, onCancel: () => void) => {
    const modal = document.createElement('div');
    modal.innerHTML = `
      <div style="position: fixed; inset: 0; background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; z-index: 9999;">
        <div style="background: #1f2937; border: 1px solid #374151; border-radius: 12px; padding: 24px; max-width: 320px; margin: 16px;">
          <h3 style="color: white; margin: 0 0 16px 0; font-size: 18px;">저장하셨나요?</h3>
          <p style="color: #9ca3af; margin: 0 0 24px 0; font-size: 14px;">이미지/영상을 저장하지 않으면 다시 볼 수 없습니다.</p>
          <div style="display: flex; gap: 12px;">
            <button id="saveConfirm" style="flex: 1; padding: 8px 16px; background: #10b981; color: white; border: none; border-radius: 8px; cursor: pointer;">저장했어요</button>
            <button id="saveCancel" style="flex: 1; padding: 8px 16px; background: #6b7280; color: white; border: none; border-radius: 8px; cursor: pointer;">아직이요</button>
          </div>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    document.getElementById('saveConfirm')?.addEventListener('click', () => {
      document.body.removeChild(modal);
      onConfirm();
    });
    
    document.getElementById('saveCancel')?.addEventListener('click', () => {
      document.body.removeChild(modal);
      onCancel();
    });
  }
};
