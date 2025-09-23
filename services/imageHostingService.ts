// services/imageHostingService.ts - 최종 완성 버전
import type { ImageFile } from '../types';

// Cloudinary 설정
const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY;
const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET;
const IMGUR_CLIENT_ID = process.env.IMGUR_CLIENT_ID;

interface CloudinaryResponse {
  public_id: string;
  secure_url: string;
  bytes: number;
  format: string;
}

/**
 * Cloudinary 이미지 업로드 (VModel용)
 */
export const uploadImageToCloudinary = async (
  imageFile: ImageFile,
  folder: string = 'vmodel_temp'
): Promise<string> => {
  try {
    if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
      throw new Error('Cloudinary 환경변수가 설정되지 않았습니다.');
    }

    console.log('Cloudinary 업로드 시작...');

    // FormData 생성
    const formData = new FormData();
    
    // Base64를 Blob으로 변환
    const base64Data = imageFile.base64;
    const byteCharacters = atob(base64Data);
    const byteNumbers = new Array(byteCharacters.length);
    
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: imageFile.mimeType });
    
    // 파일명 생성
    const timestamp = Date.now();
    const fileName = `vmodel_${timestamp}`;
    
    // FormData 구성
    formData.append('file', blob, `${fileName}.jpg`);
    formData.append('api_key', CLOUDINARY_API_KEY);
    formData.append('timestamp', timestamp.toString());
    formData.append('folder', folder);
    formData.append('public_id', fileName);
    
    // 간단한 서명 생성
    const signature = await generateSimpleSignature({
      timestamp: timestamp.toString(),
      folder: folder,
      public_id: fileName
    });
    
    formData.append('signature', signature);

    // Cloudinary API 호출
    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
      {
        method: 'POST',
        body: formData
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Cloudinary 업로드 실패: ${response.status}`);
    }

    const result: CloudinaryResponse = await response.json();
    
    console.log('Cloudinary 업로드 완료:', result.secure_url.substring(0, 50) + '...');
    return result.secure_url;

  } catch (error) {
    console.error('Cloudinary 업로드 실패:', error);
    throw error;
  }
};

/**
 * Imgur 이미지 업로드
 */
export const uploadImageToImgur = async (imageFile: ImageFile): Promise<string> => {
  try {
    if (!IMGUR_CLIENT_ID) {
      throw new Error('Imgur 클라이언트 ID가 설정되지 않았습니다.');
    }

    console.log('Imgur 업로드 시작...');

    const response = await fetch('https://api.imgur.com/3/image', {
      method: 'POST',
      headers: {
        'Authorization': `Client-ID ${IMGUR_CLIENT_ID}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        image: imageFile.base64,
        type: 'base64',
        title: 'VModel Upload'
      })
    });

    if (!response.ok) {
      throw new Error(`Imgur 업로드 실패: ${response.status}`);
    }

    const result = await response.json();
    
    if (!result.success) {
      throw new Error('Imgur 업로드 실패');
    }

    console.log('Imgur 업로드 완료:', result.data.link.substring(0, 50) + '...');
    return result.data.link;

  } catch (error) {
    console.error('Imgur 업로드 실패:', error);
    throw error;
  }
};

/**
 * 통합 이미지 업로드 (Cloudinary 우선, Imgur 폴백)
 */
export const uploadImage = async (
  imageFile: ImageFile,
  folder: string = 'vmodel_temp'
): Promise<string> => {
  // Cloudinary 먼저 시도
  try {
    return await uploadImageToCloudinary(imageFile, folder);
  } catch (cloudinaryError) {
    console.log('Cloudinary 실패, Imgur로 폴백...');
    
    try {
      return await uploadImageToImgur(imageFile);
    } catch (imgurError) {
      throw new Error('모든 이미지 호스팅 서비스 실패');
    }
  }
};

/**
 * 간단한 서명 생성 (Cloudinary용)
 */
const generateSimpleSignature = async (params: Record<string, string>): Promise<string> => {
  try {
    if (!CLOUDINARY_API_SECRET) {
      throw new Error('Cloudinary API Secret이 없습니다.');
    }

    // 파라미터 정렬 및 문자열 생성
    const sortedParams = Object.keys(params)
      .filter(key => params[key] !== '')
      .sort()
      .map(key => `${key}=${params[key]}`)
      .join('&');

    const stringToSign = sortedParams + CLOUDINARY_API_SECRET;
    
    // SHA1 해시 생성
    const encoder = new TextEncoder();
    const data = encoder.encode(stringToSign);
    const hashBuffer = await crypto.subtle.digest('SHA-1', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    return hashHex;

  } catch (error) {
    console.error('서명 생성 실패:', error);
    // 폴백 서명
    return btoa(JSON.stringify(params)).replace(/[^a-zA-Z0-9]/g, '').substring(0, 40);
  }
};

/**
 * 서비스 상태 확인
 */
export const getImageHostingStatus = () => {
  const hasCloudinary = !!(CLOUDINARY_CLOUD_NAME && CLOUDINARY_API_KEY && CLOUDINARY_API_SECRET);
  const hasImgur = !!IMGUR_CLIENT_ID;
  
  return {
    version: '2.0-SIMPLIFIED',
    cloudinary: {
      configured: hasCloudinary,
      priority: 1
    },
    imgur: {
      configured: hasImgur,
      priority: 2
    },
    ready: hasCloudinary || hasImgur
  };
};
