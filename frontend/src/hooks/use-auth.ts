import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { trpc } from "@/lib/trpc";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // Track rate limit state
  const [isRateLimited, setIsRateLimited] = useState(false);

  // Get session data from tRPC
  // Note: No user state-based 'enabled' condition - prevents re-firing when user toggles
  // Rate limiting is still enforced via retry: false + error handling below
  const sessionQuery = trpc.auth.session.useQuery(undefined, {
    enabled: !isRateLimited,
    retry: false,
    // Prevent rapid re-fetching
    staleTime: 1000 * 60 * 5, // 5 minutes - cache the session data
    gcTime: 1000 * 60 * 30, // 30 minutes
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true, // Refetch if becomes stale
    refetchInterval: false, // Disable polling
  });

  // Handle rate limit errors
  useEffect(() => {
    if (sessionQuery.error) {
      const errorMessage = sessionQuery.error.message?.toLowerCase() || "";
      if (
        errorMessage.includes("too many") ||
        errorMessage.includes("rate limit") ||
        errorMessage.includes("429")
      ) {
        setIsRateLimited(true);
        // Auto-retry after 60 seconds
        const timer = setTimeout(() => {
          setIsRateLimited(false);
        }, 60000);
        return () => clearTimeout(timer);
      }
    }
  }, [sessionQuery.error]);

  // Auto-set context when session data is loaded
  useEffect(() => {
    if (!sessionQuery.data || sessionQuery.data.memberships.length === 0) return;

    const storedTenantId = localStorage.getItem("freshflow:tenantId");
    const storedAccountId = localStorage.getItem("freshflow:accountId");
    const memberships = sessionQuery.data.memberships;

    // Type for membership
    type Membership = {
      role: string;
      tenant?: { id: string } | null;
      account?: { id: string; tenantId: string } | null;
    };

    // Check if user is platform admin (no tenant/account context required for basic operations)
    const isPlatformAdminUser = memberships.some((m: Membership) => m.role === "PLATFORM_ADMIN");

    // Find first membership with tenant or account context
    const findContextMembership = (): Membership | undefined => {
      // First priority: account memberships
      const accountMembership = memberships.find((m: Membership) => m.account);
      if (accountMembership) return accountMembership;

      // Second priority: tenant memberships
      const tenantMembership = memberships.find((m: Membership) => m.tenant);
      if (tenantMembership) return tenantMembership;

      return undefined;
    };

    // Check if stored context is valid
    const isContextValid = (): boolean => {
      // Platform admin can select any tenant (or operate without context)
      // Trust their manual selection - don't override it
      if (isPlatformAdminUser) {
        return true;
      }

      // Check if stored context matches any membership
      return memberships.some((m: Membership) => {
        if (storedAccountId && m.account?.id === storedAccountId) return true;
        if (storedTenantId && m.tenant?.id === storedTenantId) return true;
        if (storedTenantId && m.account?.tenantId === storedTenantId) return true;
        return false;
      });
    };

    // If context is already valid, no need to change
    if (isContextValid()) {
      // Clear the reload flag if context is now valid
      sessionStorage.removeItem("freshflow:context-reload-pending");
      return;
    }

    // Prevent infinite reload loops - only reload once per session
    const reloadPending = sessionStorage.getItem("freshflow:context-reload-pending");
    if (reloadPending) {
      console.warn("⚠️ Context reload already attempted, skipping to prevent infinite loop");
      sessionStorage.removeItem("freshflow:context-reload-pending");
      return;
    }

    // Context is invalid - try to set from memberships
    const contextMembership = findContextMembership();

    if (contextMembership?.account) {
      // Account membership - set both tenant and account
      localStorage.setItem("freshflow:tenantId", contextMembership.account.tenantId);
      localStorage.setItem("freshflow:accountId", contextMembership.account.id);
      console.log("🔄 Context set to account:", contextMembership.account.id);
      // Set flag before reload to prevent infinite loop
      sessionStorage.setItem("freshflow:context-reload-pending", "true");
      window.location.reload();
    } else if (contextMembership?.tenant) {
      // Tenant membership - set only tenant
      localStorage.setItem("freshflow:tenantId", contextMembership.tenant.id);
      localStorage.removeItem("freshflow:accountId");
      console.log("🔄 Context set to tenant:", contextMembership.tenant.id);
      // Set flag before reload to prevent infinite loop
      sessionStorage.setItem("freshflow:context-reload-pending", "true");
      window.location.reload();
    } else if (isPlatformAdminUser) {
      // Platform admin with no tenant/account memberships - clear context and don't reload
      localStorage.removeItem("freshflow:tenantId");
      localStorage.removeItem("freshflow:accountId");
      console.log("🔧 Platform admin with global access (no specific context)");
      // Don't reload - let them access without context
    }
    // If no context found and not platform admin, let the protected routes handle the error
  }, [sessionQuery.data]);

  useEffect(() => {
    // Development mode bypass
    if (import.meta.env.DEV) {
      const devUserEmail = localStorage.getItem("freshflow:dev-user-email");
      if (devUserEmail) {
        // Create a mock user object for dev mode
        setUser({
          id: "dev-user",
          email: devUserEmail,
          app_metadata: {},
          user_metadata: {},
          aud: "authenticated",
          created_at: new Date().toISOString(),
        } as User);
        setLoading(false);
        return;
      }
    }

    // Production: Get initial session from Supabase
    void supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;
    return data;
  };

  const signOut = async () => {
    // Development mode: just clear dev user
    if (import.meta.env.DEV) {
      localStorage.removeItem("freshflow:dev-user-email");
      localStorage.removeItem("freshflow:tenantId");
      localStorage.removeItem("freshflow:accountId");
      setUser(null);
      navigate("/login");
      return;
    }

    // Production: sign out from Supabase
    const { error } = await supabase.auth.signOut();
    if (error) throw error;

    // Clear context from localStorage
    localStorage.removeItem("freshflow:tenantId");
    localStorage.removeItem("freshflow:accountId");

    navigate("/login");
  };

  const setContext = (tenantId?: string, accountId?: string) => {
    if (tenantId) {
      localStorage.setItem("freshflow:tenantId", tenantId);
    } else {
      localStorage.removeItem("freshflow:tenantId");
    }

    if (accountId) {
      localStorage.setItem("freshflow:accountId", accountId);
    } else {
      localStorage.removeItem("freshflow:accountId");
    }
  };

  // Only show loading on initial load, not on session query refetches
  // This prevents the page from blinking when session query retries
  const isInitialLoading =
    loading || (!!user && !sessionQuery.data && sessionQuery.isLoading && !sessionQuery.isError);

  // Extract user roles from memberships
  const userRoles: string[] =
    sessionQuery.data?.memberships?.map((m: { role: string }) => m.role) || [];

  // Role check helpers
  const isPlatformAdmin = userRoles.includes("PLATFORM_ADMIN");

  // Tenant-level admins (can manage products, stock, orders, customers)
  const isTenantAdmin =
    isPlatformAdmin || userRoles.some((role) => ["TENANT_OWNER", "TENANT_ADMIN"].includes(role));

  // Account-level users (can browse catalog, place orders)
  const isAccountUser = userRoles.some((role) => ["ACCOUNT_OWNER", "ACCOUNT_BUYER"].includes(role));

  // ACCOUNT_OWNER is a special case - they can view account data but NOT manage tenant resources
  const isAccountOwner = userRoles.includes("ACCOUNT_OWNER");

  // Buyers can only browse and order
  const isBuyer = userRoles.includes("ACCOUNT_BUYER");

  // Check if user has any of the specified roles
  const hasAnyRole = (roles: string[]) => {
    if (isPlatformAdmin) return true;
    return userRoles.some((role) => roles.includes(role));
  };

  return {
    user,
    session: sessionQuery.data,
    loading: isInitialLoading,
    error: sessionQuery.error,
    isRateLimited,
    signIn,
    signOut,
    setContext,
    // Role helpers
    userRoles,
    isPlatformAdmin,
    isTenantAdmin,
    isAccountUser,
    isAccountOwner,
    isBuyer,
    hasAnyRole,
  };
}
