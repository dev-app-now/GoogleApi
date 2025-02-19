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
import { comparePasswords, error, generateToken, hashPassword, json, verifyToken, waitForEmail, readLastEmail, refreshGmailToken, sendResetPasswordEmail } from './utils';
import { listDriveFiles, deleteFile, createSheet } from './sheets';
import { handleAuth } from './routes/auth';
import { handleGmail } from './routes/gmail';
import { handleSheets } from './routes/sheets';

interface DeleteGmailRequest {
	gmail: string;
}

interface AddGmailRequest {
	code: string;
}

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const url = new URL(request.url);

		// Handle CORS preflight
		if (request.method === 'OPTIONS') {
			return new Response(null, {
				headers: {
					'Access-Control-Allow-Origin': '*',
					'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
					'Access-Control-Allow-Headers': 'Content-Type, Authorization',
				},
			});
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

			if (request.method === 'GET' && url.pathname.startsWith('/api/google-client-id')) {
				return new Response(JSON.stringify(env.GOOGLE_CLIENT_ID), {
					headers: { 'Content-Type': 'application/json' },
				});
			}

			// Handle routes
			const handlers = [handleAuth, handleGmail, handleSheets];
			for (const handler of handlers) {
				const response = await handler(request, env);
				if (response) return response;
			}

			return error('Not found', 404);
		} catch (err) {
			console.error(err);
			return error('Internal server error', 500);
		}
	},
} satisfies ExportedHandler<Env>;

// Thêm hàm tạo mật khẩu ngẫu nhiên
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
