export interface Env {
  DB: D1Database;
  ASSETS: { fetch: (req: Request) => Promise<Response> };
  JWT_SECRET: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  REDIRECT_URI: string;
}

export interface User {
  id: number;
  email: string;
  password: string;
  created_at: string;
}

export interface GmailToken {
  id: number;
  user_id: number;
  gmail: string;
  access_token: string;
  refresh_token: string;
  created_at: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest extends LoginRequest {}

export interface WaitForEmailRequest {
  gmail: string;
  sender: string;
  timeout?: number; // thời gian chờ tối đa tính bằng giây, mặc định 60s
}

export interface ReadLastEmailRequest {
  gmail: string;
  sender?: string; // Optional: nếu không có sẽ đọc email mới nhất
}

export interface EmailContent {
  id: string;
  threadId: string;
  from: string;
  to: string;
  subject: string;
  snippet: string;
  body: string;
  receivedAt: string;
} 