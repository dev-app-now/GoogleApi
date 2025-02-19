import { Env } from '../types';
import { error, json, verifyToken, waitForEmail, readLastEmail, refreshGmailToken } from '../utils';

export async function handleGmail(request: Request, env: Env) {
  const url = new URL(request.url);
  const auth = request.headers.get('Authorization');
  
  if (!auth?.startsWith('Bearer ')) {
    return error('Unauthorized', 401);
  }

  const token = auth.split(' ')[1];
  const payload = await verifyToken(token, env.JWT_SECRET);
  if (!payload) {
    return error('Invalid token', 401);
  }

  if (url.pathname === '/api/gmail/tokens' && request.method === 'GET') {
    const tokens = await env.DB.prepare(
      'SELECT gmail, scopes FROM gmail_tokens WHERE user_id = ?'
    ).bind(payload.userId).all();
    return json(tokens.results);
  }

  if (url.pathname === '/api/gmail/tokens' && request.method === 'POST') {
    const { code } = await request.json<{ code: string }>();
    
    try {
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: env.GOOGLE_CLIENT_ID,
          client_secret: env.GOOGLE_CLIENT_SECRET,
          redirect_uri: env.REDIRECT_URI,
          grant_type: 'authorization_code',
        }).toString(),
      });

      const tokenData = await tokenResponse.json() as { access_token: string, refresh_token: string, scope: string };
      const { access_token, refresh_token, scope } = tokenData;

      //get user email from access_token
      const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: {
          Authorization: `Bearer ${access_token}`
        }
      });
      const userInfo = await userInfoResponse.json() as { email: string };
      const gmail = userInfo.email;
      
      // Lưu thông tin scope vào DB
      await env.DB.prepare(`
        INSERT INTO gmail_tokens (user_id, gmail, access_token, refresh_token, scopes) 
        VALUES (?, ?, ?, ?, ?)
      `).bind(payload.userId, gmail, access_token, refresh_token, scope).run();

      return json({ gmail });
    } catch (err) {
      console.error('Error adding Gmail:', err);
      return error('Failed to add Gmail account');
    }
  }

  if (url.pathname === '/api/gmail/tokens' && request.method === 'DELETE') {
    const { gmail } = await request.json<{ gmail: string }>();
    
    if (!gmail) {
      return error('Gmail is required');
    }

    await env.DB.prepare(
      'DELETE FROM gmail_tokens WHERE user_id = ? AND gmail = ?'
    ).bind(payload.userId, gmail).run();

    return json({ message: 'Gmail token deleted successfully' });
  }

  if (url.pathname === '/api/gmail/wait-for-email' && request.method === 'POST') {
    const { gmail, sender, timeout } = await request.json<{ gmail: string, sender: string, timeout?: number }>();
    
    const gmailToken = await env.DB.prepare(
      'SELECT access_token, refresh_token FROM gmail_tokens WHERE user_id = ? AND gmail = ?'
    ).bind(payload.userId, gmail).first<{ access_token: string, refresh_token: string }>();

    if (!gmailToken) {
      return error('Gmail not found or unauthorized', 404);
    }

    try {
      const email = await waitForEmail(gmailToken.access_token, gmail, sender, timeout);
      return json({ success: !!email, email });
    } catch (err) {
      if (err instanceof Error && err.message === 'Token expired') {
        const newToken = await refreshGmailToken(gmailToken.refresh_token, env.GOOGLE_CLIENT_ID);
        await env.DB.prepare(
          'UPDATE gmail_tokens SET access_token = ? WHERE user_id = ? AND gmail = ?'
        ).bind(newToken, payload.userId, gmail).run();
        
        const email = await waitForEmail(newToken, gmail, sender, timeout);
        return json({ success: !!email, email });
      }
      throw err;
    }
  }

  if (url.pathname === '/api/gmail/read-last-email' && request.method === 'POST') {
    const { gmail, sender } = await request.json<{ gmail: string, sender?: string }>();
    
    const gmailToken = await env.DB.prepare(
      'SELECT access_token, refresh_token FROM gmail_tokens WHERE user_id = ? AND gmail = ?'
    ).bind(payload.userId, gmail).first<{ access_token: string, refresh_token: string }>();

    if (!gmailToken) {
      return error('Gmail not found or unauthorized', 404);
    }

    try {
      const email = await readLastEmail(gmailToken.access_token, sender);
      return json(email);
    } catch (err) {
      if (err instanceof Error && err.message === 'Token expired') {
        const newToken = await refreshGmailToken(gmailToken.refresh_token, env.GOOGLE_CLIENT_ID);
        await env.DB.prepare(
          'UPDATE gmail_tokens SET access_token = ? WHERE user_id = ? AND gmail = ?'
        ).bind(newToken, payload.userId, gmail).run();
        
        const email = await readLastEmail(newToken, sender);
        return json(email);
      }
      throw err;
    }
  }

  return null;
} 