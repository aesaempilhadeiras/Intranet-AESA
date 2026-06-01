/**
 * dev-server.js — Servidor local para desenvolvimento
 * Serve os HTMLs da intranet via HTTP, resolvendo o problema do file://
 * 
 * USO:
 *   node dev-server.js
 *   Acesse: http://localhost:8080/login.html
 * 
 * EM PRODUÇÃO: não usar este arquivo — os HTMLs ficam no Host B (servidor web)
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8080;
const DIR = __dirname; // pasta onde está este arquivo

const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.pdf': 'application/pdf',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
};

const servidor = http.createServer((req, res) => {
    // CORS — permite chamadas ao servidor de produção 10.1.1.54:3000
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }

    // Rota raiz → login.html
    const urlPath = req.url === '/' ? '/login.html' : req.url.split('?')[0];
    const filePath = path.join(DIR, urlPath);
    const ext = path.extname(filePath).toLowerCase();

    // Segurança: não sair da pasta
    if (!filePath.startsWith(DIR)) {
        res.writeHead(403); res.end('Acesso negado'); return;
    }

    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
        fs.createReadStream(filePath).pipe(res);
    } else {
        res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`<h2>404 — Arquivo não encontrado</h2><p>${urlPath}</p>`);
    }
});

servidor.listen(PORT, () => {
    console.log('');
    console.log('  ✅ Servidor local AESA rodando!');
    console.log(`  🌐 Acesse: http://localhost:${PORT}/login.html`);
    console.log('');
    console.log('  ℹ️  Use este servidor apenas para desenvolvimento.');
    console.log('     Em produção, os HTMLs ficam no Host B (servidor web).');
    console.log('');
    console.log('  Pressione CTRL+C para parar.');
    console.log('');
});