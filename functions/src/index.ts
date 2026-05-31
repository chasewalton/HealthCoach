import express from 'express';
import { onRequest } from 'firebase-functions/v2/https';
import { setGlobalOptions } from 'firebase-functions/v2';

import adminRoutes from './routes/admin.js';
import chatRoutes from './routes/chat.js';
import feedbackRoutes from './routes/feedback.js';
import profileRoutes from './routes/profile.js';
import recordRoutes from './routes/record.js';
import sessionsRoutes from './routes/sessions.js';
import transcribeRoutes from './routes/transcribe.js';

// This project cannot use an allUsers IAM binding under the current
// organization policy. Invoker permissions are managed out-of-band (e.g. via
// gcloud run services add-iam-policy-binding) and preserveExternalChanges
// keeps deploys from clobbering those bindings.
setGlobalOptions({ maxInstances: 10, preserveExternalChanges: true });

const app = express();
app.disable('x-powered-by');

// Transcribe receives binary audio bodies, so it must be registered BEFORE
// express.json() to avoid the JSON parser fighting over the request stream.
app.use(transcribeRoutes);

app.use(express.json({ limit: '1mb' }));

app.use(profileRoutes);
app.use(recordRoutes);
app.use(chatRoutes);
app.use(sessionsRoutes);
app.use(feedbackRoutes);
app.use(adminRoutes);

app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

export const api = onRequest(
  {
    region: 'us-east1',
    secrets: ['OPENROUTER_API_KEY', 'OPENAI_API_KEY', 'ADMIN_PASSWORD'],
  },
  app
);
