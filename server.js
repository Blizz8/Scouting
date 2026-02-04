const http = require('http');
const fs = require('fs');
const path = require('path');

const PUBLIC_DIR = __dirname;
const PORT = process.env.PORT || 8080;

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8'
};

function safeJoin(base, target) {
  const targetPath = '.' + path.posix.normalize('/' + target);
  return path.join(base, targetPath);
}

// Simple persistent storage and SSE support
const STORAGE_FILE = path.join(__dirname, 'storage.json');
let GLOBAL_STORAGE = {};
let sseClients = [];

// load storage on startup
try {
  if (fs.existsSync(STORAGE_FILE)) {
    const raw = fs.readFileSync(STORAGE_FILE, 'utf8');
    GLOBAL_STORAGE = JSON.parse(raw || '{}');
  }
} catch (e) {
  console.error('Failed to load storage.json', e);
}

function saveStorage() {
  try {
    fs.writeFileSync(STORAGE_FILE, JSON.stringify(GLOBAL_STORAGE, null, 2), 'utf8');
  } catch (e) {
    console.error('Failed to persist storage.json', e);
  }
}

function broadcastUpdate(key, value) {
  const payload = JSON.stringify({ key, value });
  sseClients.forEach(res => {
    try {
      res.write(`data: ${payload}\n\n`);
    } catch (e) {}
  });
}

const server = http.createServer((req, res) => {
  try {
    const urlPath = decodeURI(req.url.split('?')[0]);

    // API: list or key-based storage
    if (urlPath === '/api/storage' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(GLOBAL_STORAGE));
      return;
    }

    if (urlPath.startsWith('/api/storage/') ) {
      const key = decodeURIComponent(urlPath.slice('/api/storage/'.length));
      if (req.method === 'GET') {
        if (!(key in GLOBAL_STORAGE)) { res.writeHead(404); res.end('Not found'); return; }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(GLOBAL_STORAGE[key]));
        return;
      }

      if (req.method === 'PUT' || req.method === 'POST') {
        let body = '';
        req.on('data', ch => { body += ch; });
        req.on('end', () => {
          try {
            const value = JSON.parse(body);
            GLOBAL_STORAGE[key] = value;
            saveStorage();
            broadcastUpdate(key, value);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ key, value }));
          } catch (e) { res.writeHead(400); res.end('Invalid JSON'); }
        });
        return;
      }

      if (req.method === 'DELETE') {
        if (key in GLOBAL_STORAGE) delete GLOBAL_STORAGE[key];
        saveStorage();
        broadcastUpdate(key, null);
        res.writeHead(200); res.end('OK');
        return;
      }
    }

    // Server-Sent Events for live updates
    if (urlPath === '/api/stream' && req.method === 'GET') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive'
      });
      res.write('\n');
      sseClients.push(res);

      // On connect, send current keys as events
      Object.keys(GLOBAL_STORAGE).forEach(k => {
        res.write(`data: ${JSON.stringify({ key: k, value: GLOBAL_STORAGE[k] })}\n\n`);
      });

      req.on('close', () => {
        sseClients = sseClients.filter(r => r !== res);
      });
      return;
    }

    let filePath = safeJoin(PUBLIC_DIR, urlPath);
    fs.stat(filePath, (err, stat) => {
      if (err) {
        // try index.html in case of root
        if (urlPath === '/' || urlPath === '') {
          filePath = path.join(PUBLIC_DIR, 'index.html');
          fs.readFile(filePath, (e, data) => {
            if (e) { res.writeHead(404); res.end('Not found'); return; }
            res.writeHead(200, { 'Content-Type': mime['.html'] });
            res.end(data);
          });
          return;
        }

        res.writeHead(404);
        res.end('Not found');
        return;
      }

      if (stat.isDirectory()) {
        const index = path.join(filePath, 'index.html');
        fs.readFile(index, (e, data) => {
          if (e) { res.writeHead(404); res.end('Not found'); return; }
          res.writeHead(200, { 'Content-Type': mime['.html'] });
          res.end(data);
        });
        return;
      }

      const ext = path.extname(filePath).toLowerCase();
      const type = mime[ext] || 'application/octet-stream';
      fs.readFile(filePath, (e, data) => {
        if (e) { res.writeHead(500); res.end('Server error'); return; }
        res.writeHead(200, { 'Content-Type': type });
        res.end(data);
      });
    });
  } catch (err) {
    res.writeHead(500);
    res.end('Server error');
  }
});

server.listen(PORT, () => {
  console.log(`Serving ${PUBLIC_DIR} at http://localhost:${PORT}`);
});
