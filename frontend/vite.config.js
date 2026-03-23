import { defineConfig, loadEnv } from 'vite';

function normalizeBackendUrl(raw) {
  try {
    const url = new URL((raw || 'https://healthcoach-bidmc.web.app').replace(/\/$/, ''));
    return url.toString().replace(/\/$/, '');
  } catch {
    return 'https://healthcoach-bidmc.web.app';
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const backend = normalizeBackendUrl(env.BACKEND_URL);

  const apiProxy = {
    '/api': {
      target: backend,
      changeOrigin: true,
      configure(proxy) {
        proxy.on('error', (err, _req, res) => {
          console.error(
            `[vite proxy] ${err.code || err.message} -> is the Firebase backend reachable at ${backend}?`
          );
          if (!res || res.writableEnded) return;
          try {
            if (!res.headersSent) {
              res.writeHead(502, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Backend unreachable', hint: `Check BACKEND_URL (${backend})` }));
            }
          } catch (_) {}
        });
      },
    },
  };

  return {
    root: '.',
    build: {
      outDir: 'dist',
      emptyOutDir: true,
    },
    server: {
      port: 5173,
      proxy: apiProxy,
    },
    preview: {
      proxy: apiProxy,
    },
  };
});
