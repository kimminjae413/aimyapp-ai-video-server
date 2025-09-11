// types.ts
export interface ImageFile {
  base64: string;
  mimeType: string;
  url: string;
}

export interface UserCredits {
  userId: string;
  totalCredits: number;
  remainingCredits: number;
  nickname?: string;
  email?: string;
}

export interface CreditUsage {
  type: 'image' | 'video';
  amount: number;
  timestamp: string;
}

export interface AppContextType {
  userId: string | null;
  credits: UserCredits | null;
  isLoading: boolean;
  error: string | null;
  refreshCredits: () => Promise<void>;
}

// 새로 추가: 생성 내역 관련 타입들
export interface GenerationResult {
  _id?: string;
  userId: string;
  type: 'image' | 'video';
  originalImageUrl: string;
  resultUrl: string;
  prompt?: string;
  facePrompt?: string;
  clothingPrompt?: string;
  videoDuration?: number;
  creditsUsed: number;
  createdAt: string;
  expiresAt: string; // 3일 후 삭제 기준
}

export interface VideoGenerationResult {
  videoUrl: string;
  creditsRequired: number;
}
