import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import path from 'path';
import healthRouter from './routes/health.ts';
import prsRouter from './routes/prs.ts';
import editorRouter from './routes/editor.ts';
import opencodeRouter from './routes/opencode.ts';
import chatRouter from './routes/chat.ts';
import githubRouter from './routes/github.ts';

export function createApp() {
  const app = express();

  // Configure CORS with security restrictions
  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [
    'http://localhost:5173',  // Vite dev server
    'http://localhost:3000',  // Production server
  ];

  app.use(cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, Postman, etc.)
      if (!origin) {
        return callback(null, true);
      }
      
      // Check if origin is in allowed list
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }));
  
  app.use(express.json());

  // Rate limiting for API endpoints
  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later',
    standardHeaders: true,
    legacyHeaders: false,
  });

  app.use('/api/', apiLimiter);

  // Stricter limit for expensive OpenCode operations
  const aiLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 20, // 20 AI requests per hour
    message: 'AI chat rate limit exceeded, please try again later',
    standardHeaders: true,
    legacyHeaders: false,
  });

  app.use('/api/opencode/', aiLimiter);

  // API routes
  app.use('/api/health', healthRouter);
  app.use('/api/prs', prsRouter);
  app.use('/api', editorRouter);
  app.use('/api/opencode', opencodeRouter);
  app.use('/api/chat', chatRouter);
  app.use('/api/github', githubRouter);

  // Serve static files from web package in production
  const webDistPath = path.join(import.meta.dir, '../../web/dist');
  
  // Check if dist exists
  const fs = require('fs');
  if (!fs.existsSync(webDistPath)) {
    console.warn('⚠️  Web app not built. Run: bun run build');
    console.warn('   API is still available at /api/*');
  }
  
  app.use(express.static(webDistPath));

  // SPA fallback - serve index.html for all non-API routes
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
      const indexPath = path.join(webDistPath, 'index.html');
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(503).send(`
          <h1>RPM - Setup Required</h1>
          <p>The web app hasn't been built yet.</p>
          <p>Please run: <code>bun run build</code> from the RPM directory.</p>
          <p>The API is available at <a href="/api/health">/api/health</a></p>
        `);
      }
    } else {
      res.status(404).json({ error: 'Not found' });
    }
  });

  // Global error handler (must be last middleware)
  app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Unhandled error:', err);
    
    const isDev = process.env.NODE_ENV !== 'production';
    const statusCode = (err as any).statusCode || 500;
    
    res.status(statusCode).json({
      error: err.message || 'Internal server error',
      ...(isDev && { 
        details: err.message,
        stack: err.stack 
      }),
    });
  });

  return app;
}

export function startExpressServer(port: number) {
  const app = createApp();
  const server = app.listen(port);
  return server;
}
