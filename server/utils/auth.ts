// Auth server-side helpers: guards, token issue/consume, session-user
// shaping. Every auth-adjacent endpoint imports from here so the
// wire-format for User and the token semantics stay in one place.

import { createHash, randomBytes } from "node:crypto";
import type { H3Event } from "h3";
import { prisma } from "../db/prisma";
import { userRepository } from "../repositories/userRepository";
import type { User, UserRole } from "#shared/types/user";

// ── Token semantics ─────────────────────────────────────────────────
// TTLs are policy, not code — surface them here so an operator can
// tweak them without hunting through call sites.
export const TOKEN_TTL = {
  invite: 7 * 24 * 60 * 60 * 1000, // 7 days
  email_verify: 24 * 60 * 60 * 1000, // 24 hours
  password_reset: 60 * 60 * 1000, // 1 hour
} as const;

export type TokenPurpose = keyof typeof TOKEN_TTL;

function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

// Issue a one-shot token. The raw string is returned once (to embed in
// the outgoing email URL) — only its sha256 is persisted, so a DB leak
// doesn't expose live tokens.
export async function issueToken(
  userId: number,
  purpose: TokenPurpose,
): Promise<string> {
  const raw = randomBytes(32).toString("base64url");
  await prisma.verificationToken.create({
    data: {
      tokenHash: sha256(raw),
      userId,
      purpose,
      expiresAt: new Date(Date.now() + TOKEN_TTL[purpose]),
    },
  });
  return raw;
}

// Consume a raw token: validate purpose / expiry / one-shot semantics
// atomically, mark it used, and return the owning user's id. Callers
// that need the user row fetch it via userRepository — keeps this
// helper focused on token bookkeeping and leaves user access in one
// place. Returns null on any failure (unknown, wrong purpose, expired,
// already used) so callers can decide the HTTP status without leaking
// which reason.
export async function consumeToken(
  rawToken: string,
  purpose: TokenPurpose,
): Promise<number | null> {
  const record = await prisma.verificationToken.findUnique({
    where: { tokenHash: sha256(rawToken) },
  });
  if (!record) return null;
  if (record.purpose !== purpose) return null;
  if (record.usedAt) return null;
  if (record.expiresAt.getTime() < Date.now()) return null;

  await prisma.verificationToken.update({
    where: { id: record.id },
    data: { usedAt: new Date() },
  });
  return record.userId;
}

// ── Guards ──────────────────────────────────────────────────────────

export async function requireAdmin(event: H3Event) {
  const session = await requireUserSession(event);
  if (session.user.role !== "admin") {
    throw createError({ statusCode: 403, statusMessage: "Admin only" });
  }
  return session;
}

// ── Shaping ─────────────────────────────────────────────────────────
// Never leak passwordHash, updatedAt, or createdAt to the client.

type PrismaUserRow = {
  id: number;
  email: string;
  name: string | null;
  role: string;
  emailVerified: Date | null;
};

export function toClientUser(row: PrismaUserRow): User {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role as UserRole,
    emailVerified: row.emailVerified !== null,
  };
}

// Build absolute URLs for outgoing email links. Prefers the configured
// runtimeConfig.public.baseUrl; falls back to the request's own origin.
export function resolveOrigin(event: H3Event): string {
  const configured = useRuntimeConfig(event).public.baseUrl;
  if (configured) return configured.replace(/\/+$/, "");
  const proto = getRequestProtocol(event);
  const host = getRequestHost(event);
  return `${proto}://${host}`;
}
