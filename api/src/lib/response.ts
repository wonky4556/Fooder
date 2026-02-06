import type { APIGatewayProxyResult } from 'aws-lambda';
import type { AppError } from './errors.js';

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
};

export function success<T>(data: T, statusCode = 200): APIGatewayProxyResult {
  return {
    statusCode,
    headers: CORS_HEADERS,
    body: JSON.stringify({ data }),
  };
}

export function error(err: AppError): APIGatewayProxyResult {
  return {
    statusCode: err.statusCode,
    headers: CORS_HEADERS,
    body: JSON.stringify({
      error: {
        code: err.code,
        message: err.message,
      },
    }),
  };
}
