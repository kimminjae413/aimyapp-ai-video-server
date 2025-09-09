// services/bullnabiService.ts
import type { UserCredits } from '../types';

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
        metaCode: 'community',
        collectionName: '_users',
        documentJson: {
          "$match": { "_id": userId },
          "$project": { 
            "remainCount": 1,
            "nickname": 1,
            "email": 1
          },
          "$limit": 1
        }
      }),
    });

    if (!response.ok) {
      console.error('Failed to fetch user credits:', response.status);
      return null;
    }

    const data: BullnabiResponse = await response.json();
    
    if (data.code === '1' && data.data && data.data.length > 0) {
      const user = data.data[0];
      return {
        userId: userId,
        totalCredits: user.remainCount || 0,
        remainingCredits: user.remainCount || 0,
        nickname: user.nickname || '',
        email: user.email || ''
      };
    }

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
    const response = await fetch(API_BASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'create',
        metaCode: 'community',
        collectionName: 'aiTicketHistory',
        documentJson: {
          userJoin: userId,
          uses: uses,
          count: -Math.abs(count), // 음수로 저장 (차감)
          _createTime: new Date().toISOString()
        }
      }),
    });

    if (!response.ok) {
      console.error('Failed to create history:', response.status);
      return false;
    }

    const data: BullnabiResponse = await response.json();
    
    // 3. remainCount 업데이트 (히스토리 추가 시 자동으로 업데이트되는지 확인 필요)
    // 만약 자동 업데이트가 안된다면 별도 업데이트 API 호출 필요
    
    return data.code === '1';
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
    // 복구용 히스토리 추가 (양수로)
    const response = await fetch(API_BASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'create',
        metaCode: 'community',
        collectionName: 'aiTicketHistory',
        documentJson: {
          userJoin: userId,
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

    const data: BullnabiResponse = await response.json();
    return data.code === '1';
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
        metaCode: 'community',
        collectionName: 'aiTicketHistory',
        documentJson: {
          "$match": { "userJoin": userId },
          "$sort": { "_createTime": -1 },
          "$limit": limit
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
