import type { APIGatewayProxyEvent } from 'aws-lambda';

interface MockApiEventOptions {
  method?: string;
  path?: string;
  body?: Record<string, unknown> | null;
  pathParameters?: Record<string, string> | null;
  queryStringParameters?: Record<string, string> | null;
  claims?: Record<string, string> | null;
}

export function createMockApiEvent(
  options: MockApiEventOptions = {},
): APIGatewayProxyEvent {
  const {
    method = 'GET',
    path = '/',
    body = null,
    pathParameters = null,
    queryStringParameters = null,
    claims = null,
  } = options;

  return {
    httpMethod: method,
    path,
    body: body ? JSON.stringify(body) : null,
    pathParameters,
    queryStringParameters,
    headers: {
      'Content-Type': 'application/json',
    },
    multiValueHeaders: {},
    isBase64Encoded: false,
    stageVariables: null,
    resource: '',
    multiValueQueryStringParameters: null,
    requestContext: {
      accountId: '123456789012',
      apiId: 'test-api',
      authorizer: claims
        ? { claims }
        : null,
      httpMethod: method,
      identity: {
        accessKey: null,
        accountId: null,
        apiKey: null,
        apiKeyId: null,
        caller: null,
        clientCert: null,
        cognitoAuthenticationProvider: null,
        cognitoAuthenticationType: null,
        cognitoIdentityId: null,
        cognitoIdentityPoolId: null,
        principalOrgId: null,
        sourceIp: '127.0.0.1',
        user: null,
        userAgent: 'test',
        userArn: null,
      },
      path,
      protocol: 'HTTP/1.1',
      requestId: 'test-request-id',
      requestTimeEpoch: Date.now(),
      resourceId: 'test-resource',
      resourcePath: path,
      stage: 'test',
    },
  } as APIGatewayProxyEvent;
}
