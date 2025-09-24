// services/bullnabiService.ts - 무한루프 완전 해결 최종 버전
import type { UserCredits, GenerationResult } from '../types';

const API_BASE_URL = '/.netlify/functions/bullnabi-proxy';

interface BullnabiResponse {
  success: boolean;
  code?: string;
  message?: string;
  data?: any;
  recordsTotal?: number;
  recordsFiltered?: number;
  needRefresh?: boolean;
  tokenExpired?: boolean;
}

interface TokenCache {
  [userId: string]: {
    token: string;
    expiresAt: number;
  };
}

// 토큰 캐시 (메모리 내 저장)
const tokenCache: TokenCache = {};

/**
 * 사용자 토큰 가져오기 (캐시 활용)
 */
async function getUserToken(userId: string): Promise<string | null> {
  try {
    // 캐시된 토큰 확인
    const cached = tokenCache[userId];
    if (cached && Date.now() < cached.expiresAt) {
      console.log('🔄 캐시된 토큰 사용:', userId);
      return cached.token;
    }

    // 새 토큰 발급
    console.log('🔑 새 토큰 발급 요청:', userId);
    const response = await fetch(API_BASE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'getUserToken',
        userId: userId
      })
    });

    if (!response.ok) {
      console.error('토큰 발급 실패:', response.status);
      return null;
    }

    const data = await response.json();
    if (!data.success || !data.token) {
      console.error('토큰 발급 응답 오류:', data);
      return null;
    }

    // 캐시에 저장 (50분 후 만료, 실제 토큰은 1시간)
    tokenCache[userId] = {
      token: data.token,
      expiresAt: Date.now() + (50 * 60 * 1000)
    };

    console.log('✅ 새 토큰 발급 완료:', userId);
    return data.token;

  } catch (error) {
    console.error('토큰 발급 중 오류:', error);
    return null;
  }
}

/**
 * 동적 토큰으로 API 호출 - 무한루프 완전 방지 버전
 */
async function callWithDynamicToken(
  userId: string,
  action: string,
  data?: any,
  retryCount: number = 0
): Promise<BullnabiResponse | null> {
  const MAX_RETRIES = 1; // 최대 1회만 재시도
  
  try {
    const token = await getUserToken(userId);
    if (!token) {
      console.error('토큰을 가져올 수 없음:', userId);
      return null;
    }

    const response = await fetch(API_BASE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action,
        token,
        userId,
        data
      })
    });

    if (!response.ok) {
      console.error(`${action} 호출 실패:`, response.status);
      return null;
    }

    const result = await response.json();
    
    // 🔥 핵심 수정 1: success가 true이면 토큰이 만료되어도 성공으로 처리
    if (result.success) {
      if (result.tokenExpired) {
        console.log('✅ 토큰 만료되었지만 데이터 조회 성공:', userId);
      } else {
        console.log('✅ 정상적으로 데이터 조회 성공:', userId);
      }
      return result;
    }
    
    // 🔥 핵심 수정 2: needRefresh가 false이면 재시도하지 않음 
    if (!result.needRefresh) {
      console.log('토큰 갱신 불필요 또는 다른 오류:', result.error);
      return result;
    }
    
    // 🔥 핵심 수정 3: needRefresh가 true여도 1회만 재시도
    if (result.needRefresh && retryCount < MAX_RETRIES) {
      console.log(`🔄 토큰 만료 감지, 자동 갱신 후 재시도 (${retryCount + 1}/${MAX_RETRIES}):`, userId);
      
      // 캐시 클리어
      delete tokenCache[userId];
      
      // 1초 대기 후 재시도
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // 재시도
      return await callWithDynamicToken(userId, action, data, retryCount + 1);
    }
    
    // 최대 재시도 횟수 초과
    console.log('❌ 최대 재시도 횟수 초과, 토큰 갱신 실패:', userId);
    return result;

  } catch (error) {
    console.error(`${action} 호출 중 오류:`, error);
    return null;
  }
}

