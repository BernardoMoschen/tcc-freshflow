import { PageLayout } from "@/components/page-layout";
import { AnalyticsDashboard } from "@/components/analytics-dashboard";
import { useAuth } from "@/hooks/use-auth";
import { Building2 } from "lucide-react";

export function AnalyticsPage() {
  const { isTenantAdmin } = useAuth();
  const hasTenantContext = !!localStorage.getItem("freshflow:tenantId");

  // Platform admin without tenant context
  if (!hasTenantContext) {
    return (
      <PageLayout title="Analytics">
        <div className="flex flex-col items-center justify-center py-12">
          <Building2 className="h-16 w-16 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold text-foreground mb-2">
            Selecione um Tenant
          </h2>
          <p className="text-muted-foreground text-center max-w-md">
            Selecione um tenant para visualizar as análises.
          </p>
        </div>
      </PageLayout>
    );
  }

  if (!isTenantAdmin) {
    return (
      <PageLayout title="Analytics">
        <div className="flex flex-col items-center justify-center py-12">
          <p className="text-muted-foreground">Acesso negado. Apenas administradores podem visualizar analytics.</p>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout title="Analytics">
      <AnalyticsDashboard />
    </PageLayout>
  );
}
