import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { trpc, trpcClient } from "./lib/trpc";
import { ProtectedRoute } from "./components/protected-route";
import { ToastProvider } from "./components/toast";
import { Toaster } from "./components/ui/sonner";

// Smart redirect: goes to dashboard if logged in, login if not
function RootRedirect() {
  const isLoggedIn =
    !!localStorage.getItem("freshflow:dev-user-email") ||
    !!localStorage.getItem("freshflow:tenantId");
  return <Navigate to={isLoggedIn ? "/dashboard" : "/login"} replace />;
}

// Pages
import { LoginPage } from "./pages/login";
import { DashboardPage } from "./pages/dashboard";
import { CatalogPage } from "./pages/chef/catalog";
import { CartPage } from "./pages/chef/cart";
import { OrdersPage } from "./pages/chef/orders";
import { WeighingPage } from "./pages/admin/weighing";
import { FinalizePage } from "./pages/admin/finalize";
import { StockManagementPage } from "./pages/admin/stock-management";
import { ProductsManagementPage } from "./pages/admin/products";
import { CustomersManagementPage } from "./pages/admin/customers";
import { AdminOrdersPage } from "./pages/admin/orders";

// Helper to check if error is retryable (only server/network errors)
function shouldRetry(failureCount: number, error: unknown): boolean {
  // Max 2 retries
  if (failureCount >= 2) return false;

  // Check for tRPC error with HTTP status
  if (error && typeof error === "object") {
    const err = error as { data?: { httpStatus?: number }; message?: string };
    const status = err.data?.httpStatus;

    // Don't retry client errors (4xx) - they won't succeed
    if (status && status >= 400 && status < 500) return false;

    // Don't retry auth errors
    if (err.message?.includes("UNAUTHORIZED")) return false;
  }

  // Retry server errors (5xx) and network errors
  return true;
}

function App() {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 1000 * 60 * 5, // 5 minutes
            gcTime: 1000 * 60 * 30, // 30 minutes
            retry: shouldRetry, // Smart retry: only server/network errors
            retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10000), // 1s, 2s, 4s... max 10s
            refetchOnWindowFocus: false, // Prevent refetch loops
            refetchOnReconnect: true,
            refetchOnMount: false,
          },
          mutations: {
            retry: 0,
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

            {/* Dashboard (protected, all roles) */}
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <DashboardPage />
                </ProtectedRoute>
              }
            />

            {/*
              Catalog - All authenticated users can browse
              Tenant admins see manage mode, buyers can add to cart
            */}
            <Route
              path="/chef/catalog"
              element={
                <ProtectedRoute>
                  <CatalogPage />
                </ProtectedRoute>
              }
            />

            {/*
              Cart - Account-level users only (ACCOUNT_OWNER, ACCOUNT_BUYER)
              Tenant admins don't need a shopping cart
            */}
            <Route
              path="/chef/cart"
              element={
                <ProtectedRoute requireAccountUser>
                  <CartPage />
                </ProtectedRoute>
              }
            />

            {/*
              My Orders - Account-level users only (ACCOUNT_OWNER, ACCOUNT_BUYER)
              Shows orders placed by the account
            */}
            <Route
              path="/chef/orders"
              element={
                <ProtectedRoute requireAccountUser>
                  <OrdersPage />
                </ProtectedRoute>
              }
            />

            {/*
              Admin routes - Tenant admins only (PLATFORM_ADMIN, TENANT_OWNER, TENANT_ADMIN)
              ACCOUNT_OWNER should NOT have access to these
            */}
            <Route
              path="/admin/products"
              element={
                <ProtectedRoute requireTenantAdmin>
                  <ProductsManagementPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/customers"
              element={
                <ProtectedRoute requireTenantAdmin>
                  <CustomersManagementPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/stock"
              element={
                <ProtectedRoute requireTenantAdmin>
                  <StockManagementPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/orders"
              element={
                <ProtectedRoute requireTenantAdmin>
                  <AdminOrdersPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/weighing/:orderId"
              element={
                <ProtectedRoute requireTenantAdmin>
                  <WeighingPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/finalize/:orderId"
              element={
                <ProtectedRoute requireTenantAdmin>
                  <FinalizePage />
                </ProtectedRoute>
              }
            />

            {/* Default redirect - dashboard if logged in, login if not */}
            <Route path="/" element={<RootRedirect />} />
            <Route path="*" element={<RootRedirect />} />
            </Routes>
          </BrowserRouter>
        </ToastProvider>
      </QueryClientProvider>
    </trpc.Provider>
  );
}

export default App;
