// services/dynamicTokenService.ts - 사용자별 동적 토큰 시스템

interface UserToken {
  token: string;
  expiresAt: number;
  userId: string;
}

interface TokenResponse {
  success: boolean;
  token?: string;
  error?: string;
}

/**
 * 사용자별 토큰 관리 클래스
 */
export class DynamicTokenService {
  
  /**
   * 1단계: 사용자 토큰 가져오기
   * URL에서 userId를 받아서 해당 사용자의 토큰을 조회
   */
  static async getUserToken(userId: string): Promise<TokenResponse> {
    try {
      console.log('🔑 사용자 토큰 요청:', userId);
      
      // 새로운 엔드포인트: 사용자 토큰 발급
      const response = await fetch('/.netlify/functions/bullnabi-token-proxy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'getUserToken',
          userId: userId
        })
      });

      if (!response.ok) {
        throw new Error(`Token request failed: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.success && data.token) {
        // 토큰을 로컬 스토리지에 캐시 (1시간)
        const tokenData: UserToken = {
          token: data.token,
          expiresAt: Date.now() + (60 * 60 * 1000), // 1시간 후 만료
          userId: userId
        };
        
        localStorage.setItem(`user_token_${userId}`, JSON.stringify(tokenData));
        console.log('✅ 사용자 토큰 획득 및 캐시 완료');
        
        return {
          success: true,
          token: data.token
        };
      }

      return {
        success: false,
        error: data.message || 'Token not available'
      };

    } catch (error) {
      console.error('❌ 사용자 토큰 요청 실패:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * 2단계: 캐시된 토큰 확인
   */
  static getCachedToken(userId: string): string | null {
    try {
      const cached = localStorage.getItem(`user_token_${userId}`);
      if (!cached) return null;

      const tokenData: UserToken = JSON.parse(cached);
      
      // 만료 시간 체크
      if (Date.now() > tokenData.expiresAt) {
        localStorage.removeItem(`user_token_${userId}`);
        console.log('🕐 캐시된 토큰 만료됨');
        return null;
      }

      console.log('✅ 캐시된 토큰 사용');
      return tokenData.token;

    } catch (error) {
      console.error('캐시 토큰 읽기 실패:', error);
      return null;
    }
  }

  /**
   * 3단계: 토큰으로 데이터 조회
   */
  static async fetchUserDataWithToken(token: string, userId: string): Promise<any> {
    try {
      console.log('📊 토큰으로 사용자 데이터 조회');
      
      const response = await fetch('/.netlify/functions/bullnabi-data-proxy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'getUserData',
          token: token,
          userId: userId
        })
      });

      if (!response.ok) {
        throw new Error(`Data fetch failed: ${response.status}`);
      }

      const data = await response.json();
      return data;

    } catch (error) {
      console.error('❌ 데이터 조회 실패:', error);
      throw error;
    }
  }

  /**
   * 통합 함수: 토큰 획득 + 데이터 조회
   */
  static async getUserCreditsWithDynamicToken(userId: string): Promise<any> {
    try {
      // 1. 캐시된 토큰 확인
      let token = this.getCachedToken(userId);
      
      // 2. 토큰이 없으면 새로 가져오기
      if (!token) {
        const tokenResult = await this.getUserToken(userId);
        if (!tokenResult.success) {
          throw new Error(tokenResult.error || 'Failed to get user token');
        }
        token = tokenResult.token!;
      }

      // 3. 토큰으로 데이터 조회
      const userData = await this.fetchUserDataWithToken(token, userId);
      
      return userData;

    } catch (error) {
      console.error('❌ 동적 토큰 사용자 데이터 조회 실패:', error);
      
      // 토큰 문제면 캐시 클리어 후 재시도
      localStorage.removeItem(`user_token_${userId}`);
      throw error;
    }
  }

  /**
   * 토큰 강제 갱신
   */
  static async refreshUserToken(userId: string): Promise<TokenResponse> {
    // 캐시 클리어
    localStorage.removeItem(`user_token_${userId}`);
    
    // 새 토큰 요청
    return await this.getUserToken(userId);
  }

  /**
   * 모든 캐시 클리어
   */
  static clearAllTokenCache(): void {
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith('user_token_')) {
        localStorage.removeItem(key);
      }
    });
    console.log('🗑️ 모든 토큰 캐시 클리어 완료');
  }
}
