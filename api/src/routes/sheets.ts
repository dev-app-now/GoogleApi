import { Env } from '../types';
import { error, json, verifyToken } from '../utils';
import { createSheet, deleteFile, listDriveFiles, readRange, updateRange, updateStyle } from '../sheets';

export async function handleSheets(request: Request, env: Env) {
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

  if (url.pathname === '/api/sheets' && request.method === 'GET') {
    const gmailToken = await env.DB.prepare(
      'SELECT access_token, refresh_token FROM gmail_tokens WHERE user_id = ? AND gmail = ?'
    ).bind(payload.userId, url.searchParams.get('gmail')).first<{ access_token: string, refresh_token: string }>();

    if (!gmailToken) {
      return error('Gmail not found or unauthorized', 404);
    }

    try {
      const files = await listDriveFiles(gmailToken.access_token);
      return json(files);
    } catch (err) {
      console.error('Error listing files:', err);
      return error('Failed to list files');
    }
  }

  if (url.pathname === '/api/sheets' && request.method === 'POST') {
    const { gmail, title } = await request.json<{ gmail: string, title: string }>();
    
    const gmailToken = await env.DB.prepare(
      'SELECT access_token, refresh_token FROM gmail_tokens WHERE user_id = ? AND gmail = ?'
    ).bind(payload.userId, gmail).first<{ access_token: string, refresh_token: string }>();

    if (!gmailToken) {
      return error('Gmail not found or unauthorized', 404);
    }

    try {
      const sheet = await createSheet(gmailToken.access_token, title);
      return json(sheet);
    } catch (err) {
      console.error('Error creating sheet:', err);
      return error('Failed to create sheet');
    }
  }

  if (url.pathname.match(/^\/api\/sheets\/[^/]+$/) && request.method === 'DELETE') {
    const fileId = url.pathname.split('/').pop();

    if (!fileId) {
      return error('File ID is required', 400);
    }

    const { gmail } = await request.json<{ gmail: string }>();
    
    const gmailToken = await env.DB.prepare(
      'SELECT access_token, refresh_token FROM gmail_tokens WHERE user_id = ? AND gmail = ?'
    ).bind(payload.userId, gmail).first<{ access_token: string, refresh_token: string }>();

    if (!gmailToken) {
      return error('Gmail not found or unauthorized', 404);
    }

    try {
      await deleteFile(gmailToken.access_token, fileId);
      return json({ message: 'File deleted successfully' });
    } catch (err) {
      console.error('Error deleting file:', err);
      return error('Failed to delete file');
    }
  }

  if (url.pathname.match(/^\/api\/sheets\/[^/]+\/values\/[^/]+$/) && request.method === 'GET') {
    const [, , , fileId, , range] = url.pathname.split('/');
    const gmail = url.searchParams.get('gmail');

    if (!fileId || !range || !gmail) {
      return error('Missing required parameters', 400);
    }

    const gmailToken = await env.DB.prepare(
      'SELECT access_token FROM gmail_tokens WHERE user_id = ? AND gmail = ?'
    ).bind(payload.userId, gmail).first<{ access_token: string }>();

    if (!gmailToken) {
      return error('Gmail not found or unauthorized', 404);
    }

    try {
      const result = await readRange(gmailToken.access_token, fileId, range);
      return json(result);
    } catch (err) {
      console.error('Error reading range:', err);
      return error('Failed to read range');
    }
  }

  if (url.pathname.match(/^\/api\/sheets\/[^/]+\/values\/[^/]+$/) && request.method === 'PUT') {
    const [, , , fileId, , range] = url.pathname.split('/');
    const { gmail, values } = await request.json<{ gmail: string, values: any[][] }>();

    if (!fileId || !range || !gmail || !values) {
      return error('Missing required parameters', 400);
    }

    const gmailToken = await env.DB.prepare(
      'SELECT access_token FROM gmail_tokens WHERE user_id = ? AND gmail = ?'
    ).bind(payload.userId, gmail).first<{ access_token: string }>();

    if (!gmailToken) {
      return error('Gmail not found or unauthorized', 404);
    }

    try {
      const result = await updateRange(gmailToken.access_token, fileId, range, values);
      return json(result);
    } catch (err) {
      console.error('Error updating range:', err);
      return error('Failed to update range');
    }
  }

  if (url.pathname.match(/^\/api\/sheets\/[^/]+\/style\/[^/]+$/) && request.method === 'POST') {
    const [, , , fileId, , range] = url.pathname.split('/');
    const { gmail, style } = await request.json<{ gmail: string, style: any }>();

    if (!fileId || !range || !gmail || !style) {
      return error('Missing required parameters', 400);
    }

    const gmailToken = await env.DB.prepare(
      'SELECT access_token FROM gmail_tokens WHERE user_id = ? AND gmail = ?'
    ).bind(payload.userId, gmail).first<{ access_token: string }>();

    if (!gmailToken) {
      return error('Gmail not found or unauthorized', 404);
    }

    try {
      const result = await updateStyle(gmailToken.access_token, fileId, range, JSON.parse(style));
      return json(result);
    } catch (err) {
      console.error('Error updating style:', err);
      return error('Failed to update style');
    }
  }

  return null;
} 