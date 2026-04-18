// Cloudflare Pages Function pour router toutes les requêtes /api/* vers Hono
import app from '../src/server/app';
import type { PagesFunction } from '@cloudflare/workers-types';

const handler: PagesFunction = async (context) => {
  // Hono attend un objet Request natif
  return app.fetch(context.request, context.env, context);
};

export const onRequest = handler;
