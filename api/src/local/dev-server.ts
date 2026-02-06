import express from 'express';
import cors from 'cors';
import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { handler as getMeHandler } from '../handlers/auth/getMe.js';

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

function decodeJwtPayload(token: string): Record<string, unknown> {
  const payload = token.split('.')[1];
  if (!payload) return {};
  return JSON.parse(Buffer.from(payload, 'base64url').toString());
}

function toApiGatewayEvent(req: express.Request): APIGatewayProxyEvent {
  let claims: Record<string, string> | undefined;

  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    const decoded = decodeJwtPayload(authHeader.slice(7));
    claims = Object.fromEntries(
      Object.entries(decoded).map(([k, v]) => [k, String(v)]),
    );
  }

  return {
    httpMethod: req.method,
    path: req.path,
    headers: req.headers as Record<string, string>,
    multiValueHeaders: {},
    queryStringParameters: (Object.keys(req.query).length > 0 ? req.query : null) as Record<string, string> | null,
    multiValueQueryStringParameters: null,
    pathParameters: Object.keys(req.params).length > 0 ? req.params : null,
    stageVariables: null,
    body: req.body && Object.keys(req.body as object).length > 0 ? JSON.stringify(req.body) : null,
    isBase64Encoded: false,
    resource: req.path,
    requestContext: {
      authorizer: claims ? { claims } : null,
      accountId: 'local',
      apiId: 'local',
      httpMethod: req.method,
      identity: {} as APIGatewayProxyEvent['requestContext']['identity'],
      path: req.path,
      protocol: 'HTTP/1.1',
      requestId: crypto.randomUUID(),
      requestTimeEpoch: Date.now(),
      resourceId: 'local',
      resourcePath: req.path,
      stage: 'local',
    },
  };
}

function sendLambdaResponse(res: express.Response, result: APIGatewayProxyResult): void {
  if (result.headers) {
    for (const [key, value] of Object.entries(result.headers)) {
      if (key.toLowerCase() !== 'access-control-allow-origin') {
        res.setHeader(key, String(value));
      }
    }
  }
  res.status(result.statusCode);
  if (result.body) {
    res.setHeader('Content-Type', 'application/json');
    res.send(result.body);
  } else {
    res.end();
  }
}

type LambdaHandler = (event: APIGatewayProxyEvent, context: Context) => Promise<APIGatewayProxyResult>;

function lambdaRoute(handler: LambdaHandler): express.RequestHandler {
  return async (req, res, next) => {
    try {
      const event = toApiGatewayEvent(req);
      const result = await handler(event, {} as Context);
      sendLambdaResponse(res, result);
    } catch (err) {
      next(err);
    }
  };
}

// Routes
app.get('/api/me', lambdaRoute(getMeHandler));

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Local API server running on http://localhost:${PORT}`);
  console.log(`USERS_TABLE_NAME: ${process.env.USERS_TABLE_NAME || '(not set)'}`);
  console.log(`PII_KEY_ARN: ${process.env.PII_KEY_ARN ? '***' : '(not set)'}`);
});
