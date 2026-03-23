import express from 'express';
import { onRequest } from 'firebase-functions/v2/https';
import { setGlobalOptions } from 'firebase-functions/v2';

import adminRoutes from './routes/admin.js';
import chatRoutes from './routes/chat.js';
import profileRoutes from './routes/profile.js';
import recordRoutes from './routes/record.js';
import sessionsRoutes from './routes/sessions.js';

setGlobalOptions({ maxInstances: 10 });

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));

app.use(profileRoutes);
app.use(recordRoutes);
app.use(chatRoutes);
app.use(sessionsRoutes);
app.use(adminRoutes);

app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

export const api = onRequest(
  {
    region: 'us-east1',
    secrets: ['OPENROUTER_API_KEY', 'ADMIN_PASSWORD'],
  },
  app
);
