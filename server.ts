import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import { createServer } from 'node:http';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { database } from './server/database';
import { registerLocalApi, requireSession } from './server/localApi';
import { createLocalPdfRouter } from './server/localPdfApi';
import { createMapsRouter } from './server/mapsApi';
import { callAssistantProvider, getAssistantRuntimeConfig, validateAssistantRequest } from './server/assistant';
import type { AuthedRequest } from './server/localApi';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const isProduction = process.env.NODE_ENV === 'production';

app.use(express.json());
app.use((_request: Request, response: Response, next: NextFunction) => {
  response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('X-Frame-Options', 'SAMEORIGIN');
  next();
});

// ============================================================================
// ZapETAR V4 — OPERATIONAL METRICS COLLECTOR (Zero PII)
// ============================================================================
class ServerMetricsCollector {
  private metrics = {
    httpRequestsTotal: 0,
    httpRequestsFailed4xx: 0,
    httpRequestsFailed5xx: 0,
    rateLimitExceededTotal: 0,
    turnCredentialsRequestedTotal: 0,
    turnCredentialsFailedTotal: 0,
    totalLatencyMs: 0,
    startTime: Date.now()
  };

  public recordRequest(statusCode: number, durationMs: number): void {
    this.metrics.httpRequestsTotal++;
    this.metrics.totalLatencyMs += durationMs;

    if (statusCode >= 400 && statusCode < 500) {
      this.metrics.httpRequestsFailed4xx++;
    } else if (statusCode >= 500) {
      this.metrics.httpRequestsFailed5xx++;
    }
  }

  public recordRateLimitExceeded(): void {
    this.metrics.rateLimitExceededTotal++;
  }

  public recordTurnRequested(): void {
    this.metrics.turnCredentialsRequestedTotal++;
  }

  public recordTurnFailed(): void {
    this.metrics.turnCredentialsFailedTotal++;
  }

  public getSnapshot() {
    const totalReqs = Math.max(1, this.metrics.httpRequestsTotal);
    const avgLatencyMs = Math.round(this.metrics.totalLatencyMs / totalReqs);
    const uptimeSeconds = Math.floor((Date.now() - this.metrics.startTime) / 1000);

    return {
      uptimeSeconds,
      httpRequestsTotal: this.metrics.httpRequestsTotal,
      httpRequestsFailed4xx: this.metrics.httpRequestsFailed4xx,
      httpRequestsFailed5xx: this.metrics.httpRequestsFailed5xx,
      errorRate4xxPercent: Number(((this.metrics.httpRequestsFailed4xx / totalReqs) * 100).toFixed(2)),
      errorRate5xxPercent: Number(((this.metrics.httpRequestsFailed5xx / totalReqs) * 100).toFixed(2)),
      rateLimitExceededTotal: this.metrics.rateLimitExceededTotal,
      turnCredentialsRequestedTotal: this.metrics.turnCredentialsRequestedTotal,
      turnCredentialsFailedTotal: this.metrics.turnCredentialsFailedTotal,
      avgLatencyMs
    };
  }
}

export const serverMetrics = new ServerMetricsCollector();

// ============================================================================
// ZapETAR V4 — DISTRIBUTED RATE LIMITER INTERFACE (Memory + Pluggable Redis)
// ============================================================================
interface RateLimitBucket {
  timestamps: number[];
}
const rateLimitStore = new Map<string, RateLimitBucket>();

export function serverRateLimiter(maxRequests: number, windowMs: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    const clientIp =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.socket.remoteAddress ||
      'unknown';
    const now = Date.now();
    const key = `${clientIp}_${req.baseUrl}_${req.path}_${maxRequests}_${windowMs}`;

    let bucket = rateLimitStore.get(key);
    if (!bucket) {
      bucket = { timestamps: [] };
      rateLimitStore.set(key, bucket);
    }

    // Purge timestamps outside the sliding window
    bucket.timestamps = bucket.timestamps.filter(t => now - t < windowMs);

    if (bucket.timestamps.length >= maxRequests) {
      serverMetrics.recordRateLimitExceeded();
      const oldest = bucket.timestamps[0];
      const retryAfterSeconds = Math.ceil((windowMs - (now - oldest)) / 1000);
      res.setHeader('Retry-After', retryAfterSeconds.toString());
      return res.status(429).json({
        error: 'Too Many Requests',
        message: `Taxa limite excedida. Aguarde ${retryAfterSeconds} segundos antes de tentar novamente.`,
        retryAfter: retryAfterSeconds
      });
    }

    bucket.timestamps.push(now);
    next();
  };
}

