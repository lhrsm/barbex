/**
 * BARBEX SUPABASE EDGE FUNCTIONS — SHARED TYPES & DTOs
 */

export type ErrorCode =
  | 'INVALID_REQUEST'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'INVALID_CREDENTIALS'
  | 'RATE_LIMITED'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'SERVICE_UNAVAILABLE'
  | 'INTERNAL_ERROR';

export interface EdgeSuccess<T = unknown> {
  ok: true;
  data: T;
  requestId?: string;
}

export interface EdgeFailure {
  ok: false;
  code: ErrorCode;
  error: string;
  requestId?: string;
}

export type EdgeResult<T = unknown> = EdgeSuccess<T> | EdgeFailure;

export interface UserContext {
  userId: string;
  email?: string;
  role?: string;
  tenantId?: string;
}

export interface IdempotencyRecord {
  eventId: string;
  eventType: string;
  processedAt: string;
  status: 'processing' | 'completed' | 'failed';
}
