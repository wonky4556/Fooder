import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';

export const handler = async (
  _event: APIGatewayProxyEvent,
  _context: Context,
): Promise<APIGatewayProxyResult> => ({
  statusCode: 501,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ error: { code: 'NOT_IMPLEMENTED', message: 'Not implemented' } }),
});
