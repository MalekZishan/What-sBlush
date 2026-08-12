import { Request, Response, NextFunction } from 'express';
import Boom from '@hapi/boom';
import { logger } from '../config/logger';
import { env } from '../config/env';
import { ZodError } from 'zod';

interface ApiError extends Error {
  status?: number;
  statusCode?: number;
  isBoom?: boolean;
  output?: {
    statusCode: number;
    payload: {
      error: string;
      message: string;
    };
  };
}

export function errorHandler(err: ApiError, req: Request, res: Response, next: NextFunction): void {
  // Already sent response
  if (res.headersSent) {
    next(err);
    return;
  }

  // Zod validation error
  if (err instanceof ZodError) {
    res.status(400).json({
      success: false,
      error: 'Validation Error',
      details: err.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
    });
    return;
  }

  // Boom HTTP errors (structured)
  if (err.isBoom && err.output) {
    const { statusCode, payload } = err.output;
    logger.warn('HTTP error', { statusCode, message: payload.message, path: req.path });
    res.status(statusCode).json({
      success: false,
      error: payload.error,
      message: payload.message,
    });
    return;
  }

  // Mongoose duplicate key
  if ((err as any).code === 11000) {
    const field = Object.keys((err as any).keyValue ?? {})[0];
    res.status(409).json({
      success: false,
      error: 'Conflict',
      message: `${field} already exists`,
    });
    return;
  }

  // Mongoose validation errors
  if (err.name === 'ValidationError') {
    res.status(400).json({
      success: false,
      error: 'Validation Error',
      message: err.message,
    });
    return;
  }

  // Log unexpected errors
  logger.error('Unhandled error', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  const statusCode = err.status ?? err.statusCode ?? 500;
  res.status(statusCode).json({
    success: false,
    error: err.name || 'Internal Server Error',
    message: err.message || 'An unexpected error occurred',
  });
}

// 404 handler
export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`,
  });
}
