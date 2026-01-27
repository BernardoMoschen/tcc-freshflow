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

  useEffect(() => {
    // Get initial session
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

  return {
    user,
    session: sessionQuery.data,
    loading: loading || sessionQuery.isLoading,
    signIn,
    signOut,
    setContext,
  };
}
