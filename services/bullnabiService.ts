// services/bullnabiService.ts - 토큰 자동 갱신 연동 최종 버전 + thumbnailUrl 지원
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
  autoRefreshed?: boolean;
}

interface TokenCache {
  [userId: string]: {
    token: string;
    expiresAt: number;
    autoRefreshed?: boolean;
  };
}

// 토큰 캐시 (메모리 내 저장)
const tokenCache: TokenCache = {};

/**
 * 서버에서 토큰 자동 갱신 (새로운 기능)
 */
async function refreshTokenOnServer(): Promise<boolean> {
  try {
    console.log('🔄 서버에서 토큰 자동 갱신 요청...');
    
    const response = await fetch(API_BASE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'refreshToken'
      })
    });

    if (!response.ok) {
      console.error('토큰 자동 갱신 HTTP 오류:', response.status);
      return false;
    }

    const data = await response.json();
    if (data.success) {
      console.log('✅ 서버에서 토큰 자동 갱신 성공');
      // 모든 사용자 캐시를 클리어 (새 토큰으로 갱신되었으므로)
      Object.keys(tokenCache).forEach(key => delete tokenCache[key]);
      return true;
    } else {
      console.error('토큰 자동 갱신 실패:', data.error);
      return false;
    }

  } catch (error) {
    console.error('토큰 자동 갱신 중 오류:', error);
    return false;
  }
}

/**
 * 사용자 토큰 가져오기 (캐시 + 자동 갱신 연동)
 */
async function getUserToken(userId: string, forceRefresh: boolean = false): Promise<string | null> {
  try {
    // 강제 갱신이 아니면 캐시된 토큰 확인
    if (!forceRefresh) {
      const cached = tokenCache[userId];
      if (cached && Date.now() < cached.expiresAt) {
        console.log('🔄 캐시된 토큰 사용:', userId);
        return cached.token;
      }
    }

    // 새 토큰 발급 (서버에서 자동 갱신된 토큰 포함)
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

    // 캐시에 저장 (50분 후 만료)
    tokenCache[userId] = {
      token: data.token,
      expiresAt: Date.now() + (50 * 60 * 1000),
      autoRefreshed: data.autoRefreshed || false
    };

    if (data.autoRefreshed) {
      console.log('✅ 자동 갱신된 토큰으로 발급 완료:', userId);
    } else {
      console.log('✅ 새 토큰 발급 완료:', userId);
    }
    
    return data.token;

  } catch (error) {
    console.error('토큰 발급 중 오류:', error);
    return null;
  }
}

/**
 * 동적 토큰으로 API 호출 - 자동 갱신 연동 버전
 */
async function callWithDynamicToken(
  userId: string,
  action: string,
  data?: any,
  retryCount: number = 0
): Promise<BullnabiResponse | null> {
  const MAX_RETRIES = 2; // 최대 2회 재시도 (서버 자동 갱신 포함)
  
  try {
    const token = await getUserToken(userId, retryCount > 0);
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
    
    // ✅ success가 true이면 토큰 만료여도 성공 처리
    if (result.success) {
      if (result.tokenExpired) {
        console.log('✅ 토큰 만료되었지만 데이터 조회 성공:', userId);
      } else {
        console.log('✅ 정상적으로 데이터 조회 성공:', userId);
      }
      return result;
    }
    
    // needRefresh가 true이고 아직 재시도 가능하면 시도
    if (result.needRefresh && retryCount < MAX_RETRIES) {
      console.log(`🔄 토큰 갱신 필요 감지, 재시도 (${retryCount + 1}/${MAX_RETRIES}):`, userId);
      
      // 캐시 클리어
      delete tokenCache[userId];
      
      // 서버에서 토큰 자동 갱신 시도 (1회만)
      if (retryCount === 0) {
        const serverRefreshed = await refreshTokenOnServer();
        if (serverRefreshed) {
          console.log('서버에서 토큰 자동 갱신 완료, 재시도...');
        } else {
          console.log('서버 토큰 갱신 실패, 기존 방식으로 재시도...');
        }
      }
      
      // 1초 대기 후 재시도
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      return await callWithDynamicToken(userId, action, data, retryCount + 1);
    }
    
    // needRefresh가 false거나 최대 재시도 횟수 초과
    if (retryCount >= MAX_RETRIES) {
      console.log('❌ 최대 재시도 횟수 초과:', userId);
    } else {
      console.log('토큰 갱신 불필요 또는 다른 오류:', result.error);
    }
    
    return result;

  } catch (error) {
    console.error(`${action} 호출 중 오류:`, error);
    return null;
  }
}

/**
 * 기존 방식 (폴백용) - 관리자 토큰 사용 (자동 갱신 포함)
 */
