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

function App() {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 1000 * 60 * 5, // 5 minutes - data stays fresh for 5 min
            gcTime: 1000 * 60 * 30, // 30 minutes - cache persists even if unused
            retry: 1, // Retry failed queries once
            refetchOnWindowFocus: true, // Refetch when user returns to tab
            refetchOnReconnect: true, // Refetch when internet reconnects
            refetchOnMount: false, // Don't refetch if data is still fresh
          },
          mutations: {
            retry: 0, // Don't retry mutations by default
            // Global error handler for mutations can be added here
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

            {/* Admin routes (protected, admin roles only) */}
            <Route
              path="/admin/products"
              element={
                <ProtectedRoute requireAdmin>
                  <ProductsManagementPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/customers"
              element={
                <ProtectedRoute requireAdmin>
                  <CustomersManagementPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/stock"
              element={
                <ProtectedRoute requireAdmin>
                  <StockManagementPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/weighing/:orderId"
              element={
                <ProtectedRoute requireAdmin>
                  <WeighingPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/finalize/:orderId"
              element={
                <ProtectedRoute requireAdmin>
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
