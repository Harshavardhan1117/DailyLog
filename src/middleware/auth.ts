import { Request, Response, NextFunction } from 'express';
import { adminAuth } from '../lib/firebase-admin.ts';
import { DecodedIdToken } from 'firebase-admin/auth';
import crypto from 'crypto';

export interface AuthRequest extends Request {
  user?: DecodedIdToken;
}

const SESSION_SECRET =
  process.env.SESSION_SECRET ||
  process.env.SQL_PASSWORD ||
  'daily-standup-log-secret-key-2026';

export interface SessionTokenPayload {
  uid: string;
  email: string;
  name: string;
  exp: number;
}

/**
 * Signs a lightweight HMAC-SHA256 session token for Email/Password authentication.
 */
export function signSessionToken(payload: {
  uid: string;
  email: string;
  name: string;
}): string {
  const tokenData: SessionTokenPayload = {
    ...payload,
    exp: Date.now() + 1000 * 60 * 60 * 24 * 7, // 7 days
  };
  const encoded = Buffer.from(JSON.stringify(tokenData)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(encoded)
    .digest('base64url');
  return `dsl.${encoded}.${signature}`;
}

/**
 * Verifies a backend-signed HMAC-SHA256 session token.
 */
export function verifySessionToken(token: string): SessionTokenPayload | null {
  if (!token.startsWith('dsl.')) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [, encoded, signature] = parts;
  const expectedSig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(encoded)
    .digest('base64url');
  if (signature !== expectedSig) return null;
  try {
    const payload = JSON.parse(
      Buffer.from(encoded, 'base64url').toString('utf8')
    ) as SessionTokenPayload;
    if (Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res
      .status(401)
      .json({ error: 'Unauthorized: Please log in to continue.' });
  }

  const token = authHeader.split('Bearer ')[1];

  // 1. Check if token is a signed session token (Email/Password or Direct Auth)
  const localPayload = verifySessionToken(token);
  if (localPayload) {
    req.user = {
      uid: localPayload.uid,
      email: localPayload.email,
      name: localPayload.name,
    } as any;
    return next();
  }

  // 2. Otherwise verify as a Firebase ID Token
  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    req.user = decodedToken;
    next();
  } catch (error) {
    console.error('Error verifying auth token:', error);
    return res
      .status(401)
      .json({ error: 'Unauthorized: Session expired or invalid.' });
  }
};
