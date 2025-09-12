// services/bullnabiService.ts - 최종 최적화 버전
import type { UserCredits, GenerationResult } from '../types';

const API_BASE_URL = '/.netlify/functions/bullnabi-proxy';

interface BullnabiResponse {
  code: string;
  message: string;
  data?: any;
  recordsTotal?: number;
  recordsFiltered?: number;
}

/**
 * 사용자 크레딧 정보 조회
 */
export const getUserCredits = async (userId: string): Promise<UserCredits | null> => {
  try {
    const response = await fetch(API_BASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'aggregate',
        metaCode: '_users',
        collectionName: '_users',
        documentJson: {
          "pipeline": {
            "$match": { 
              "_id": { 
                "$eq": { 
                  "$oid": userId
                } 
              } 
            },
            "$limit": 1
          }
        }
      }),
    });

    if (!response.ok) {
      console.error('Failed to fetch user credits:', response.status);
      return null;
    }

    const data: BullnabiResponse = await response.json();
    console.log('User credits response:', data);
    
    if (data.data && data.data.length > 0) {
      const user = data.data[0];
      return {
        userId: userId,
        totalCredits: user.remainCount || 0,
        remainingCredits: user.remainCount || 0,
        nickname: user.nickname || user.name || '',
        email: user.email || ''
      };
    }

    console.warn('No user data found for ID:', userId);
    return null;
  } catch (error) {
    console.error('Error fetching user credits:', error);
    return null;
  }
};

/**
 * 크레딧 사용 기록 추가 (히스토리)
 */
export const useCredits = async (
  userId: string, 
  uses: 'image' | 'video', 
  count: number
): Promise<boolean> => {
  try {
    // 1. 먼저 현재 크레딧 확인
    const currentCredits = await getUserCredits(userId);
    if (!currentCredits || currentCredits.remainingCredits < Math.abs(count)) {
      console.error('Insufficient credits');
      return false;
    }

    // 2. 히스토리 추가
    const historyResponse = await fetch(API_BASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'create',
        metaCode: '_users',
        collectionName: 'aiTicketHistory',
        documentJson: {
          userJoin: { "$oid": userId },
          uses: uses,
          count: -Math.abs(count), // 음수로 저장 (차감)
          _createTime: new Date().toISOString()
        }
      }),
    });

    if (!historyResponse.ok) {
      console.error('Failed to create history:', historyResponse.status);
      return false;
    }

    const historyData: BullnabiResponse = await historyResponse.json();
    
    // 3. remainCount 업데이트
    const newRemainCount = currentCredits.remainingCredits - Math.abs(count);
    const updateResponse = await fetch(API_BASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'update',
        metaCode: '_users',
        collectionName: '_users',
        documentJson: {
          "_id": { "$oid": userId },
          "remainCount": newRemainCount
        }
      }),
    });

    if (!updateResponse.ok) {
      console.error('Failed to update remainCount:', updateResponse.status);
      // 히스토리는 추가되었지만 remainCount 업데이트 실패
      // 복구 로직 필요할 수 있음
    }
    
    return true;
  } catch (error) {
    console.error('Error using credits:', error);
    return false;
  }
};

/**
 * 크레딧 복구 (실패 시)
 */
export const restoreCredits = async (
  userId: string,
  uses: 'image' | 'video',
  count: number
): Promise<boolean> => {
  try {
    // 1. 현재 크레딧 조회
    const currentCredits = await getUserCredits(userId);
    if (!currentCredits) {
      console.error('Failed to get current credits for restore');
      return false;
    }

    // 2. 복구용 히스토리 추가 (양수로)
    const response = await fetch(API_BASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'create',
        metaCode: '_users',
        collectionName: 'aiTicketHistory',
        documentJson: {
          userJoin: { "$oid": userId },
          uses: `${uses}_restore`, // 복구 구분을 위해
          count: Math.abs(count), // 양수로 저장 (복구)
          _createTime: new Date().toISOString(),
          note: '생성 실패로 인한 크레딧 복구'
        }
      }),
    });

    if (!response.ok) {
      console.error('Failed to restore credits:', response.status);
      return false;
    }

    // 3. remainCount 업데이트
    const newRemainCount = currentCredits.remainingCredits + Math.abs(count);
    const updateResponse = await fetch(API_BASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'update',
        metaCode: '_users',
        collectionName: '_users',
        documentJson: {
          "_id": { "$oid": userId },
          "remainCount": newRemainCount
        }
      }),
    });

    return updateResponse.ok;
  } catch (error) {
    console.error('Error restoring credits:', error);
    return false;
  }
};

/**
 * 사용 내역 조회
 */
export const getCreditHistory = async (userId: string, limit: number = 10): Promise<any[]> => {
  try {
    const response = await fetch(API_BASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'aggregate',
        metaCode: '_users',
        collectionName: 'aiTicketHistory',
        documentJson: {
          "pipeline": {
            "$match": { 
              "userJoin": { "$oid": userId }
            },
            "$sort": { "_createTime": -1 },
            "$limit": limit
          }
        }
      }),
    });

    if (!response.ok) {
      console.error('Failed to fetch history:', response.status);
      return [];
    }

    const data: BullnabiResponse = await response.json();
    return data.data || [];
  } catch (error) {
    console.error('Error fetching history:', error);
    return [];
  }
};

/**
 * 생성 결과 저장 (최적화된 버전 - 네트워크 에러 방지)
 */
