import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname, normalize } from 'node:path';
import relayHandler from '../api/relay.js';
const PORT = Number(process.env.PORT || 3000);
const DIST = join(import.meta.dirname, '..', '..', 'dist');
const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json',
    '.webmanifest': 'application/manifest+json',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.ico': 'image/x-icon',
    '.woff2': 'font/woff2',
    '.txt': 'text/plain; charset=utf-8',
};
function mimeFor(path) {
    return MIME[extname(path).toLowerCase()] || 'application/octet-stream';
}
async function serveStatic(req, res) {
    let pathname = decodeURIComponent(new URL(req.url || '/', 'http://localhost').pathname);
    if (pathname === '/')
        pathname = '/index.html';
    const filePath = normalize(join(DIST, pathname));
    if (!filePath.startsWith(DIST)) {
        res.statusCode = 403;
        res.end('Forbidden');
        return;
    }
    try {
        const body = await readFile(filePath);
        res.setHeader('Content-Type', mimeFor(filePath));
        res.setHeader('Cache-Control', pathname === '/index.html' ? 'no-cache' : 'public, max-age=31536000, immutable');
        res.end(body);
    }
    catch {
        const index = await readFile(join(DIST, 'index.html')).catch(() => null);
        if (!index) {
            res.statusCode = 404;
            res.end('Not Found');
            return;
        }
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache');
        res.end(index);
    }
}
function vercelLikeReq(req) {
    const url = new URL(req.url || '/', `http://localhost:${PORT}`);
    const query = {};
    url.searchParams.forEach((value, key) => {
        query[key] = value;
    });
    return {
        method: req.method,
        query,
        headers: req.headers,
        url: req.url,
    };
}
function vercelLikeRes(res) {
    const shim = Object.create(res);
    shim.status = (code) => {
        res.statusCode = code;
        return shim;
    };
    shim.send = (body) => {
        res.end(body);
    };
    shim.json = (body) => {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(body));
    };
    return shim;
}
const server = createServer(async (req, res) => {
    const pathname = new URL(req.url || '/', `http://localhost:${PORT}`).pathname;
    if (pathname === '/api/relay') {
        await relayHandler(vercelLikeReq(req), vercelLikeRes(res));
        return;
    }
    if (req.method === 'GET' || req.method === 'HEAD') {
        await serveStatic(req, res);
        return;
    }
    res.statusCode = 405;
    res.end('Method not allowed');
});
server.listen(PORT, () => {
    console.log(`SCRP Music listening on http://localhost:${PORT}`);
    console.log(`Static assets: ${DIST}`);
});
