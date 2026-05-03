import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import { getRequestListener } from '@hono/node-server';
import { config as loadEnv } from 'dotenv';
import { app } from './functions/api/[[path]].js';
import Database from 'better-sqlite3';

// Load local overrides first, then fallback to .env.
loadEnv({ path: '.env.local' });
loadEnv();

const db = new Database('database.sqlite');

// Mock Cloudflare D1 for local development
const localDB = {
    prepare: (sql: string) => ({
        bind: (...params: any[]) => ({
            all: async () => ({ results: db.prepare(sql).all(...params) }),
            first: async () => db.prepare(sql).get(...params),
            run: async () => {
                const info = db.prepare(sql).run(...params);
                return { success: true, meta: info };
            }
        }),
        all: async () => ({ results: db.prepare(sql).all() }),
        first: async () => db.prepare(sql).get(),
        run: async () => {
            const info = db.prepare(sql).run();
            return { success: true, meta: info };
        }
    })
};

async function startServer() {
    const server = express();
    const PORT = 3001;

    // Inject local environment into Hono
    const requestListener = getRequestListener((req) => {
        return app.fetch(req, {
            DB: localDB,
            RESEND_API_KEY: process.env.RESEND_API_KEY || 'local_key',
            JWT_SECRET: process.env.JWT_SECRET || 'iamani_stable_secret_2026'
        });
    });
    
    // Simple health check for Express
    server.get('/express-health', (req, res) => {
        res.send('Express is alive');
    });

    if (process.env.NODE_ENV !== 'production') {
        const vite = await createViteServer({
            server: { middlewareMode: true },
            appType: 'spa',
        });
        
        // API routes
        server.all('/api/*', (req, res) => {
            console.log(`[API] ${req.method} ${req.url}`);
            requestListener(req, res);
        });

        // Static uploaded assets served by Hono
        server.all('/uploads/*', (req, res) => {
            requestListener(req, res);
        });
        
        // Vite middleware for frontend
        server.use(vite.middlewares);
        
        console.log(`Development server starting on http://localhost:${PORT}`);
    } else {
        const distPath = path.join(process.cwd(), 'dist');
        
        server.use(express.static(distPath));
        
        server.all('/api/*', (req, res) => {
            requestListener(req, res);
        });

        server.all('/uploads/*', (req, res) => {
            requestListener(req, res);
        });
        
        server.get('*', (req, res) => {
            res.sendFile(path.join(distPath, 'index.html'));
        });
        
        console.log(`Production server starting on http://localhost:${PORT}`);
    }

    server.listen(PORT, '0.0.0.0', () => {
        console.log(`Server is listening on port ${PORT}`);
    });
}

startServer().catch(err => {
    console.error('Failed to start server:', err);
});
