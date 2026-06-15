// ═══════════════════════════════════════════════════════════════
// Auth Guard — Role-based access control for routes and components
//
// Enforces:
//   - Route protection based on roles[] on RouteSchema
//   - Component visibility based on requiredRoles[] on ComponentSchema
//   - Redirect to login when unauthenticated
// ═══════════════════════════════════════════════════════════════

import type { RouteSchema, ComponentSchema } from "./schema";
import type { StateEngine } from "./state";

// ── Types ────────────────────────────────────────────────────

export interface AuthCheckResult {
  allowed: boolean;
  reason?: "unauthenticated" | "insufficient_role" | "condition_failed";
  redirectTo?: string;
  userRole?: string;
}

export interface AuthGuardConfig {
  userStatePath?: string;      // Default: "user"
  roleField?: string;          // Default: "role"
  loginRoute?: string;         // Default: "/login"
  unauthorizedRoute?: string;  // Default: "/login"
}

const DEFAULT_CONFIG: Required<AuthGuardConfig> = {
  userStatePath: "user",
  roleField: "role",
  loginRoute: "/login",
  unauthorizedRoute: "/login",
};

// ── Auth Guard ───────────────────────────────────────────────

export class AuthGuard {
  private config: Required<AuthGuardConfig>;
  private state: StateEngine;

  constructor(state: StateEngine, config?: AuthGuardConfig) {
    this.state = state;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /** Get current user from state */
  private getUser(): Record<string, unknown> | null {
    const user = this.state.get(this.config.userStatePath);
    if (!user || typeof user !== "object") return null;
    const userObj = user as Record<string, unknown>;
    // Check if user has an ID (is authenticated)
    if (!userObj.id || userObj.id === "") return null;
    return userObj;
  }

  /** Get current user's role */
  getUserRole(): string | null {
    const user = this.getUser();
    if (!user) return null;
    return String(user[this.config.roleField] || "");
  }

  /** Check if user is authenticated */
  isAuthenticated(): boolean {
    return this.getUser() !== null;
  }

  /** Check if user has one of the required roles */
  hasRole(requiredRoles: string[]): boolean {
    if (!requiredRoles.length) return true;
    const role = this.getUserRole();
    if (!role) return false;
    return requiredRoles.includes(role);
  }

  /** Check route access */
  checkRouteAccess(route: RouteSchema): AuthCheckResult {
    const userRole = this.getUserRole();

    // Route requires authentication
    if (route.auth) {
      if (!this.isAuthenticated()) {
        return {
          allowed: false,
          reason: "unauthenticated",
          redirectTo: this.config.loginRoute,
        };
      }
    }

    // Route requires specific roles
    if (route.roles?.length) {
      if (!this.isAuthenticated()) {
        return {
          allowed: false,
          reason: "unauthenticated",
          redirectTo: this.config.loginRoute,
        };
      }
      if (!this.hasRole(route.roles)) {
        return {
          allowed: false,
          reason: "insufficient_role",
          redirectTo: this.config.unauthorizedRoute,
          userRole: userRole || undefined,
        };
      }
    }

    return { allowed: true, userRole: userRole || undefined };
  }

  /** Check component visibility based on requiredRoles */
  checkComponentAccess(component: ComponentSchema): boolean {
    if (!component.requiredRoles?.length) return true;
    return this.hasRole(component.requiredRoles);
  }

  /** Check multiple permissions at once */
  checkPermissions(permissions: {
    roles?: string[];
    auth?: boolean;
    condition?: string;
  }): AuthCheckResult {
    if (permissions.auth && !this.isAuthenticated()) {
      return { allowed: false, reason: "unauthenticated", redirectTo: this.config.loginRoute };
    }
    if (permissions.roles?.length && !this.hasRole(permissions.roles)) {
      return {
        allowed: false,
        reason: "insufficient_role",
        redirectTo: this.config.unauthorizedRoute,
        userRole: this.getUserRole() || undefined,
      };
    }
    return { allowed: true, userRole: this.getUserRole() || undefined };
  }
}

// ── Helper Functions ─────────────────────────────────────────

/** Quick check: is user role in allowed list? */
export function isRoleAllowed(
  userRole: string | null | undefined,
  allowedRoles: string[]
): boolean {
  if (!allowedRoles.length) return true;
  if (!userRole) return false;
  return allowedRoles.includes(userRole);
}

/** Filter navigation items by role */
export function filterNavByRole<T extends { roles?: string[] }>(
  items: T[],
  userRole: string | null | undefined
): T[] {
  return items.filter((item) => {
    if (!item.roles?.length) return true;
    return userRole ? item.roles.includes(userRole) : false;
  });
}
