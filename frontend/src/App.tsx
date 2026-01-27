import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { trpc, trpcClient } from "./lib/trpc";

function App() {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000 * 60 * 5, // 5 minutes
        retry: 1,
      },
    },
  }));

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <div className="min-h-screen bg-background">
            <h1 className="text-4xl font-bold text-center py-8">
              FreshFlow
            </h1>
            <p className="text-center text-muted-foreground">
              B2B Fresh Produce Ordering System
            </p>
            <p className="text-center text-sm text-muted-foreground mt-4">
              Frontend foundation ready. Routes and pages coming next.
            </p>
          </div>
        </BrowserRouter>
      </QueryClientProvider>
    </trpc.Provider>
  );
}

export default App;
