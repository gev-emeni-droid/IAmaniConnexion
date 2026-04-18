import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
// import { getRequestListener } from '@hono/node-server';
import { config as loadEnv } from 'dotenv';
import app from './src/server/app.ts';

// Load local overrides first, then fallback to .env.
loadEnv({ path: '.env.local' });
loadEnv();

async function startServer() {
    const server = express();
    const PORT = 3000;
    // const requestListener = getRequestListener(app.fetch);
    
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
