// utils/pngConverter.ts

export class PNGConverter {
  
  /**
   * Base64 이미지를 PNG 형식으로 변환하고 4MB 미만으로 최적화
   */
  static async convertToPNGForOpenAI(base64Image: string): Promise<string> {
    return new Promise((resolve, reject) => {
      try {
        // 1. Base64 정리
        let cleanBase64 = base64Image;
        if (cleanBase64.startsWith('data:')) {
          cleanBase64 = cleanBase64.split(',')[1];
        }

        // 2. 이미지 로드
        const img = new Image();
        
        img.onload = () => {
          try {
            // 3. Canvas 생성
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            if (!ctx) {
              reject(new Error('Canvas context not available'));
              return;
            }
            
            // 4. 크기 계산 (4MB 제한 고려)
            let { width, height } = img;
            
            // 최대 크기를 1024x1024로 제한
            const MAX_SIZE = 1024;
            if (width > MAX_SIZE || height > MAX_SIZE) {
              if (width > height) {
                height = (height * MAX_SIZE) / width;
                width = MAX_SIZE;
              } else {
                width = (width * MAX_SIZE) / height;
                height = MAX_SIZE;
              }
            }
            
            // 5. Canvas 크기 설정
            canvas.width = width;
            canvas.height = height;
            
            // 6. 흰색 배경 (PNG 투명도 처리)
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, width, height);
            
            // 7. 이미지 그리기
            ctx.drawImage(img, 0, 0, width, height);
            
            // 8. PNG로 변환 (고품질)
            const pngDataUrl = canvas.toDataURL('image/png', 1.0);
            const pngBase64 = pngDataUrl.split(',')[1];
            
            // 9. 크기 확인
            const sizeInMB = (pngBase64.length * 3) / (4 * 1024 * 1024);
            console.log('PNG 변환 완료:', {
              원본크기: `${img.width}x${img.height}`,
              변환크기: `${width}x${height}`,
              파일크기: `${sizeInMB.toFixed(2)}MB`
            });
            
            if (sizeInMB >= 4) {
              // 크기가 여전히 클 경우 품질 낮춰서 재시도
              console.log('크기가 너무 큼, 품질을 낮춰서 재시도...');
              
              const lowerQualityPng = canvas.toDataURL('image/png', 0.8);
              const lowerQualityBase64 = lowerQualityPng.split(',')[1];
              const newSizeInMB = (lowerQualityBase64.length * 3) / (4 * 1024 * 1024);
              
              if (newSizeInMB >= 4) {
                reject(new Error(`이미지가 너무 큽니다: ${newSizeInMB.toFixed(2)}MB`));
                return;
              }
              
              resolve(lowerQualityBase64);
            } else {
              resolve(pngBase64);
            }
            
          } catch (error) {
            reject(error);
          }
        };
        
        img.onerror = () => {
          reject(new Error('이미지 로드 실패'));
        };
        
        // Base64를 Data URL로 변환해서 로드
        img.src = `data:image/jpeg;base64,${cleanBase64}`;
        
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * 이미지가 이미 PNG인지 확인
   */
  static isPNG(base64Image: string): boolean {
    try {
      let cleanBase64 = base64Image;
      if (cleanBase64.startsWith('data:')) {
        const mimeMatch = cleanBase64.match(/data:([^;]+)/);
        if (mimeMatch) {
          return mimeMatch[1] === 'image/png';
        }
        cleanBase64 = cleanBase64.split(',')[1];
      }
      
      // PNG 시그니처 확인 (89 50 4E 47)
      const bytes = atob(cleanBase64.substring(0, 8));
      return bytes.charCodeAt(0) === 0x89 && 
             bytes.charCodeAt(1) === 0x50 && 
             bytes.charCodeAt(2) === 0x4E && 
             bytes.charCodeAt(3) === 0x47;
    } catch {
      return false;
    }
  }
}