/**
 * 기존 방식 (폴백용) - 관리자 토큰 사용
 */
async function callWithAdminToken(
  action: string,
  metaCode: string,
  collectionName: string,
  documentJson: any
): Promise<BullnabiResponse | null> {
  try {
    const response = await fetch(API_BASE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action,
        metaCode,
        collectionName,
        documentJson
      })
    });

    if (!response.ok) {
      console.error(`${action} (관리자 토큰) 호출 실패:`, response.status);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error(`${action} (관리자 토큰) 호출 중 오류:`, error);
    return null;
  }
}

/**
 * 사용자 크레딧 정보 조회 (토큰 만료 시에도 데이터 반환)
 */
export const getUserCredits = async (userId: string): Promise<UserCredits | null> => {
  try {
    console.log('🔍 사용자 크레딧 조회:', userId);

    // 1순위: 동적 토큰 시스템 (토큰 만료시에도 데이터가 있으면 성공)
    const result = await callWithDynamicToken(userId, 'getUserData');
    
    if (result?.success && result.data && result.data.length > 0) {
      const user = result.data[0];
      
      if (result.tokenExpired) {
        console.log('✅ 토큰 만료되었지만 동적 토큰으로 크레딧 조회 성공');
      } else {
        console.log('✅ 동적 토큰으로 크레딧 조회 성공');
      }
      
      return {
        userId: userId,
        totalCredits: user.remainCount || 0,
        remainingCredits: user.remainCount || 0,
        nickname: user.nickname || user.name || '',
        email: user.email || ''
      };
    }

    console.log('⚠️ 동적 토큰 실패, 관리자 토큰으로 폴백');

    // 2순위: 기존 관리자 토큰 시스템 (폴백)
    const fallbackResult = await callWithAdminToken(
      'aggregate',
      '_users',
      '_users',
      {
        "pipeline": {
          "$match": { "_id": { "$eq": { "$oid": userId } } },
          "$limit": 1
        }
      }
    );

    if (fallbackResult?.data && fallbackResult.data.length > 0) {
      const user = fallbackResult.data[0];
      console.log('✅ 관리자 토큰으로 크레딧 조회 성공');
      
      return {
        userId: userId,
        totalCredits: user.remainCount || 0,
        remainingCredits: user.remainCount || 0,
        nickname: user.nickname || user.name || '',
        email: user.email || ''
      };
    }

    console.warn('❌ 모든 방식으로 사용자 데이터를 찾을 수 없음:', userId);
    return null;

  } catch (error) {
    console.error('사용자 크레딧 조회 중 오류:', error);
    return null;
  }
};

/**
 * 크레딧 사용 기록 추가 (동적 토큰 우선)
 */
export const useCredits = async (
  userId: string, 
  uses: 'image' | 'video', 
  count: number
): Promise<boolean> => {
  try {
    // 1. 현재 크레딧 확인
    const currentCredits = await getUserCredits(userId);
    if (!currentCredits || currentCredits.remainingCredits < Math.abs(count)) {
      console.error('크레딧 부족');
      return false;
    }

    // 2. 히스토리 추가 (동적 토큰 1회만 재시도)
    const historyData = {
      userJoin: { "$oid": userId },
      uses: uses,
      count: -Math.abs(count),
      _createTime: new Date().toISOString()
    };

    let historyResult = await callWithDynamicToken(userId, 'createCreditHistory', historyData);
    
    // 동적 토큰 실패시 관리자 토큰으로 폴백
    if (!historyResult?.success) {
      console.log('히스토리 추가 - 관리자 토큰으로 폴백');
      historyResult = await callWithAdminToken(
        'create',
        '_users',
        'aiTicketHistory',
        historyData
      );
    }

    if (!historyResult?.success && historyResult?.code !== '1' && historyResult?.code !== 1) {
      console.error('히스토리 추가 실패');
      return false;
    }

    // 3. remainCount 업데이트 (동적 토큰 1회만 재시도)
    const newRemainCount = currentCredits.remainingCredits - Math.abs(count);
    const updateData = { newCount: newRemainCount };

    let updateResult = await callWithDynamicToken(userId, 'updateUserCredits', updateData);
    
    // 동적 토큰 실패시 관리자 토큰으로 폴백
    if (!updateResult?.success) {
      console.log('크레딧 업데이트 - 관리자 토큰으로 폴백');
      updateResult = await callWithAdminToken(
        'update',
        '_users',
        '_users',
        {
          "_id": { "$oid": userId },
          "remainCount": newRemainCount
        }
      );
    }

    console.log('✅ 크레딧 사용 완료:', { userId, uses, count, newRemainCount });
    return true;

  } catch (error) {
    console.error('크레딧 사용 중 오류:', error);
    return false;
  }
};

