import * as http from 'node:http';
import { loadCharts, uniquePorts } from '../lib/charts';

const INDEX_HTML =
  '<!doctype html><html><head><title>quickapp stub</title></head>' +
  '<body><h1 id="app">quickapp stub</h1>' +
  '<script src="/remoteEntry.js"></script></body></html>';

const REMOTE_ENTRY = 'window.__remoteEntryLoaded = true;\n';

const charts = loadCharts();
const byPort = new Map(charts.map((c) => [c.healthPort, c]));

function handler(req: http.IncomingMessage, res: http.ServerResponse): void {
  const port = req.socket.localPort ?? 0;
  const chart = byPort.get(port);
  const url = new URL(req.url ?? '/', 'http://localhost');
  const pathname = url.pathname;

  if (pathname === (chart?.healthPath ?? '/healthz') || pathname === '/healthz') {
    res.writeHead(200, { 'content-type': 'text/plain' });
    res.end('ok');
    return;
  }
  if (pathname === '/') {
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end(INDEX_HTML);
    return;
  }
  if (pathname === '/remoteEntry.js') {
    res.writeHead(200, { 'content-type': 'application/javascript' });
    res.end(REMOTE_ENTRY);
    return;
  }
  if (pathname.startsWith('/api/')) {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end('[]');
    return;
  }
  res.writeHead(404, { 'content-type': 'text/plain' });
  res.end('not found');
}

const servers: http.Server[] = [];

for (const port of uniquePorts(charts)) {
  const server = http.createServer(handler);
  server.listen(port, () => {
    process.stdout.write(`stub listening on port ${port}\n`);
  });
  servers.push(server);
}

function shutdown(): void {
  for (const server of servers) {
    server.close();
  }
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