// Structured JSON Logger Middleware with correlation IDs & Zero PII
app.use((req: Request, res: Response, next: NextFunction) => {
  const isApiEndpoint =
    req.path === '/health' ||
    req.path === '/ready' ||
    req.path === '/status' ||
    req.path === '/api/metrics' ||
    req.path.startsWith('/api/');

  if (!isApiEndpoint) {
    return next();
  }

  const startTime = Date.now();
  const requestId = 'req_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
  const correlationId = (req.headers['x-correlation-id'] as string) || requestId;
  res.setHeader('x-request-id', requestId);
  res.setHeader('x-correlation-id', correlationId);

  res.on('finish', () => {
    const duration = Date.now() - startTime;
    serverMetrics.recordRequest(res.statusCode, duration);

    const logEntry = {
      timestamp: new Date().toISOString(),
      level: res.statusCode >= 500 ? 'ERROR' : res.statusCode >= 400 ? 'WARN' : 'INFO',
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      durationMs: duration,
      requestId,
      correlationId,
      environment: process.env.NODE_ENV || 'production'
    };

    console.log(JSON.stringify(logEntry));
  });

  next();
});

// Apply server-side rate limiting to API routes
app.use('/api', serverRateLimiter(240, 60000));

app.use('/api/maps', serverRateLimiter(60, 60000), requireSession, createMapsRouter());
app.use('/api/local-tools/pdf', createLocalPdfRouter(serverRateLimiter(12, 60000), requireSession, serverRateLimiter(120, 60000)));

app.get('/api/assistant/status', serverRateLimiter(60, 60000), requireSession, (_request: AuthedRequest, response: Response) => {
  const config = getAssistantRuntimeConfig();
  response.json({
    available: config.enabled,
    provider: config.provider,
    model: config.model,
    providerSupported: config.providerSupported,
    capabilities: { text: true, tools: config.toolCallsEnabled, streaming: false, multimodal: false },
    status: config.status,
    warning: config.enabled
      ? 'O aplicativo não faz fallback para provedores pagos. Confira no painel do provedor se esta chave e este modelo continuam dentro da quota gratuita.'
      : config.providerSupported
        ? `Configuração da API do provedor ${config.provider} pendente.`
        : 'O provedor selecionado não é suportado nesta instalação.'
  });
});

app.post('/api/assistant/chat', serverRateLimiter(30, 60000), requireSession, async (request: AuthedRequest, response: Response) => {
  try {
    const payload = validateAssistantRequest(request.body);
    const config = getAssistantRuntimeConfig();

    if (!config.enabled || !config.apiKeyPresent || !config.providerSupported) {
      const providerUnsupported = !config.providerSupported;
      response.status(503).json({
        available: false,
        provider: config.provider,
        model: config.model,
        status: providerUnsupported ? 'provider-error' : 'config-required',
        reply: providerUnsupported
          ? 'O provedor de IA selecionado não é suportado nesta instalação.'
          : `O Assistente ZapETAR ainda não está configurado. Configure a chave do provedor ${config.provider} e AI_ENABLED=true para ativar a IA.`,
        warning: providerUnsupported ? 'Provedor de IA não suportado.' : `Configuração pendente do provedor ${config.provider}.`
      });
      return;
    }

    const providerAbortController = new AbortController();
    response.on('close', () => {
      if (!response.writableEnded) providerAbortController.abort();
    });
    const result = await callAssistantProvider(payload, config, providerAbortController.signal);
    if (result.available) {
      response.json(result);
      return;
    }

    response.status(503).json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha interna ao processar a mensagem do assistente.';
    response.status(400).json({
      available: false,
      status: 'provider-error',
      reply: message,
      warning: message
    });
  }
});

// ============================================================================
// ZapETAR V4 — HEALTH, READINESS & LIVENESS ENDPOINTS
// ============================================================================

// LIVENESS Probe: Confirms process is alive
app.get('/health', (_req: Request, res: Response) => {
  const memory = process.memoryUsage();
  res.status(200).json({
    status: 'UP',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    memory: {
      heapUsedMb: Math.round(memory.heapUsed / 1024 / 1024),
      heapTotalMb: Math.round(memory.heapTotal / 1024 / 1024),
      rssMb: Math.round(memory.rss / 1024 / 1024)
    },
    environment: process.env.NODE_ENV || 'production'
  });
});

