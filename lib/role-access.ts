import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import type { Role } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import {
  hasRequiredRole as hasRequiredRoleLogic,
  getRoleHomeRoute as getRoleHomeRouteLogic,
  resolvePostAuthRedirect as resolvePostAuthRedirectLogic,
} from './role-access-logic';

export const hasRequiredRole = hasRequiredRoleLogic;
export const getRoleHomeRoute = getRoleHomeRouteLogic;
export const resolvePostAuthRedirect = resolvePostAuthRedirectLogic;

export type AppRole = Role;

export async function getCurrentAppUser() {
  const { userId } = await auth();

  if (!userId) {
    return null;
  }

  return prisma.user.findUnique({
    where: {
      clerkId: userId,
    },
  });
}

export async function requireRole(allowedRoles: Array<Role | string>) {
  const { userId } = await auth();

  if (!userId) {
    redirect('/sign-in');
  }

  const user = await prisma.user.findUnique({
    where: {
      clerkId: userId,
    },
  });

  if (!user) {
    redirect('/onboarding');
  }

  if (!hasRequiredRole(user.rol, allowedRoles)) {
    redirect('/acceso-denegado');
  }

  return user;
}