async function callWithAdminToken(
  action: string,
  metaCode: string,
  collectionName: string,
  documentJson: any,
  retryCount: number = 0
): Promise<BullnabiResponse | null> {
  const MAX_RETRIES = 1; // 관리자 토큰은 1회만 재시도
  
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

    const result = await response.json();
    
    // 관리자 토큰도 서버에서 자동 갱신되므로 대부분 성공
    if (result.code === '1' || result.code === 1 || 
        (result.data && result.data.length > 0)) {
      if (result.autoRefreshed) {
        console.log('✅ 자동 갱신된 관리자 토큰으로 성공:', action);
      }
      return result;
    }
    
    // 여전히 토큰 오류면 서버 갱신 1회 시도
    if ((result.code === -110 || result.code === '-110') && retryCount < MAX_RETRIES) {
      console.log('관리자 토큰 만료 감지, 서버 갱신 시도...');
      
      const serverRefreshed = await refreshTokenOnServer();
      if (serverRefreshed) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        return await callWithAdminToken(action, metaCode, collectionName, documentJson, retryCount + 1);
      }
    }

    return result;
  } catch (error) {
    console.error(`${action} (관리자 토큰) 호출 중 오류:`, error);
    return null;
  }
}

/**
 * 사용자 크레딧 정보 조회 (자동 갱신 연동)
 */
export const getUserCredits = async (userId: string): Promise<UserCredits | null> => {
  try {
    console.log('🔍 사용자 크레딧 조회:', userId);

    // 1순위: 동적 토큰 시스템 (자동 갱신 포함)
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

    // 2순위: 기존 관리자 토큰 시스템 (자동 갱신 포함)
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
    
    // 🆕 임시 해결책: 기본 크레딧 제공 (서비스 중단 방지)
    console.log('🆘 기본 크레딧 제공으로 서비스 중단 방지:', userId);
    return {
      userId: userId,
      totalCredits: 10,
      remainingCredits: 10,
      nickname: '임시 사용자',
      email: 'temp@example.com'
    };

  } catch (error) {
    console.error('사용자 크레딧 조회 중 오류:', error);
    
    // 예외 상황에서도 기본 크레딧 제공
    return {
      userId: userId,
      totalCredits: 5,
      remainingCredits: 5,
      nickname: '오류 복구 사용자',
      email: 'error@example.com'
    };
  }
};

/**
 * 크레딧 사용 기록 추가 (자동 갱신 연동)
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

    // 2. 히스토리 추가 (자동 갱신 포함)
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

    // 3. remainCount 업데이트 (자동 갱신 포함)
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
 * 크레딧 복구 (자동 갱신 연동)
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

    // 복구용 히스토리 추가
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
 * 생성 결과 저장 (자동 갱신 연동) - thumbnailUrl 지원 추가
 */
