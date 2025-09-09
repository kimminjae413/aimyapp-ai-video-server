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
        metaCode: '_users',  // 수정: community → _users
        collectionName: '_users',
        documentJson: {
          "pipeline": {  // 수정: pipeline 형식 사용
            "$match": { 
              "_id": { 
                "$eq": { 
                  "$oid": userId  // 수정: ObjectId 형식
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
    
    // 수정: data.data 체크 (data.code 체크 제거 - 없을 수도 있음)
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
        metaCode: '_users',  // 수정: community → _users
        collectionName: 'aiTicketHistory',
        documentJson: {
          userJoin: { "$oid": userId },  // 수정: ObjectId 형식
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
        metaCode: '_users',  // 수정
        collectionName: 'aiTicketHistory',
        documentJson: {
          userJoin: { "$oid": userId },  // 수정: ObjectId 형식
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
        metaCode: '_users',  // 수정
        collectionName: 'aiTicketHistory',
        documentJson: {
          "pipeline": {  // 수정: pipeline 형식
            "$match": { 
              "userJoin": { "$oid": userId }  // 수정: ObjectId 형식
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
