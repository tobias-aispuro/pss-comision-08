import type { Role } from '@prisma/client';

export type AppRole = Role;

export function hasRequiredRole(userRole: Role | string | null | undefined, allowedRoles: Array<Role | string>) {
  if (!userRole) return false;

  return allowedRoles.includes(userRole as Role);
}

export function getRoleHomeRoute(role?: Role | string | null) {
  switch (role) {
    case 'ADMINISTRADOR':
      return '/admin';
    case 'EMPLEADO_MOSTRADOR':
      return '/empleado';
    case 'PASAJERO':
    default:
      return '/pasajero';
  }
}

export function resolvePostAuthRedirect(role?: Role | string | null) {
  if (!role) {
    return '/onboarding';
  }

  return getRoleHomeRoute(role);
}
