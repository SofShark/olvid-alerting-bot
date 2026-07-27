// User data access. All `prisma.user.*` calls flow through this module
// so handlers stay declarative and the wire-facing shape is decided in
// exactly one place.
//
// Read methods split by audience:
//   - getAll()                     → client shape (User) — used by /api/users
//   - getByLogin / getByEmail /
//     getById / findFirstAdmin /
//     countAdmins                  → raw Prisma row — server-internal
//     (login needs passwordHash; delete needs the admin count; etc.)
//
// The client-shape mapping lives in server/utils/auth.ts (`toClientUser`) —
// referenced here for `getAll` only; every other server-internal caller
// applies it explicitly at the handler boundary.

import type { User as PrismaUser } from "@prisma/client";
import { prisma } from "../db/prisma";
import type { User, UserRole } from "#shared/types/user";
import { toClientUser } from "../utils/auth";

export interface CreateUserInput {
  login: string;
  email?: string | null;
  role: UserRole;
  passwordHash?: string | null;
  name?: string | null;
  activatedAt?: Date | null;
}

export interface UpdateUserInput {
  passwordHash?: string;
  name?: string | null;
  activatedAt?: Date | null;
  email?: string | null;
}

// Normalisation policy: logins and emails are compared case-insensitively.
// Store lowercase so the unique constraint catches "Alice" ≠ "alice"
// mismatches, and looking up either form finds the same row.
function normalise(s: string): string {
  return s.trim().toLowerCase();
}

export const userRepository = {
  /** Client-shape list. Sorted by id so the /users table is stable. */
  async getAll(): Promise<User[]> {
    const rows = await prisma.user.findMany({ orderBy: { id: "asc" } });
    return rows.map(toClientUser);
  },

  /** Sign-in lookup. `login` may be an email or a plain username — the
   *  DB column always holds the canonical identifier the user types. */
  async getByLogin(login: string): Promise<PrismaUser | null> {
    return prisma.user.findUnique({ where: { login: normalise(login) } });
  },

  /** Kept for callers that specifically address a row by its delivery
   *  email (invite reissue, admin-flow lookups). */
  async getByEmail(email: string): Promise<PrismaUser | null> {
    return prisma.user.findUnique({ where: { email: normalise(email) } });
  },

  async getById(id: number): Promise<PrismaUser | null> {
    return prisma.user.findUnique({ where: { id } });
  },

  /** First-run detection — the presence of any admin flips /setup off. */
  async findFirstAdmin(): Promise<PrismaUser | null> {
    return prisma.user.findFirst({ where: { role: "admin" } });
  },

  /** Guardrail for delete: refuse to remove the last admin. */
  async countAdmins(): Promise<number> {
    return prisma.user.count({ where: { role: "admin" } });
  },

  async create(input: CreateUserInput): Promise<PrismaUser> {
    return prisma.user.create({
      data: {
        login: normalise(input.login),
        email: input.email ? normalise(input.email) : null,
        role: input.role,
        passwordHash: input.passwordHash ?? null,
        name: input.name ?? null,
        activatedAt: input.activatedAt ?? null,
      },
    });
  },

  async update(id: number, patch: UpdateUserInput): Promise<PrismaUser> {
    const data: Record<string, unknown> = { ...patch };
    if (patch.email !== undefined) {
      data.email = patch.email ? normalise(patch.email) : null;
    }
    return prisma.user.update({ where: { id }, data });
  },

  async deleteById(id: number): Promise<void> {
    await prisma.user.delete({ where: { id } });
  },
};