/**
 * 크레딧 복구 (동적 토큰 우선)
 */
export const restoreCredits = async (
  userId: string,
  uses: 'image' | 'video',
  count: number
): Promise<boolean> => {
  try {
    const currentCredits = await getUserCredits(userId);
    if (!currentCredits) {
      console.error('복구를 위한 현재 크레딧 조회 실패');
      return false;
    }

    // 복구용 히스토리 추가 (동적 토큰 1회만 재시도)
    const restoreData = {
      userJoin: { "$oid": userId },
      uses: `${uses}_restore`,
      count: Math.abs(count),
      _createTime: new Date().toISOString(),
      note: '생성 실패로 인한 크레딧 복구'
    };

    let result = await callWithDynamicToken(userId, 'createCreditHistory', restoreData);
    
    if (!result?.success) {
      console.log('크레딧 복구 - 관리자 토큰으로 폴백');
      result = await callWithAdminToken(
        'create',
        '_users',
        'aiTicketHistory',
        restoreData
      );
    }

    // remainCount 업데이트
    const newRemainCount = currentCredits.remainingCredits + Math.abs(count);
    const updateData = { newCount: newRemainCount };

    let updateResult = await callWithDynamicToken(userId, 'updateUserCredits', updateData);
    
    if (!updateResult?.success) {
      updateResult = await callWithAdminToken(
        'update',
        '_users',
        '_users',
        {
          "_id": { "$oid": userId },
          "remainCount": newRemainCount
        }
      );
    }

    console.log('✅ 크레딧 복구 완료:', { userId, uses, count, newRemainCount });
    return true;

  } catch (error) {
    console.error('크레딧 복구 중 오류:', error);
    return false;
  }
};

/**
 * 생성 결과 저장 (동적 토큰 우선)
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
    const expiresAt = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

    const truncateUrl = (url: string, maxLength: number = 100): string => {
      if (!url || url.length <= maxLength) return url || '';
      return url.substring(0, maxLength) + '...[truncated]';
    };

    const truncateText = (text: string, maxLength: number = 300): string => {
      if (!text || text.length <= maxLength) return text || '';
      return text.substring(0, maxLength) + '...';
    };

    const documentData = {
      userId: { "$oid": params.userId },
      type: params.type,
      originalImageUrl: truncateUrl(params.originalImageUrl, 150),
      resultUrl: truncateUrl(params.resultUrl, 150),
      prompt: truncateText(params.prompt || '', 200),
      facePrompt: truncateText(params.facePrompt || '', 200),
      clothingPrompt: truncateText(params.clothingPrompt || '', 200),
      videoDuration: params.videoDuration || null,
      creditsUsed: params.creditsUsed,
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      _createTime: now.toISOString(),
      status: 'completed'
    };

    console.log('생성 결과 저장 시작 (동적 토큰)...');

    // 1순위: 동적 토큰 (1회만 재시도)
    let result = await callWithDynamicToken(params.userId, 'saveGenerationResult', documentData);
    
    if (result?.success) {
      console.log('✅ 동적 토큰으로 생성 결과 저장 성공');
      return true;
    }

    console.log('동적 토큰 실패, 관리자 토큰으로 폴백...');

    // 2순위: 관리자 토큰 폴백
    result = await callWithAdminToken(
      'create',
      '_users',
      'aiGenerationHistory',
      documentData
    );

    if (result?.code === '1' || result?.code === 1) {
      console.log('✅ 관리자 토큰으로 생성 결과 저장 성공');
      return true;
    }

    console.warn('⚠️ 생성 결과 저장 실패:', result);
    return false;

  } catch (error) {
    console.error('생성 결과 저장 중 오류:', error);
    return false;
  }
};

/**
 * 생성 내역 조회 (관리자 토큰 사용)
 */
