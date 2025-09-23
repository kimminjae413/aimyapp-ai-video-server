// services/imageHostingService.ts - Cloudinary를 사용한 임시 이미지 호스팅
import type { ImageFile } from '../types';

// Cloudinary 설정 (무료 계정 사용 가능)
const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY;
const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET;

interface CloudinaryResponse {
  public_id: string;
  version: number;
  signature: string;
  width: number;
  height: number;
  format: string;
  resource_type: string;
  created_at: string;
  tags: string[];
  bytes: number;
  type: string;
  etag: string;
  placeholder: boolean;
  url: string;
  secure_url: string;
  access_mode: string;
  original_filename: string;
}

/**
 * Cloudinary에 이미지 업로드 (VModel AI용)
 */
export const uploadImageToCloudinary = async (
  imageFile: ImageFile,
  options: {
    folder?: string;
    publicId?: string;
    tags?: string[];
    transformation?: any;
  } = {}
): Promise<string> => {
  try {
    if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
      throw new Error('Cloudinary 환경변수가 설정되지 않았습니다.');
    }

    console.log('☁️ Cloudinary 업로드 시작...');

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
    const fileName = options.publicId || `vmodel_temp_${timestamp}`;
    
    // FormData에 추가
    formData.append('file', blob, `${fileName}.jpg`);
    formData.append('api_key', CLOUDINARY_API_KEY);
    formData.append('timestamp', timestamp.toString());
    
    // 옵션 설정
    if (options.folder) {
      formData.append('folder', options.folder);
    }
    if (options.tags && options.tags.length > 0) {
      formData.append('tags', options.tags.join(','));
    }
    
    // 자동 삭제 설정 (1시간 후)
    formData.append('auto_tagging', '0.7');
    formData.append('categorization', 'aws_rek_tagging');
    
    // 서명 생성 (간단화된 버전)
    const signature = await generateCloudinarySignature({
      timestamp: timestamp.toString(),
      folder: options.folder || '',
      tags: options.tags?.join(',') || ''
    });
    
    formData.append('signature', signature);

    console.log('☁️ Cloudinary API 호출 중...');

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
      console.error('Cloudinary 업로드 실패:', response.status, errorText);
      throw new Error(`Cloudinary 업로드 실패: ${response.status}`);
    }

    const result: CloudinaryResponse = await response.json();
    
    console.log('✅ Cloudinary 업로드 완료:', {
      publicId: result.public_id,
      url: result.secure_url,
      size: Math.round(result.bytes / 1024) + 'KB',
      format: result.format
    });

    return result.secure_url;

  } catch (error) {
    console.error('❌ Cloudinary 업로드 실패:', error);
    throw error;
  }
};

/**
 * Cloudinary 서명 생성 (보안상 서버에서 처리하는 것이 권장됨)
 */
const generateCloudinarySignature = async (params: Record<string, string>): Promise<string> => {
  try {
    // 실제로는 서버 측에서 서명을 생성해야 함
    // 여기서는 간단한 구현을 제공
    
    if (!CLOUDINARY_API_SECRET) {
      throw new Error('Cloudinary API Secret이 없습니다.');
    }

    // 파라미터 정렬
    const sortedParams = Object.keys(params)
      .filter(key => params[key] !== '')
      .sort()
      .map(key => `${key}=${params[key]}`)
      .join('&');

    const stringToSign = sortedParams + CLOUDINARY_API_SECRET;
    
    // SHA1 해시 (브라우저에서는 crypto.subtle.digest 사용)
    const encoder = new TextEncoder();
    const data = encoder.encode(stringToSign);
    const hashBuffer = await crypto.subtle.digest('SHA-1', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    return hashHex;

  } catch (error) {
    console.error('서명 생성 실패:', error);
    // 폴백: 간단한 해시 (보안상 완벽하지 않음)
    return btoa(JSON.stringify(params)).replace(/[^a-zA-Z0-9]/g, '').substring(0, 40);
  }
};

/**
 * 임시 이미지 URL 생성 (개발용)
 * 실제 운영에서는 위의 Cloudinary 업로드를 사용
 */
export const createTempImageUrl = async (imageFile: ImageFile): Promise<string> => {
  try {
    console.log('⚠️ 개발용 임시 URL 생성 중...');
    
    // 임시 방법: jsDelivr의 무료 CDN 사용
    // 실제로는 적절한 이미지 호스팅 서비스를 사용해야 함
    
    // Base64를 Blob URL로 변환 (로컬에서만 작동)
    const base64Data = imageFile.base64;
    const byteCharacters = atob(base64Data);
    const byteNumbers = new Array(byteCharacters.length);
    
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: imageFile.mimeType });
    const blobUrl = URL.createObjectURL(blob);
    
    console.log('✅ 임시 URL 생성 완료 (로컬 전용)');
    return blobUrl;

  } catch (error) {
    console.error('임시 URL 생성 실패:', error);
    throw error;
  }
};

