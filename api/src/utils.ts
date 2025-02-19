import { SignJWT, jwtVerify } from 'jose';
import * as bcrypt from 'bcryptjs';
import { User, EmailContent } from './types';

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function comparePasswords(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function generateToken(user: User, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  
  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  return new SignJWT({ 
    userId: user.id,
    email: user.email
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('24h')
    .sign(key);
}

export async function verifyToken(token: string, secret: string) {
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret));
    return payload;
  } catch (error) {
    return null;
  }
}

export function json(data: any, status = 200) {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  return new Response(JSON.stringify(data), { headers, status });
}

export function error(message: string, status = 400) {
  return json({ error: message }, status);
}

export async function refreshGmailToken(refreshToken: string, env: { GOOGLE_CLIENT_ID: string, GOOGLE_CLIENT_SECRET: string }) {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to refresh token');
  }

  const data = await response.json<{ access_token: string }>();
  return data.access_token;
}

export async function checkNewEmail(accessToken: string, sender: string): Promise<boolean> {
  // Lấy danh sách email mới nhất (trong 1 phút gần đây)
  const oneMinuteAgo = Math.floor((Date.now() - 60000) / 1000);
  const response = await fetch(
    `https://www.googleapis.com/gmail/v1/users/me/messages?q=from:${sender} after:${oneMinuteAgo}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!response.ok) {
    throw new Error('Failed to check emails');
  }

  const data = await response.json<{ messages?: { id: string }[] }>();
  return !!data.messages?.length;
}

export async function waitForEmail(
  accessToken: string,
  refreshToken: string,
  sender: string,
  timeout: number,
  env: { GOOGLE_CLIENT_ID: string, GOOGLE_CLIENT_SECRET: string }
): Promise<{ found: boolean; email?: EmailContent }> {
  const startTime = Date.now();
  let currentToken = accessToken;

  while (Date.now() - startTime < timeout * 1000) {
    try {
      // Kiểm tra email mới
      const hasNewEmail = await checkNewEmail(currentToken, sender);
      if (hasNewEmail) {
        // Nếu có email mới, đọc nội dung
        const email = await readLastEmail(currentToken, sender);
        return { found: true, email };
      }

      // Đợi 5 giây trước khi kiểm tra lại
      await new Promise(resolve => setTimeout(resolve, 5000));
    } catch (error) {
      // Nếu token hết hạn, thử refresh
      try {
        currentToken = await refreshGmailToken(refreshToken, env);
      } catch {
        throw new Error('Failed to refresh access token');
      }
    }
  }

  return { found: false };
}

export async function readLastEmail(
  accessToken: string,
  sender?: string
): Promise<EmailContent> {
  // Tạo query để tìm email
  let query = '';
  if (sender) {
    query = `from:${sender}`;
  }

  // Lấy danh sách email mới nhất
  const listResponse = await fetch(
    `https://www.googleapis.com/gmail/v1/users/me/messages?maxResults=1&q=${query}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!listResponse.ok) {
    throw new Error('Failed to list emails');
  }

  const listData = await listResponse.json<{ messages?: { id: string }[] }>();
  if (!listData.messages?.length) {
    throw new Error('No emails found');
  }

  // Lấy chi tiết email
  const emailId = listData.messages[0].id;
  const emailResponse = await fetch(
    `https://www.googleapis.com/gmail/v1/users/me/messages/${emailId}?format=full`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!emailResponse.ok) {
    throw new Error('Failed to get email details');
  }

  const emailData = await emailResponse.json<{
    id: string;
    threadId: string;
    payload: {
      headers: { name: string; value: string }[];
      parts?: { body: { data?: string }; mimeType: string }[];
      body?: { data?: string };
    };
    snippet: string;
    internalDate: string;
  }>();

  // Parse email headers
  const headers = emailData.payload.headers;
  const from = headers.find(h => h.name.toLowerCase() === 'from')?.value || '';
  const to = headers.find(h => h.name.toLowerCase() === 'to')?.value || '';
  const subject = headers.find(h => h.name.toLowerCase() === 'subject')?.value || '';

  // Parse email body
  let body = '';
  if (emailData.payload.parts) {
    // Multipart email
    const textPart = emailData.payload.parts.find(p => p.mimeType === 'text/plain');
    if (textPart?.body?.data) {
      body = atob(textPart.body.data.replace(/-/g, '+').replace(/_/g, '/'));
    }
  } else if (emailData.payload.body?.data) {
    // Simple email
    body = atob(emailData.payload.body.data.replace(/-/g, '+').replace(/_/g, '/'));
  }

  return {
    id: emailData.id,
    threadId: emailData.threadId,
    from,
    to,
    subject,
    snippet: emailData.snippet,
    body,
    receivedAt: new Date(parseInt(emailData.internalDate)).toISOString(),
  };
}

export async function sendResetPasswordEmail(email: string, resetLink: string, env: { RESEND_API_KEY: string }) {
    try {
        const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${env.RESEND_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                from: 'Gmail Manager <no-reply@devappnow.com>',
                to: email,
                subject: 'Reset Your Password - Gmail Manager',
                html: `
                    <h1>Reset Your Password</h1>
                    <p>You have requested to reset your password. Click the link below to set a new password:</p>
                    <p><a href="${resetLink}" style="display:inline-block;padding:12px 24px;background:#4F46E5;color:white;text-decoration:none;border-radius:4px;">Reset Password</a></p>
                    <p>Or copy this link: ${resetLink}</p>
                    <p>This link will expire in 1 hour.</p>
                    <p>If you didn't request this, please ignore this email.</p>
                    <br>
                    <p>Best regards,</p>
                    <p>Gmail Manager Team</p>
                `
            })
        });

        if (!response.ok) {
            console.error('Failed to send email:', await response.text());
            throw new Error('Failed to send email');
        }

        return await response.json();
    } catch (error) {
        console.error('Error sending email:', error);
        throw error;
    }
} 