export const getGenerationHistory = async (userId: string, limit: number = 50): Promise<GenerationResult[]> => {
  try {
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    const result = await callWithAdminToken(
      'aggregate',
      '_users',
      'aiGenerationHistory',
      {
        "pipeline": {
          "$match": { 
            "userId": { "$oid": userId },
            "createdAt": { "$gte": threeDaysAgo.toISOString() }
          },
          "$sort": { "createdAt": -1 },
          "$limit": limit
        }
      }
    );

    return result?.data || [];
  } catch (error) {
    console.error('생성 내역 조회 중 오류:', error);
    return [];
  }
};

/**
 * 만료된 생성 결과 정리 (관리자 토큰 사용)
 */
export const cleanupExpiredGenerations = async (userId: string): Promise<boolean> => {
  try {
    const now = new Date();
    
    const result = await callWithAdminToken(
      'delete',
      '_users',
      'aiGenerationHistory',
      {
        "userId": { "$oid": userId },
        "expiresAt": { "$lt": now.toISOString() }
      }
    );

    if (result?.code === '1' || result?.code === 1) {
      console.log('✅ 만료된 생성 결과 정리 완료');
      return true;
    }

    return false;
  } catch (error) {
    console.error('만료된 생성 결과 정리 중 오류:', error);
    return false;
  }
};

/**
 * 사용 내역 조회 (관리자 토큰 사용)
 */
export const getCreditHistory = async (userId: string, limit: number = 10): Promise<any[]> => {
  try {
    const result = await callWithAdminToken(
      'aggregate',
      '_users',
      'aiTicketHistory',
      {
        "pipeline": {
          "$match": { "userJoin": { "$oid": userId } },
          "$sort": { "_createTime": -1 },
          "$limit": limit
        }
      }
    );

    return result?.data || [];
  } catch (error) {
    console.error('사용 내역 조회 중 오류:', error);
    return [];
  }
};

/**
 * 토큰 캐시 클리어 (디버깅용)
 */
export const clearTokenCache = (userId?: string) => {
  if (userId) {
    delete tokenCache[userId];
    console.log('🗑️ 특정 사용자 토큰 캐시 클리어:', userId);
  } else {
    Object.keys(tokenCache).forEach(key => delete tokenCache[key]);
    console.log('🗑️ 모든 토큰 캐시 클리어');
  }
};

/**
 * 서비스 상태 확인
 */
export const getServiceStatus = () => {
  return {
    version: '4.0-TOKEN-EXPIRED-DATA-RETURN',
    tokenCacheSize: Object.keys(tokenCache).length,
    cachedUsers: Object.keys(tokenCache),
    features: [
      '🔑 동적 사용자 토큰 발급',
      '💾 토큰 메모리 캐싱 (50분)',
      '✅ 토큰 만료시에도 데이터가 있으면 성공 처리',
      '🚫 무한루프 완전 방지 (최대 1회 재시도)',
      '🛡️ 관리자 토큰 폴백 시스템',
      '⚡ 이중 안전망 구조',
      '🎯 needRefresh false 시 재시도 안함'
    ]
  };
};