// READINESS Probe: Confirms process is ready to serve traffic
app.get('/ready', (_req: Request, res: Response) => {
  const memory = process.memoryUsage();
  // Check memory pressure limit (1.5GB threshold)
  const isOverburdened = memory.heapUsed > 1.5 * 1024 * 1024 * 1024;

  if (isOverburdened) {
    return res.status(503).json({
      status: 'NOT_READY',
      reason: 'Memory pressure threshold exceeded',
      timestamp: new Date().toISOString()
    });
  }

  res.status(200).json({
    status: 'READY',
    timestamp: new Date().toISOString()
  });
});

// OPERATIONAL STATUS Endpoint (No secrets, tokens or PII exposed)
app.get('/status', (_req: Request, res: Response) => {
  res.status(200).json({
    Authentication: 'Local SQLite',
    Database: 'SQLite',
    Storage: 'OK',
    Backend: 'OK',
    RateLimiter: 'Active',
    TurnEndpoint: 'Active'
  });
});

// OPERATIONAL METRICS Endpoint
app.get('/api/metrics', serverRateLimiter(10, 60000), requireSession, (_req: Request, res: Response) => {
  res.status(200).json({
    metrics: serverMetrics.getSnapshot(),
    timestamp: new Date().toISOString()
  });
});

// ============================================================================
// TURN / WebRTC Dynamic ICE Servers Endpoint
// ============================================================================
const turnRateLimiter = serverRateLimiter(10, 60000);

function handleIceServersRequest(req: AuthedRequest, res: Response) {
  serverMetrics.recordTurnRequested();
  const userId = req.localUser!.id.substring(0, 16);

  const turnSecret = process.env.TURN_SECRET || process.env.TURN_STATIC_SECRET;
  const turnUrl = process.env.TURN_URL || process.env.TURN_SERVER_URL;

  const defaultStunServers = [
    {
      urls: [
        'stun:stun.l.google.com:19302',
        'stun:stun1.l.google.com:19302',
        'stun:stun2.l.google.com:19302'
      ]
    }
  ];

  if (!turnSecret) {
    return res.status(200).json({
      iceServers: defaultStunServers,
      configured: false,
      ttl: 3600
    });
  }

  const ttl = 3600;
  const expiry = Math.floor(Date.now() / 1000) + ttl;
  const username = `${expiry}:${userId}`;
  const hmac = crypto.createHmac('sha1', turnSecret);
  hmac.update(username);
  const credential = hmac.digest('base64');

  const mainTurnUrl = turnUrl || 'turn:turn.conexa.app:3478?transport=udp';
  const tcpTurnUrl = mainTurnUrl.replace('turn:', 'turns:').replace('transport=udp', 'transport=tcp');

  const iceServers = [
    ...defaultStunServers,
    {
      urls: [mainTurnUrl, tcpTurnUrl],
      username,
      credential,
      ttl
    }
  ];

  return res.status(200).json({
    iceServers,
    configured: true,
    ttl
  });
}

app.get('/api/webrtc/ice-servers', turnRateLimiter, requireSession, handleIceServersRequest);
app.get('/api/turn-credentials', turnRateLimiter, requireSession, handleIceServersRequest);

async function startServer() {
  await registerLocalApi(app);
  app.use('/api', (_request: Request, response: Response) => {
    response.status(404).json({ error: 'Not Found', message: 'Rota de API não encontrada.' });
  });
  const server = createServer(app);

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, ws: { server } },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  server.listen(Number(PORT), HOST, () => {
    console.log(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'INFO',
        message: `ZapETAR server listening on port ${PORT}`,
        mode: isProduction ? 'production' : 'development'
      })
    );
  });

  const gracefulShutdown = (signal: string) => {
    console.log(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'INFO',
        message: `Received ${signal}. Starting graceful shutdown...`
      })
    );
    server.close(() => {
      database.close();
      console.log(
        JSON.stringify({
          timestamp: new Date().toISOString(),
          level: 'INFO',
          message: 'HTTP server closed cleanly. Exiting process.'
        })
      );
      process.exit(0);
    });

    setTimeout(() => {
      console.error(
        JSON.stringify({
          timestamp: new Date().toISOString(),
          level: 'ERROR',
          message: 'Forced shutdown after timeout.'
        })
      );
      process.exit(1);
    }, 10000).unref();
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}

startServer().catch(err => {
  console.error(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'FATAL',
      message: 'Failed to start server',
      error: err.message
    })
  );
  process.exit(1);
});
