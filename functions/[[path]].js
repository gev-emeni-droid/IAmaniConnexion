import { handle } from 'hono/cloudflare-pages';
import { app } from './api/[[path]].js';

export const onRequest = handle(app);