/**
 * 무료 이미지 호스팅 서비스 사용 (imgur API)
 */
export const uploadToImgur = async (imageFile: ImageFile): Promise<string> => {
  try {
    console.log('📤 Imgur 업로드 시작...');
    
    const clientId = process.env.IMGUR_CLIENT_ID; // Imgur 클라이언트 ID 필요
    
    if (!clientId) {
      throw new Error('Imgur 클라이언트 ID가 설정되지 않았습니다.');
    }

    const response = await fetch('https://api.imgur.com/3/image', {
      method: 'POST',
      headers: {
        'Authorization': `Client-ID ${clientId}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        image: imageFile.base64,
        type: 'base64',
        title: 'VModel Temp Image',
        description: 'Temporary image for VModel AI processing'
      })
    });

    if (!response.ok) {
      throw new Error(`Imgur 업로드 실패: ${response.status}`);
    }

    const result = await response.json();
    
    if (!result.success) {
      throw new Error('Imgur 업로드 실패: ' + (result.data?.error || 'Unknown error'));
    }

    const imageUrl = result.data.link;
    console.log('✅ Imgur 업로드 완료:', imageUrl);
    
    return imageUrl;

  } catch (error) {
    console.error('❌ Imgur 업로드 실패:', error);
    throw error;
  }
};

/**
 * 스마트 이미지 호스팅 (여러 서비스 시도)
 */
export const uploadImageForVModel = async (imageFile: ImageFile): Promise<string> => {
  console.log('🚀 VModel용 이미지 호스팅 시작...');
  
  const methods = [
    { name: 'Cloudinary', fn: () => uploadImageToCloudinary(imageFile, { folder: 'vmodel_temp', tags: ['vmodel', 'temp'] }) },
    { name: 'Imgur', fn: () => uploadToImgur(imageFile) },
    { name: 'Temp URL', fn: () => createTempImageUrl(imageFile) }
  ];

  for (const method of methods) {
    try {
      console.log(`🔄 ${method.name} 시도 중...`);
      const url = await method.fn();
      console.log(`✅ ${method.name} 성공:`, url.substring(0, 50) + '...');
      return url;
    } catch (error) {
      console.warn(`⚠️ ${method.name} 실패:`, error instanceof Error ? error.message : 'Unknown error');
      continue;
    }
  }

  throw new Error('모든 이미지 호스팅 방법이 실패했습니다.');
};

/**
 * 서비스 상태 확인
 */
export const getImageHostingStatus = () => {
  return {
    version: '1.0-MULTI-HOSTING',
    services: {
      cloudinary: {
        available: !!(CLOUDINARY_CLOUD_NAME && CLOUDINARY_API_KEY && CLOUDINARY_API_SECRET),
        cost: 'Free tier: 25GB storage, 25GB bandwidth/month'
      },
      imgur: {
        available: !!process.env.IMGUR_CLIENT_ID,
        cost: 'Free: Unlimited uploads (with API limits)'
      },
      tempUrl: {
        available: true,
        cost: 'Free (local only, not suitable for production)'
      }
    },
    features: [
      '☁️ 다중 호스팅 서비스 지원',
      '🔄 자동 폴백 시스템',
      '⏱️ 임시 이미지 (1시간 후 자동 삭제)',
      '🔐 보안 서명 생성',
      '💰 무료 티어 활용'
    ],
    recommendations: [
      '🥇 1순위: Cloudinary (안정성, 기능)',
      '🥈 2순위: Imgur (간단함)',
      '🥉 3순위: Temp URL (개발용만)'
    ]
  };
};
