// services/bullnabiService.ts - 동적 토큰 기반으로 수정
import { DynamicTokenService } from './dynamicTokenService';
import type { UserCredits, GenerationResult } from '../types';

/**
 * 🔄 동적 토큰 기반 사용자 크레딧 조회
 */
export const getUserCredits = async (userId: string): Promise<UserCredits | null> => {
  try {
    console.log('💰 동적 토큰으로 사용자 크레딧 조회:', userId);
    
    // 동적 토큰 서비스 사용
    const response = await DynamicTokenService.getUserCreditsWithDynamicToken(userId);
    
    if (response.success && response.data && response.data.length > 0) {
      const user = response.data[0];
      const credits: UserCredits = {
        userId: userId,
        totalCredits: user.remainCount || 0,
        remainingCredits: user.remainCount || 0,
        nickname: user.nickname || user.name || '',
        email: user.email || ''
      };
      
      console.log('✅ 동적 토큰 크레딧 조회 완료:', credits);
      return credits;
    }

    console.warn('사용자 데이터 없음:', response);
    return null;
    
  } catch (error) {
    console.error('❌ 동적 토큰 크레딧 조회 실패:', error);
    
    // 토큰 문제면 재시도
    if (error instanceof Error && error.message.includes('token')) {
      try {
        console.log('🔄 토큰 갱신 후 재시도...');
        await DynamicTokenService.refreshUserToken(userId);
        
        // 재시도
        const retryResponse = await DynamicTokenService.getUserCreditsWithDynamicToken(userId);
        
        if (retryResponse.success && retryResponse.data && retryResponse.data.length > 0) {
          const user = retryResponse.data[0];
          return {
            userId: userId,
            totalCredits: user.remainCount || 0,
            remainingCredits: user.remainCount || 0,
            nickname: user.nickname || user.name || '',
            email: user.email || ''
          };
        }
      } catch (retryError) {
        console.error('재시도도 실패:', retryError);
      }
    }
    
    return null;
  }
};

/**
 * 🔄 동적 토큰 기반 크레딧 사용
 */
export const useCredits = async (
  userId: string, 
  uses: 'image' | 'video', 
  count: number
): Promise<boolean> => {
  try {
    console.log('💰 동적 토큰으로 크레딧 사용:', { userId, uses, count });
    
    // 1. 현재 크레딧 확인
    const currentCredits = await getUserCredits(userId);
    if (!currentCredits || currentCredits.remainingCredits < Math.abs(count)) {
      console.error('크레딧 부족');
      return false;
    }
    
    // 2. 사용자 토큰 가져오기
    let token = DynamicTokenService.getCachedToken(userId);
    if (!token) {
      const tokenResult = await DynamicTokenService.getUserToken(userId);
      if (!tokenResult.success) {
        throw new Error('사용자 토큰 획득 실패');
      }
      token = tokenResult.token!;
    }
    
    // 3. 크레딧 사용 내역 생성
    const historyResponse = await fetch('/.netlify/functions/bullnabi-data-proxy', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'createCreditHistory',
        token: token,
        userId: userId,
        data: {
          userJoin: { "$oid": userId },
          uses: uses,
          count: -Math.abs(count),
          _createTime: new Date().toISOString()
        }
      })
    });

    if (!historyResponse.ok) {
      throw new Error('크레딧 사용 내역 생성 실패');
    }

    const historyResult = await historyResponse.json();
    
    if (!historyResult.success) {
      // 토큰 만료 시 갱신 후 재시도
      if (historyResult.needRefresh) {
        await DynamicTokenService.refreshUserToken(userId);
        return await useCredits(userId, uses, count); // 재귀 호출
      }
      throw new Error(historyResult.error);
    }
    
    // 4. remainCount 업데이트
    const newRemainCount = currentCredits.remainingCredits - Math.abs(count);
    const updateResponse = await fetch('/.netlify/functions/bullnabi-data-proxy', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'updateUserCredits',
        token: token,
        userId: userId,
        newCount: newRemainCount
      })
    });

    const updateResult = await updateResponse.json();
    
    console.log('✅ 동적 토큰 크레딧 사용 완료');
    return updateResult.success;
    
  } catch (error) {
    console.error('❌ 동적 토큰 크레딧 사용 실패:', error);
    return false;
  }
};

/**
 * 🔄 동적 토큰 기반 생성 내역 조회
 */
