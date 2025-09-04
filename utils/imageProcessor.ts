// utils/imageProcessor.ts
export class ImageProcessor {
  
  // Base64 이미지에서 메타데이터 제거
  static async cleanBase64Image(base64Data: string, mimeType: string = 'image/jpeg'): Promise<{base64: string, mimeType: string, url: string}> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          
          if (!ctx) {
            reject(new Error('Canvas context not available'));
            return;
          }
          
          // 원본 크기 유지
          canvas.width = img.width;
          canvas.height = img.height;
          
          // 이미지를 캔버스에 그리기 (메타데이터 제거됨)
          ctx.drawImage(img, 0, 0);
          
          // 새로운 데이터 URL 생성 (품질 0.95로 거의 무손실)
          const cleanDataUrl = canvas.toDataURL(mimeType, 0.95);
          const cleanBase64Data = cleanDataUrl.split(',')[1];
          
          resolve({
            base64: cleanBase64Data,
            mimeType: mimeType,
            url: cleanDataUrl
          });
        } catch (error) {
          reject(error);
        }
      };
      
      img.onerror = () => {
        reject(new Error('Failed to load image'));
      };
      
      img.src = `data:${mimeType};base64,${base64Data}`;
    });
  }
  
  // URL 이미지에서 메타데이터 제거
  static async removeMetadataFromUrl(imageUrl: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          
          if (!ctx) {
            reject(new Error('Canvas context not available'));
            return;
          }
          
          canvas.width = img.width;
          canvas.height = img.height;
          ctx.drawImage(img, 0, 0);
          
          const cleanDataUrl = canvas.toDataURL('image/jpeg', 0.95);
          resolve(cleanDataUrl);
        } catch (error) {
          reject(error);
        }
      };
      
      img.onerror = () => {
        reject(new Error('Failed to load image'));
      };
      
      img.src = imageUrl;
    });
  }
}