export const saveGenerationResult = async (params: {
  userId: string;
  type: 'image' | 'video';
  originalImageUrl: string;
  resultUrl: string;
  prompt?: string;
  facePrompt?: string;
  clothingPrompt?: string;
  videoDuration?: number;
  creditsUsed: number;
}): Promise<boolean> => {
  try {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000); // 3일 후

    // URL 크기 체크 및 축약 (네트워크 에러 방지)
    const truncateUrl = (url: string, maxLength: number = 100): string => {
      if (!url || url.length <= maxLength) return url || '';
      return url.substring(0, maxLength) + '...[truncated]';
    };

    // 프롬프트 길이 제한
    const truncateText = (text: string, maxLength: number = 300): string => {
      if (!text || text.length <= maxLength) return text || '';
      return text.substring(0, maxLength) + '...';
    };

    console.log('Saving generation result with optimized data...');

    const response = await fetch(API_BASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'create',
        metaCode: '_users',
        collectionName: 'aiGenerationHistory',
        documentJson: {
          userId: { "$oid": params.userId },
          type: params.type,
          // URL 축약으로 데이터 크기 줄이기 (네트워크 타임아웃 방지)
          originalImageUrl: truncateUrl(params.originalImageUrl, 150),
          resultUrl: truncateUrl(params.resultUrl, 150),
          // 프롬프트 길이 제한
          prompt: truncateText(params.prompt || '', 200),
          facePrompt: truncateText(params.facePrompt || '', 200),
          clothingPrompt: truncateText(params.clothingPrompt || '', 200),
          videoDuration: params.videoDuration || null,
          creditsUsed: params.creditsUsed,
          createdAt: now.toISOString(),
          expiresAt: expiresAt.toISOString(),
          _createTime: now.toISOString(),
          // 상태 기록
          status: 'completed'
        }
      }),
    });

    if (!response.ok) {
      console.error('Failed to save generation result:', response.status);
      return false;
    }

    const data = await response.json();
    
    if (data.code === '1' || data.code === 1) {
      console.log('Generation result saved successfully');
      return true;
    } else {
      console.warn('Unexpected save response:', data);
      return false;
    }
    
  } catch (error) {
    console.error('Error saving generation result:', error);
    
    // 네트워크 에러 타입 감지
    if (error instanceof Error) {
      const errorMessage = error.message.toLowerCase();
      if (errorMessage.includes('terminated') || 
          errorMessage.includes('fetch') || 
          errorMessage.includes('network') ||
          errorMessage.includes('timeout') ||
          errorMessage.includes('aborted')) {
        console.warn('Network error detected during save, skipping retry to prevent timeout');
        return false;
      }
    }
    
    return false;
  }
};

/**
 * 생성 내역 조회 (최근 3일) - 에러 처리 강화
 */
export const getGenerationHistory = async (userId: string, limit: number = 50): Promise<GenerationResult[]> => {
  try {
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    const response = await fetch(API_BASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'aggregate',
        metaCode: '_users',
        collectionName: 'aiGenerationHistory',
        documentJson: {
          "pipeline": {
            "$match": { 
              "userId": { "$oid": userId },
              "createdAt": { "$gte": threeDaysAgo.toISOString() }
            },
            "$sort": { "createdAt": -1 },
            "$limit": limit
          }
        }
      }),
    });

    if (!response.ok) {
      console.error('Failed to fetch generation history:', response.status);
      return [];
    }

    const data: BullnabiResponse = await response.json();
    return data.data || [];
  } catch (error) {
    console.error('Error fetching generation history:', error);
    return [];
  }
};

/**
 * 만료된 생성 결과 정리 (3일 지난 데이터 삭제)
 */
export const cleanupExpiredGenerations = async (userId: string): Promise<boolean> => {
  try {
    const now = new Date();
    
    const response = await fetch(API_BASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'delete',
        metaCode: '_users',
        collectionName: 'aiGenerationHistory',
        documentJson: {
          "userId": { "$oid": userId },
          "expiresAt": { "$lt": now.toISOString() }
        }
      }),
    });

    if (!response.ok) {
      console.error('Failed to cleanup expired generations:', response.status);
      return false;
    }

    console.log('Expired generations cleaned up successfully');
    return true;
  } catch (error) {
    console.error('Error cleaning up expired generations:', error);
    return false;
  }
};

/**
 * 간소화된 결과 저장 (네트워크 에러 시 대체용)
 */
export const saveSimpleGenerationResult = async (
  userId: string, 
  type: 'image' | 'video', 
  creditsUsed: number
): Promise<boolean> => {
  try {
    console.log('Saving simplified generation result...');
    
    const now = new Date();
    
    const response = await fetch(API_BASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'create',
        metaCode: '_users',
        collectionName: 'aiGenerationHistory',
        documentJson: {
          userId: { "$oid": userId },
          type: type,
          // 최소한의 정보만 저장
          originalImageUrl: 'simplified_record',
          resultUrl: 'simplified_record',
          creditsUsed: creditsUsed,
          createdAt: now.toISOString(),
          _createTime: now.toISOString(),
          status: 'simplified'
        }
      }),
    });

    if (!response.ok) {
      console.error('Failed to save simplified result:', response.status);
      return false;
    }

    const data = await response.json();
    return data.code === '1' || data.code === 1;
    
  } catch (error) {
    console.error('Error saving simplified result:', error);
    return false;
  }
};
