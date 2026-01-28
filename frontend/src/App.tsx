import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { trpc, trpcClient } from "./lib/trpc";
import { ProtectedRoute } from "./components/protected-route";
import { ToastProvider } from "./components/toast";
import { Toaster } from "./components/ui/sonner";

// Pages
import { LoginPage } from "./pages/login";
import { CatalogPage } from "./pages/chef/catalog";
import { CartPage } from "./pages/chef/cart";
import { OrdersPage } from "./pages/chef/orders";
import { WeighingPage } from "./pages/admin/weighing";
import { FinalizePage } from "./pages/admin/finalize";

function App() {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 1000 * 60 * 5, // 5 minutes
            retry: 1,
          },
        },
      })
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <Toaster />
          <BrowserRouter>
            <Routes>
            {/* Public routes */}
            <Route path="/login" element={<LoginPage />} />

            {/* Chef routes (protected) */}
            <Route
              path="/chef/catalog"
              element={
                <ProtectedRoute>
                  <CatalogPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/chef/cart"
              element={
                <ProtectedRoute>
                  <CartPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/chef/orders"
              element={
                <ProtectedRoute>
                  <OrdersPage />
                </ProtectedRoute>
              }
            />

            {/* Admin routes (protected) */}
            <Route
              path="/admin/weighing/:orderId"
              element={
                <ProtectedRoute>
                  <WeighingPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/finalize/:orderId"
              element={
                <ProtectedRoute>
                  <FinalizePage />
                </ProtectedRoute>
              }
            />

            {/* Default redirect */}
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
          </BrowserRouter>
        </ToastProvider>
      </QueryClientProvider>
    </trpc.Provider>
  );
}

export default App;