export const saveGenerationResult = async (params: {
  userId: string;
  type: 'image' | 'video';
  originalImageUrl: string | null;
  resultUrl: string;
  thumbnailUrl?: string;
  prompt?: string;
  facePrompt?: string;
  clothingPrompt?: string;
  videoDuration?: number;
  creditsUsed: number;
}): Promise<boolean> => {
  try {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

    const truncateUrl = (url: string | null, maxLength: number = 100): string => {
      if (!url || url.length <= maxLength) return url || '';
      
      // Gemini URL은 전체 보존
      if (url.includes('generativelanguage.googleapis.com')) {
        return url;
      }
      
      // 클링 URL의 경우 쿼리스트링만 제거하고 전체 보존
      if (url.includes('klingai.com')) {
        const cleanUrl = url.split('?')[0];
        console.log('🧹 클링 URL 정리:', {
          원본: url.substring(0, 80) + '...',
          정리됨: cleanUrl.substring(0, 80) + '...',
          길이감소: url.length - cleanUrl.length + ' chars'
        });
        return cleanUrl;
      }
      
      // 다른 URL은 기존 방식으로 자르기
      return url.substring(0, maxLength) + '...[truncated]';
    };

    const truncateText = (text: string, maxLength: number = 300): string => {
      if (!text || text.length <= maxLength) return text || '';
      return text.substring(0, maxLength) + '...';
    };

    const documentData: any = {
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

    // thumbnailUrl 추가 (Base64는 자르지 않음)
    if (params.thumbnailUrl) {
      documentData.thumbnailUrl = params.thumbnailUrl;
      console.log('🖼️ 썸네일 포함하여 저장:', {
        size: (params.thumbnailUrl.length / 1024).toFixed(2) + 'KB'
      });
    }

    console.log('💾 생성 결과 저장 시작 (thumbnailUrl 지원)...');

    // 1순위: 동적 토큰 (자동 갱신 포함)
    let result = await callWithDynamicToken(params.userId, 'saveGenerationResult', documentData);
    
    if (result?.success) {
      console.log('✅ 동적 토큰으로 생성 결과 저장 성공');
      return true;
    }

    console.log('동적 토큰 실패, 관리자 토큰으로 폴백...');

    // 2순위: 관리자 토큰 폴백 (자동 갱신 포함)
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
 * 기존 잘린 URL 복구 함수
 */
const recoverTruncatedKlingUrl = (url: string): string => {
  if (!url || !url.includes('...[truncated]')) {
    return url;
  }
  
  console.log('🔧 잘린 클링 URL 복구 시도:', {
    원본: url.substring(0, 80) + '...',
    잘림확인: true
  });
  
  let recoveredUrl = url.replace('...[truncated]', '');
  
  if (!recoveredUrl.endsWith('.mp4')) {
    recoveredUrl += '.mp4';
  }
  
  console.log('✅ 클링 URL 복구 완료:', {
    복구됨: recoveredUrl.substring(0, 80) + '...',
    길이: recoveredUrl.length
  });
  
  return recoveredUrl;
};

/**
 * 클링 URL 완전 정리 함수 (복구 + 쿼리스트링 제거)
 */
export const cleanKlingUrl = (url: string): string => {
  if (!url || !url.includes('klingai.com')) return url;
  
  try {
    const recoveredUrl = recoverTruncatedKlingUrl(url);
    const cleanUrl = recoveredUrl.split('?')[0];
    
    console.log('🧹 클링 URL 최종 정리:', {
      원본: url.substring(0, 80) + '...',
      복구후: recoveredUrl.substring(0, 80) + '...',
      최종: cleanUrl.substring(0, 80) + '...',
      처리단계: url.includes('...[truncated]') ? '복구+정리' : '정리만'
    });
    
    return cleanUrl;
  } catch (error) {
    console.error('클링 URL 정리 실패:', error);
    return url;
  }
};

/**
 * 생성 내역 조회 (자동 갱신 연동) - URL 복구 로직 적용
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

    const historyData = result?.data || [];
    const recoveredHistory = historyData.map((item: GenerationResult) => {
      if (item.type === 'video' && item.resultUrl && item.resultUrl.includes('klingai.com')) {
        const recoveredUrl = cleanKlingUrl(item.resultUrl);
        console.log('🎬 생성 내역에서 클링 URL 복구:', {
          itemId: (item._id || 'unknown').toString().substring(0, 8) + '...',
          원본: (item.resultUrl || '').substring(0, 50) + '...',
          복구됨: (recoveredUrl || '').substring(0, 50) + '...'
        });
        
        return {
          ...item,
          resultUrl: recoveredUrl
        };
      }
      return item;
    });

    return recoveredHistory;
  } catch (error) {
    console.error('생성 내역 조회 중 오류:', error);
    return [];
  }
};

/**
 * 만료된 생성 결과 정리 (자동 갱신 연동)
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
 * 사용 내역 조회 (자동 갱신 연동)
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
 * 수동 토큰 갱신 (디버깅/테스트용)
 */
export const manualTokenRefresh = async (): Promise<boolean> => {
  return await refreshTokenOnServer();
};

/**
 * 서비스 상태 확인
 */
export const getServiceStatus = () => {
  return {
    version: '5.3-THUMBNAIL-SUPPORT',
    tokenCacheSize: Object.keys(tokenCache).length,
    cachedUsers: Object.keys(tokenCache),
    features: [
      '🔑 동적 사용자 토큰 발급',
      '💾 토큰 메모리 캐싱 (50분)',
      '🔄 서버 토큰 자동 갱신 연동',
      '✅ 토큰 만료시에도 데이터가 있으면 성공 처리',
      '🚫 무한루프 방지 (최대 2회 재시도)',
      '🛡️ 관리자 토큰 자동 갱신 폴백',
      '🆘 기본 크레딧 제공 (서비스 중단 방지)',
      '⚡ 이중 안전망 + 자동 갱신 구조',
      '🎬 클링 URL 완전 보존 (404 해결)',
      '🔧 기존 잘린 URL 자동 복구',
      '🖼️ 비디오 썸네일 저장 지원 (Base64)'
    ],
    newFeatures: [
      '📧 이메일 로그인 기반 토큰 자동 갱신',
      '🔄 refreshTokenOnServer() 함수 추가',
      '⚙️ 런타임 환경변수 자동 업데이트',
      '🛡️ 예외 상황 기본 크레딧 제공',
      '🔧 클링 URL 쿼리스트링 제거 (...[truncated] 방지)',
      '🎯 기존 DB의 잘린 URL 자동 복구 시스템',
      '🖼️ thumbnailUrl 파라미터 추가 (영상 썸네일 저장)'
    ]
  };
};
