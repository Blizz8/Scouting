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

const server = http.createServer((req, res) => {
  try {
    const urlPath = decodeURI(req.url.split('?')[0]);
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
