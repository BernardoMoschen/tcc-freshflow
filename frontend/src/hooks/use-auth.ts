import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { trpc } from "@/lib/trpc";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // Get session data from tRPC
  const sessionQuery = trpc.auth.session.useQuery(undefined, {
    enabled: !!user,
    retry: false,
  });

  // Auto-set context when session data is loaded
  useEffect(() => {
    if (!sessionQuery.data) return;

    // Auto-set context if not already set
    const tenantId = localStorage.getItem("freshflow:tenantId");
    const accountId = localStorage.getItem("freshflow:accountId");

    if (!tenantId && !accountId && sessionQuery.data.memberships.length > 0) {
      // Find first membership and set context
      const firstMembership = sessionQuery.data.memberships[0];

      if (firstMembership.account) {
        // Account membership - set both tenant and account
        localStorage.setItem("freshflow:tenantId", firstMembership.account.tenantId);
        localStorage.setItem("freshflow:accountId", firstMembership.account.id);
      } else if (firstMembership.tenant) {
        // Tenant membership - set only tenant
        localStorage.setItem("freshflow:tenantId", firstMembership.tenant.id);
      }
    }
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
    supabase.auth.getSession().then(({ data: { session } }) => {
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
  const isInitialLoading = loading || (!!user && !sessionQuery.data && sessionQuery.isLoading && !sessionQuery.isError);

  return {
    user,
    session: sessionQuery.data,
    loading: isInitialLoading,
    error: sessionQuery.error,
    signIn,
    signOut,
    setContext,
  };
}
