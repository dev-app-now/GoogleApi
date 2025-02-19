import { Env, LoginRequest, RegisterRequest, User } from '../types';
import { comparePasswords, error, generateToken, hashPassword, json, sendResetPasswordEmail } from '../utils';

export async function handleAuth(request: Request, env: Env) {
  const url = new URL(request.url);

  if (url.pathname === '/api/auth/register' && request.method === 'POST') {
    const { email, password }: RegisterRequest = await request.json();
    
    if (!email || !password) {
      return error('Email and password are required');
    }

    const existingUser = await env.DB.prepare(
      'SELECT id FROM users WHERE email = ?'
    ).bind(email).first();

    if (existingUser) {
      return error('Email already registered');
    }

    const hashedPassword = await hashPassword(password);
    await env.DB.prepare(
      'INSERT INTO users (email, password) VALUES (?, ?)'
    ).bind(email, hashedPassword).run();

    return json({ message: 'User registered successfully' });
  }

  if (url.pathname === '/api/auth/login' && request.method === 'POST') {
    const { email, password }: LoginRequest = await request.json();
    
    if (!email || !password) {
      return error('Email and password are required', 400);
    }

    const user = await env.DB.prepare(
      'SELECT * FROM users WHERE email = ?'
    ).bind(email).first<User>();

    if (!user || !(await comparePasswords(password, user.password))) {
      return error('Invalid credentials', 401);
    }

    const token = await generateToken(user, env.JWT_SECRET);
    return json({ token });
  }

  if (url.pathname === '/api/auth/forgot-password' && request.method === 'POST') {
    const { email } = await request.json<{ email: string }>();
    
    if (!email) {
      return error('Email is required');
    }

    const user = await env.DB.prepare(
      'SELECT id FROM users WHERE email = ?'
    ).bind(email).first();

    if (!user) {
      return error('Email not found');
    }

    // Generate reset token
    const token = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1);

    await env.DB.prepare(`
      INSERT INTO password_resets (email, token, expires_at)
      VALUES (?, ?, ?)
    `).bind(email, token, expiresAt.toISOString()).run();

    // Send reset email
    await sendResetPasswordEmail(env.RESEND_API_KEY, email, token);

    return json({ message: 'Password reset email sent' });
  }

  if (url.pathname === '/api/auth/reset-password' && request.method === 'POST') {
    const { token } = await request.json<{ token: string }>();
    
    if (!token) {
      return error('Token is required');
    }

    const reset = await env.DB.prepare(`
      SELECT email, expires_at, used
      FROM password_resets 
      WHERE token = ?
    `).bind(token).first<{ email: string, expires_at: string, used: number }>();

    if (!reset) {
      return error('Invalid token');
    }

    if (reset.used) {
      return error('Token already used');
    }

    if (new Date(reset.expires_at) < new Date()) {
      return error('Token expired');
    }

    // Generate new password
    const newPassword = generateRandomPassword();
    const hashedPassword = await hashPassword(newPassword);

    // Update password
    await env.DB.prepare(
      'UPDATE users SET password = ? WHERE email = ?'
    ).bind(hashedPassword, reset.email).run();

    // Mark token as used
    await env.DB.prepare(
      'UPDATE password_resets SET used = 1 WHERE token = ?'
    ).bind(token).run();

    return json({ message: 'Password has been reset successfully', password: newPassword });
  }

  return null;
}

function generateRandomPassword() {
  const length = 12;
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  let password = '';
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * charset.length);
    password += charset[randomIndex];
  }
  return password;
} 