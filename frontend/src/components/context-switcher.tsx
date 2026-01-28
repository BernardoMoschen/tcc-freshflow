import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { ChevronDown, Building2, Store } from "lucide-react";
import { toast } from "sonner";

export function ContextSwitcher() {
  const { session, setContext } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  if (!session?.memberships || session.memberships.length === 0) {
    return null;
  }

  // Get current context from localStorage
  const currentTenantId = localStorage.getItem("freshflow:tenantId");
  const currentAccountId = localStorage.getItem("freshflow:accountId");

  // Find current membership
  const currentMembership = session.memberships.find(
    (m: any) =>
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
    // Default to first membership
    const firstMembership = session.memberships[0];
    if (firstMembership.account) {
      return firstMembership.account.name;
    }
    if (firstMembership.tenant) {
      return firstMembership.tenant.name;
    }
    return "Select context";
  };

  const handleSwitchContext = (membership: any) => {
    const tenantId = membership.tenant?.id;
    const accountId = membership.account?.id;

    setContext(tenantId, accountId);
    setIsOpen(false);

    // Refresh the page to reload data with new context
    window.location.reload();

    toast.success(
      `Switched to ${membership.account?.name || membership.tenant?.name}`
    );
  };

  // Group memberships by type
  const tenantMemberships = session.memberships.filter(
    (m: any) => m.tenant && !m.account
  );
  const accountMemberships = session.memberships.filter((m: any) => m.account);

  // Only show switcher if user has multiple contexts
  if (
    tenantMemberships.length + accountMemberships.length <= 1 &&
    !currentMembership?.tenant
  ) {
    return null;
  }

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className="flex items-center gap-2 max-w-[200px]"
        >
          <Store className="h-4 w-4 flex-shrink-0" />
          <span className="truncate text-sm">{getCurrentContextName()}</span>
          <ChevronDown className="h-4 w-4 flex-shrink-0" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[250px]">
        <DropdownMenuLabel>Switch Context</DropdownMenuLabel>
        <DropdownMenuSeparator />

        {tenantMemberships.length > 0 && (
          <>
            <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
              Tenants
            </DropdownMenuLabel>
            {tenantMemberships.map((membership: any) => (
              <DropdownMenuItem
                key={membership.id}
                onClick={() => handleSwitchContext(membership)}
                className="cursor-pointer"
              >
                <Building2 className="h-4 w-4 mr-2" />
                <div className="flex flex-col">
                  <span className="text-sm">{membership.tenant.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {membership.role}
                  </span>
                </div>
              </DropdownMenuItem>
            ))}
            {accountMemberships.length > 0 && <DropdownMenuSeparator />}
          </>
        )}

        {accountMemberships.length > 0 && (
          <>
            <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
              Accounts
            </DropdownMenuLabel>
            {accountMemberships.map((membership: any) => (
              <DropdownMenuItem
                key={membership.id}
                onClick={() => handleSwitchContext(membership)}
                className="cursor-pointer"
              >
                <Store className="h-4 w-4 mr-2" />
                <div className="flex flex-col">
                  <span className="text-sm">{membership.account.name}</span>
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
