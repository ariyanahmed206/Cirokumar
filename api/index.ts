import type { IncomingMessage, ServerResponse } from 'node:http';
import { createApiApp } from '../server/app.ts';

const app = createApiApp();

export default function handler(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url || '/', 'http://localhost');
  const rawPath = url.searchParams.get('__path');
  if (rawPath !== null) {
    url.searchParams.delete('__path');
    const cleanPath = rawPath.replace(/^\/+/, '');
    const qs = url.searchParams.toString();
    req.url = `/api/${cleanPath}${qs ? `?${qs}` : ''}`;
  }
  return app(req as Parameters<typeof app>[0], res as Parameters<typeof app>[1]);
}
