// User data access. All `prisma.user.*` calls flow through this module
// so handlers stay declarative and the wire-facing shape is decided in
// exactly one place.
//
// Read methods split by audience:
//   - getAll()                     → client shape (User) — used by /api/users
//   - getByEmail / getById /
//     findFirstAdmin / countAdmins → raw Prisma row — server-internal
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
  email: string;
  role: UserRole;
  passwordHash?: string | null;
  name?: string | null;
  emailVerified?: Date | null;
}

export interface UpdateUserInput {
  passwordHash?: string;
  name?: string | null;
  emailVerified?: Date | null;
}

export const userRepository = {
  /** Client-shape list. Sorted by id so the /users table is stable. */
  async getAll(): Promise<User[]> {
    const rows = await prisma.user.findMany({ orderBy: { id: "asc" } });
    return rows.map(toClientUser);
  },

  /** Raw row (login needs passwordHash). Email is normalised here so
   *  callers don't have to remember. */
  async getByEmail(email: string): Promise<PrismaUser | null> {
    return prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });
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
        email: input.email.toLowerCase(),
        role: input.role,
        passwordHash: input.passwordHash ?? null,
        name: input.name ?? null,
        emailVerified: input.emailVerified ?? null,
      },
    });
  },

  async update(id: number, patch: UpdateUserInput): Promise<PrismaUser> {
    return prisma.user.update({ where: { id }, data: patch });
  },

  async deleteById(id: number): Promise<void> {
    await prisma.user.delete({ where: { id } });
  },
};
