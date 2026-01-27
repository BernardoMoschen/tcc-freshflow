import { createTRPCReact } from "@trpc/react-query";
import { httpBatchLink } from "@trpc/client";
import type { AppRouter } from "../../../backend/src/router";
import { supabase } from "./supabase";

export const trpc = createTRPCReact<AppRouter>();

export const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "/trpc",
      async headers() {
        const { data: { session } } = await supabase.auth.getSession();

        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };

        if (session?.access_token) {
          headers.authorization = `Bearer ${session.access_token}`;
        }

        // Add context headers if available in localStorage
        const tenantId = localStorage.getItem("freshflow:tenantId");
        const accountId = localStorage.getItem("freshflow:accountId");

        if (tenantId) {
          headers["x-tenant-id"] = tenantId;
        }

        if (accountId) {
          headers["x-account-id"] = accountId;
        }

        return headers;
      },
    }),
  ],
});
