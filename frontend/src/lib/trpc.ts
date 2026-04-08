import { createTRPCReact } from "@trpc/react-query";
import { httpBatchLink } from "@trpc/client";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../backend/src/router";
import { supabase } from "./supabase";

export type RouterOutputs = inferRouterOutputs<AppRouter>;

export const trpc = createTRPCReact<AppRouter>();

export const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "/trpc",
      async headers() {
        const headers: Record<string, string> = {};

        // Development mode bypass
        if (import.meta.env.DEV) {
          const devUserEmail = localStorage.getItem("freshflow:dev-user-email");
          if (devUserEmail) {
            headers["x-dev-user-email"] = devUserEmail;
            console.log(`🔧 [DEV MODE] Using dev user: ${devUserEmail}`);
          }
        } else {
          // Production: use Supabase authentication
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.access_token) {
            headers.authorization = `Bearer ${session.access_token}`;
          }
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
