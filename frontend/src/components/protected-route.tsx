import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";

type RoleType =
  | "PLATFORM_ADMIN"
  | "TENANT_OWNER"
  | "TENANT_ADMIN"
  | "ACCOUNT_OWNER"
  | "ACCOUNT_BUYER";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRoles?: RoleType[];
  requireAdmin?: boolean;
}

export function ProtectedRoute({
  children,
  requiredRoles,
  requireAdmin = false,
}: ProtectedRouteProps) {
  const { user, session, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <p className="mt-2 text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Check role-based permissions
  if (session?.memberships && (requiredRoles || requireAdmin)) {
    const userRoles = session.memberships.map((m: any) => m.role);

    // Platform admin can access everything
    if (userRoles.includes("PLATFORM_ADMIN")) {
      return <>{children}</>;
    }

    // Check for admin-level roles
    if (requireAdmin) {
      const adminRoles = [
        "PLATFORM_ADMIN",
        "TENANT_OWNER",
        "TENANT_ADMIN",
        "ACCOUNT_OWNER",
      ];
      const hasAdminRole = userRoles.some((role: string) =>
        adminRoles.includes(role)
      );

      if (!hasAdminRole) {
        return <Navigate to="/chef/catalog" replace />;
      }
    }

    // Check for specific required roles
    if (requiredRoles && requiredRoles.length > 0) {
      const hasRequiredRole = requiredRoles.some((role) =>
        userRoles.includes(role)
      );

      if (!hasRequiredRole) {
        return <Navigate to="/chef/catalog" replace />;
      }
    }
  }

  return <>{children}</>;
}
