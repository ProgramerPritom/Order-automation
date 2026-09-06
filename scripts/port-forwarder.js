const http = require('http');

const PORT = 3001;
const TARGET_PORT = 3000;

const server = http.createServer((req, res) => {
  const targetUrl = `http://localhost:${TARGET_PORT}${req.url}`;
  console.log(`[PortForwarder] Forwarding ${req.method} ${req.url} -> ${targetUrl}`);
  res.writeHead(307, {
    Location: targetUrl,
    'Access-Control-Allow-Origin': '*',
  });
  res.end(`Redirecting to ${targetUrl}`);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Port forwarder running on http://localhost:${PORT} -> forwarding to port ${TARGET_PORT}`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.log(`Port ${PORT} already in use, forwarder exiting peacefully.`);
  } else {
    console.error('Forwarder error:', err);
  }
});
