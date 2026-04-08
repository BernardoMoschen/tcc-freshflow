import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { ChevronDown, Building2, Store, Shield } from "lucide-react";
import { toast } from "sonner";

interface Tenant {
  id: string;
  name: string;
  slug: string;
}

interface Account {
  id: string;
  name: string;
  slug: string;
  tenantId: string;
  customerId: string | null;
  tenant: Tenant | null;
}

interface Membership {
  id: string;
  role: string;
  tenant: Tenant | null;
  account: Account | null;
}

export function ContextSwitcher() {
  const { session, setContext, isPlatformAdmin } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  // Query all tenants for platform admins
  const tenantsQuery = trpc.tenants.list.useQuery(undefined, {
    enabled: isPlatformAdmin,
  });

  if (!session?.memberships || session.memberships.length === 0) {
    return null;
  }

  const memberships = session.memberships as Membership[];

  // Get current context from localStorage
  const currentTenantId = localStorage.getItem("freshflow:tenantId");
  const currentAccountId = localStorage.getItem("freshflow:accountId");

  // Find current membership
  const currentMembership = memberships.find(
    (m) =>
      m.tenant?.id === currentTenantId || m.account?.id === currentAccountId
  );

  // Get display name for current context
  const getCurrentContextName = () => {
    if (currentMembership?.account) {
      return currentMembership.account.name;
    }
    if (currentMembership?.tenant) {
      return currentMembership.tenant.name;
    }
    // For platform admin, check if we have a tenant selected
    if (isPlatformAdmin && currentTenantId && tenantsQuery.data) {
      const tenant = tenantsQuery.data.find((t) => t.id === currentTenantId);
      if (tenant) {
        return tenant.name;
      }
    }
    return "Selecionar contexto";
  };

  const handleSwitchContext = (membership: Membership) => {
    // For account memberships, get tenantId from account.tenantId or account.tenant.id
    const tenantId =
      membership.tenant?.id ||
      membership.account?.tenantId ||
      membership.account?.tenant?.id;
    const accountId = membership.account?.id;

    setContext(tenantId, accountId);
    setIsOpen(false);

    toast.success(
      `Alterado para ${membership.account?.name || membership.tenant?.name}`
    );

    // Refresh the page to reload data with new context
    window.location.reload();
  };

  const handleSwitchToTenant = (tenant: Tenant) => {
    setContext(tenant.id, undefined);
    setIsOpen(false);

    toast.success(`Alterado para ${tenant.name}`);

    // Refresh the page to reload data with new context
    window.location.reload();
  };

  // Group memberships by type
  const tenantMemberships = memberships.filter(
    (m) => m.tenant && !m.account
  );
  const accountMemberships = memberships.filter((m) => m.account);

  // Calculate total options available
  const totalMembershipOptions = tenantMemberships.length + accountMemberships.length;
  const totalTenantOptions = isPlatformAdmin ? (tenantsQuery.data?.length || 0) : 0;

  // Only show switcher if user has multiple contexts or is platform admin
  if (totalMembershipOptions <= 1 && totalTenantOptions <= 1 && !isPlatformAdmin) {
    return null;
  }

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className="flex items-center gap-2 max-w-[200px]"
        >
          {isPlatformAdmin && !currentTenantId ? (
            <Shield className="h-4 w-4 flex-shrink-0" />
          ) : (
            <Store className="h-4 w-4 flex-shrink-0" />
          )}
          <span className="truncate text-sm">{getCurrentContextName()}</span>
          <ChevronDown className="h-4 w-4 flex-shrink-0" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[280px]">
        <div className="px-2 py-2 text-sm font-semibold border-b border-border mb-1">
          Trocar Contexto
        </div>

        {/* Platform admin: show all tenants */}
        {isPlatformAdmin && tenantsQuery.data && tenantsQuery.data.length > 0 && (
          <>
            <DropdownMenuLabel>
              Todos os Distribuidores
            </DropdownMenuLabel>
            {tenantsQuery.data.map((tenant) => (
              <DropdownMenuItem
                key={tenant.id}
                onClick={() => handleSwitchToTenant(tenant)}
                className={cn(
                  "cursor-pointer",
                  currentTenantId === tenant.id && "bg-accent"
                )}
              >
                <Building2 className="h-4 w-4 mr-2 flex-shrink-0 text-primary" />
                <div className="flex flex-col min-w-0">
                  <span className="text-sm font-medium truncate">{tenant.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {currentTenantId === tenant.id ? "Selecionado" : "Clique para selecionar"}
                  </span>
                </div>
              </DropdownMenuItem>
            ))}
            {(tenantMemberships.length > 0 || accountMemberships.length > 0) && (
              <DropdownMenuSeparator />
            )}
          </>
        )}

        {/* User's tenant memberships */}
        {tenantMemberships.length > 0 && (
          <>
            <DropdownMenuLabel>
              Meus Distribuidores
            </DropdownMenuLabel>
            {tenantMemberships.map((membership) => (
              <DropdownMenuItem
                key={membership.id}
                onClick={() => handleSwitchContext(membership)}
                className={cn(
                  "cursor-pointer",
                  currentTenantId === membership.tenant?.id && !currentAccountId && "bg-accent"
                )}
              >
                <Building2 className="h-4 w-4 mr-2 flex-shrink-0 text-primary" />
                <div className="flex flex-col min-w-0">
                  <span className="text-sm font-medium truncate">{membership.tenant?.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {membership.role}
                  </span>
                </div>
              </DropdownMenuItem>
            ))}
            {accountMemberships.length > 0 && <DropdownMenuSeparator />}
          </>
        )}

        {/* User's account memberships */}
        {accountMemberships.length > 0 && (
          <>
            <DropdownMenuLabel>
              Minhas Contas
            </DropdownMenuLabel>
            {accountMemberships.map((membership) => (
              <DropdownMenuItem
                key={membership.id}
                onClick={() => handleSwitchContext(membership)}
                className={cn(
                  "cursor-pointer",
                  currentAccountId === membership.account?.id && "bg-accent"
                )}
              >
                <Store className="h-4 w-4 mr-2 flex-shrink-0 text-green-600" />
                <div className="flex flex-col min-w-0">
                  <span className="text-sm font-medium truncate">{membership.account?.name ?? ""}</span>
                  <span className="text-xs text-muted-foreground">
                    {membership.role}
                  </span>
                </div>
              </DropdownMenuItem>
            ))}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
