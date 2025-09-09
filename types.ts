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
