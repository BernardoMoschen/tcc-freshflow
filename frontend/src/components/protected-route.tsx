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
  /**
   * Requires tenant-level admin access (PLATFORM_ADMIN, TENANT_OWNER, TENANT_ADMIN)
   * Use for: product management, stock, customers, weighing, finalize, admin orders
   */
  requireTenantAdmin?: boolean;
  /**
   * Requires account-level access (ACCOUNT_OWNER, ACCOUNT_BUYER)
   * Use for: cart, my orders (buyer experience)
   */
  requireAccountUser?: boolean;
  /**
   * @deprecated Use requireTenantAdmin instead
   */
  requireAdmin?: boolean;
}

export function ProtectedRoute({
  children,
  requiredRoles,
  requireTenantAdmin = false,
  requireAccountUser = false,
  requireAdmin = false,
}: ProtectedRouteProps) {
  const { user, userRoles, loading, isPlatformAdmin, isTenantAdmin, isAccountUser, isRateLimited } = useAuth();

  // Show rate limit message
  if (isRateLimited) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center max-w-md p-6">
          <div className="inline-block rounded-full h-16 w-16 bg-warning/10 flex items-center justify-center mb-4">
            <svg className="h-8 w-8 text-warning" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-foreground mb-2">Muitas requisições</h2>
          <p className="text-muted-foreground mb-4">
            Por favor, aguarde um momento antes de tentar novamente.
          </p>
          <p className="text-sm text-muted-foreground">
            Reconectando automaticamente...
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <p className="mt-2 text-sm text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Platform admin bypasses all role checks
  if (isPlatformAdmin) {
    return <>{children}</>;
  }

  // Check for tenant admin requirement (products, stock, customers, weighing, finalize)
  if (requireTenantAdmin || requireAdmin) {
    if (!isTenantAdmin) {
      // Redirect non-tenant-admins to their appropriate home
      return <Navigate to={isAccountUser ? "/chef/catalog" : "/dashboard"} replace />;
    }
    return <>{children}</>;
  }

  // Check for account user requirement (cart, my orders - buyer experience)
  if (requireAccountUser) {
    if (!isAccountUser) {
      // Tenant admins trying to access buyer pages get redirected to admin area
      return <Navigate to={isTenantAdmin ? "/admin/orders" : "/dashboard"} replace />;
    }
    return <>{children}</>;
  }

  // Check for specific required roles
  if (requiredRoles && requiredRoles.length > 0) {
    const hasRequiredRole = requiredRoles.some((role) => userRoles.includes(role));
    if (!hasRequiredRole) {
      return <Navigate to="/dashboard" replace />;
    }
  }

  return <>{children}</>;
}
