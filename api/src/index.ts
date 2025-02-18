/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Bind resources to your worker in `wrangler.jsonc`. After adding bindings, a type definition for the
 * `Env` object can be regenerated with `npm run cf-typegen`.
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

import { Env, LoginRequest, RegisterRequest, User, WaitForEmailRequest, ReadLastEmailRequest } from './types';
import { comparePasswords, error, generateToken, hashPassword, json, verifyToken, waitForEmail, readLastEmail, refreshGmailToken } from './utils';

interface GoogleTokenResponse {
	access_token: string;
	refresh_token: string;
}

interface GoogleUserInfo {
	email: string;
}

interface GoogleErrorResponse {
	error: string;
	error_description?: string;
}

interface DeleteGmailRequest {
	gmail: string;
}

interface AddGmailRequest {
	code: string;
}

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const url = new URL(request.url);
		const origin = request.headers.get('Origin') || '*';

		// Handle CORS preflight
		if (request.method === 'OPTIONS') {
			return json(null, 200);
		}

		try {
			// Serve static files
			if (request.method === 'GET' && !url.pathname.startsWith('/api/')) {
				const asset = await env.ASSETS.fetch(request);
				if (asset.status === 404) {
					// Serve index.html for all non-API routes that don't match a static file
					return env.ASSETS.fetch(new Request(`${url.origin}/index.html`));
				}
				return asset;
			}

			// Add CORS headers to all responses
			const responseHeaders = {
				'Access-Control-Allow-Origin': origin,
				'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
				'Access-Control-Allow-Headers': 'Content-Type, Authorization',
			};

			// Auth routes
			if (url.pathname === '/api/auth/register' && request.method === 'POST') {
				const { email, password }: RegisterRequest = await request.json();
				
				if (!email || !password) {
					return error('Email and password are required');
				}

				// Check if email already exists
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

			// Protected routes
			const authHeader = request.headers.get('Authorization');
			if (!authHeader?.startsWith('Bearer ')) {
				return error('Unauthorized', 401);
			}

			const token = authHeader.split(' ')[1];
			const payload = await verifyToken(token, env.JWT_SECRET);
			if (!payload) {
				return error('Invalid token', 401);
			}

			// Gmail token management
			if (url.pathname === '/api/gmail/tokens' && request.method === 'GET') {
				const tokens = await env.DB.prepare(
					'SELECT gmail FROM gmail_tokens WHERE user_id = ?'
				).bind(payload.userId).all();
				return json(tokens.results);
			}

			if (url.pathname === '/api/gmail/tokens' && request.method === 'POST') {
				const { code } = await request.json<AddGmailRequest>();
				
				try {
					// Exchange code for tokens
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

					const tokenData = await tokenResponse.json();
					
					if (!tokenResponse.ok) {
						console.error('Token exchange error:', tokenData);
						return error('Failed to authenticate with Google', 400);
					}

					const { access_token, refresh_token } = tokenData as { access_token: string, refresh_token: string };
					if (!access_token || !refresh_token) {
						return error('Invalid response from Google', 400);
					}
					
					// Get Gmail address
					const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
						headers: { Authorization: `Bearer ${access_token}` },
					});

					const userInfo = await userInfoResponse.json();
					
					if (!userInfoResponse.ok) {
						console.error('User info error:', userInfo);
						return error('Failed to get user information', 400);
					}

					const { email: gmail } = userInfo as { email: string };
					if (!gmail) {
						return error('Could not get Gmail address', 400);
					}

					// Check if this Gmail is already registered
					const existingToken = await env.DB.prepare(
						'SELECT id FROM gmail_tokens WHERE user_id = ? AND gmail = ?'
					).bind(payload.userId, gmail).first();

					if (existingToken) {
						return error('This Gmail account is already registered', 400);
					}

					// Save token
					await env.DB.prepare(
						'INSERT INTO gmail_tokens (user_id, gmail, access_token, refresh_token) VALUES (?, ?, ?, ?)'
					).bind(payload.userId, gmail, access_token, refresh_token).run();

					return json({ gmail });
				} catch (err) {
					console.error('Gmail token error:', err);
					return error('Failed to process Google authentication', 500);
				}
			}

			if (url.pathname === '/api/gmail/tokens' && request.method === 'DELETE') {
				const { gmail } = await request.json<DeleteGmailRequest>();
				
				await env.DB.prepare(
					'DELETE FROM gmail_tokens WHERE user_id = ? AND gmail = ?'
				).bind(payload.userId, gmail).run();

				return json({ message: 'Gmail token deleted successfully' });
			}

			if (url.pathname === '/api/gmail/wait-for-email' && request.method === 'POST') {
				const { gmail, sender, timeout = 60 }: WaitForEmailRequest = await request.json();

				// Kiểm tra xem user có quyền truy cập Gmail này không
				const gmailToken = await env.DB.prepare(
					'SELECT access_token, refresh_token FROM gmail_tokens WHERE user_id = ? AND gmail = ?'
				).bind(payload.userId, gmail).first<{ access_token: string, refresh_token: string }>();

				if (!gmailToken) {
					return error('Gmail not found or unauthorized', 404);
				}

				try {
					const result = await waitForEmail(
						gmailToken.access_token,
						gmailToken.refresh_token,
						sender,
						timeout,
						env
					);

					if (result.found && result.email) {
						return json({
							success: true,
							message: 'New email found',
							email: {
								id: result.email.id,
								threadId: result.email.threadId,
								from: result.email.from,
								to: result.email.to,
								subject: result.email.subject,
								snippet: result.email.snippet,
								body: result.email.body,
								receivedAt: result.email.receivedAt
							}
						});
					}

					return json({
						success: false,
						message: 'No new email found'
					});
				} catch (err) {
					console.error('Error waiting for email:', err);
					return error('Failed to check emails', 500);
				}
			}

			if (url.pathname === '/api/gmail/read-last-email' && request.method === 'POST') {
				const { gmail, sender }: ReadLastEmailRequest = await request.json();

				// Kiểm tra xem user có quyền truy cập Gmail này không
				const gmailToken = await env.DB.prepare(
					'SELECT access_token, refresh_token FROM gmail_tokens WHERE user_id = ? AND gmail = ?'
				).bind(payload.userId, gmail).first<{ access_token: string, refresh_token: string }>();

				if (!gmailToken) {
					return error('Gmail not found or unauthorized', 404);
				}

				try {
					let currentToken = gmailToken.access_token;

					try {
						const email = await readLastEmail(currentToken, sender);
						// Chỉ trả về thông tin cần thiết
						return json({
							from: email.from,
							to: email.to,
							subject: email.subject,
							snippet: email.snippet,
							body: email.body,
							receivedAt: email.receivedAt
						});
					} catch (err) {
						// Nếu token hết hạn, thử refresh
						currentToken = await refreshGmailToken(gmailToken.refresh_token, env);
						const email = await readLastEmail(currentToken, sender);
						return json({
							from: email.from,
							to: email.to,
							subject: email.subject,
							snippet: email.snippet,
							body: email.body,
							receivedAt: email.receivedAt
						});
					}
				} catch (err) {
					console.error('Error reading email:', err);
					return error('Failed to read email', 500);
				}
			}

			return error('Not found', 404);
		} catch (err) {
			console.error(err);
			return error('Internal server error', 500);
		}
	},
} satisfies ExportedHandler<Env>;