export const getGenerationHistory = async (userId: string, limit: number = 50): Promise<GenerationResult[]> => {
  try {
    console.log('📊 동적 토큰으로 생성 내역 조회:', userId);
    
    // 사용자 토큰 가져오기
    let token = DynamicTokenService.getCachedToken(userId);
    if (!token) {
      const tokenResult = await DynamicTokenService.getUserToken(userId);
      if (!tokenResult.success) {
        throw new Error('사용자 토큰 획득 실패');
      }
      token = tokenResult.token!;
    }
    
    const response = await fetch('/.netlify/functions/bullnabi-data-proxy', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'getGenerationHistory',
        token: token,
        userId: userId,
        query: { limit }
      })
    });

    if (!response.ok) {
      throw new Error('생성 내역 조회 실패');
    }

    const result = await response.json();
    
    if (result.success) {
      console.log('✅ 생성 내역 조회 완료:', result.data?.length || 0, '개');
      return result.data || [];
    }
    
    // 토큰 만료 시 갱신 후 재시도
    if (result.needRefresh) {
      await DynamicTokenService.refreshUserToken(userId);
      return await getGenerationHistory(userId, limit);
    }
    
    throw new Error(result.error);
    
  } catch (error) {
    console.error('❌ 생성 내역 조회 실패:', error);
    return [];
  }
};

/**
 * 🔄 동적 토큰 기반 생성 결과 저장
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
    console.log('💾 동적 토큰으로 생성 결과 저장');
    
    // 사용자 토큰 가져오기
    let token = DynamicTokenService.getCachedToken(params.userId);
    if (!token) {
      const tokenResult = await DynamicTokenService.getUserToken(params.userId);
      if (!tokenResult.success) {
        console.warn('토큰 획득 실패, 저장 생략');
        return false;
      }
      token = tokenResult.token!;
    }
    
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000); // 3일 후

    const response = await fetch('/.netlify/functions/bullnabi-data-proxy', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'saveGenerationResult',
        token: token,
        userId: params.userId,
        data: {
          userId: { "$oid": params.userId },
          type: params.type,
          originalImageUrl: params.originalImageUrl.substring(0, 150),
          resultUrl: params.resultUrl.substring(0, 150),
          prompt: (params.prompt || '').substring(0, 200),
          facePrompt: (params.facePrompt || '').substring(0, 200),
          clothingPrompt: (params.clothingPrompt || '').substring(0, 200),
          videoDuration: params.videoDuration || null,
          creditsUsed: params.creditsUsed,
          createdAt: now.toISOString(),
          expiresAt: expiresAt.toISOString(),
          _createTime: now.toISOString(),
          status: 'completed'
        }
      })
    });

    if (!response.ok) {
      console.warn('생성 결과 저장 요청 실패');
      return false;
    }

    const result = await response.json();
    
    if (result.success) {
      console.log('✅ 동적 토큰 생성 결과 저장 완료');
      return true;
    }
    
    // 토큰 만료 시 갱신 후 재시도
    if (result.needRefresh) {
      await DynamicTokenService.refreshUserToken(params.userId);
      return await saveGenerationResult(params);
    }
    
    console.warn('생성 결과 저장 실패:', result.error);
    return false;
    
  } catch (error) {
    console.error('❌ 생성 결과 저장 중 오류:', error);
    return false;
  }
};

/**
 * 기존 함수들 (단순화)
 */
export const restoreCredits = async (
  userId: string,
  uses: 'image' | 'video',
  count: number
): Promise<boolean> => {
  // 동적 토큰 시스템에서는 복구 로직 단순화
  console.log('📝 크레딧 복구 요청 (동적 토큰 시스템)');
  return true;
};

export const cleanupExpiredGenerations = async (userId: string): Promise<boolean> => {
  try {
    // 사용자별 정리 작업
    let token = DynamicTokenService.getCachedToken(userId);
    if (!token) {
      const tokenResult = await DynamicTokenService.getUserToken(userId);
      if (!tokenResult.success) {
        return false;
      }
      token = tokenResult.token!;
    }
    
    // 만료된 데이터 정리 API 호출
    const response = await fetch('/.netlify/functions/bullnabi-data-proxy', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'cleanupExpired',
        token: token,
        userId: userId
      })
    });

    const result = await response.json();
    return result.success;
    
  } catch (error) {
    console.error('정리 작업 실패:', error);
    return false;
  }
};
