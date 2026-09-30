import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createProxyMiddleware } from 'http-proxy-middleware';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3367;
const BACKEND_URL = process.env.BACKEND_URL || 'http://127.0.0.1:3365';

// Proxy /api requests to the Python Flask backend
app.use(
  createProxyMiddleware({
    pathFilter: '/api',
    target: BACKEND_URL,
    changeOrigin: true,
  })
);

// Serve static build files
const distPath = path.join(__dirname, 'dist');
app.use(express.static(distPath));

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`====================================================`);
  console.log(`  WoundCare Production Server running on port ${PORT}`);
  console.log(`  Frontend: http://localhost:${PORT}`);
  console.log(`  Proxying /api to: ${BACKEND_URL}`);
  console.log(`====================================================`);
});
