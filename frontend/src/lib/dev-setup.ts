/**
 * Development mode setup utilities
 * These functions help configure the app for local testing without Supabase
 */

export interface DevUser {
  email: string;
  name: string;
  role: string;
  tenantId?: string;
  accountId?: string;
}

export const DEV_USERS: Record<string, DevUser> = {
  admin: {
    email: "admin@freshflow.com",
    name: "Platform Admin",
    role: "PLATFORM_ADMIN",
    // No tenant/account - platform admin has global access, context auto-resolved from session
  },
  owner: {
    email: "owner@freshco.com",
    name: "FreshCo Owner",
    role: "TENANT_OWNER",
    // tenantId auto-resolved from session memberships
  },
  manager: {
    email: "carlos@verdecampo.com.br",
    name: "Carlos Silva (Verde Campo Owner)",
    role: "TENANT_OWNER",
    // tenantId auto-resolved from session memberships
  },
  warehouse: {
    email: "ana@verdecampo.com.br",
    name: "Ana Oliveira (Verde Campo Admin)",
    role: "TENANT_ADMIN",
    // tenantId auto-resolved from session memberships
  },
  chef: {
    email: "chef@chefstable.com",
    name: "Head Chef",
    role: "ACCOUNT_OWNER",
    // tenantId and accountId auto-resolved from session memberships
  },
  buyer: {
    email: "roberto@sabordaterra.com.br",
    name: "Roberto Santos (Sabor da Terra Owner)",
    role: "ACCOUNT_OWNER",
    // tenantId and accountId auto-resolved from session memberships
  },
  assistant: {
    email: "juliana@sabordaterra.com.br",
    name: "Juliana Lima (Sabor da Terra Buyer)",
    role: "ACCOUNT_BUYER",
    // tenantId and accountId auto-resolved from session memberships
  },
};

/**
 * Set up development mode with a specific user
 * Context (tenantId/accountId) is auto-resolved from session memberships
 */
export function setupDevMode(userKey: keyof typeof DEV_USERS) {
  if (!import.meta.env.DEV) {
    console.warn("⚠️ Dev mode only works in development environment");
    return false;
  }

  const user = DEV_USERS[userKey];
  if (!user) {
    console.error(`❌ Unknown user: ${userKey}`);
    return false;
  }

  // Clear any existing context - will be auto-resolved from session
  localStorage.removeItem("freshflow:tenantId");
  localStorage.removeItem("freshflow:accountId");

  // Set dev user email
  localStorage.setItem("freshflow:dev-user-email", user.email);

  console.log(`✅ Dev mode configured for: ${user.name} (${user.email})`);
  console.log(`📧 Email: ${user.email}`);
  console.log(`👤 Role: ${user.role}`);
  console.log(`💡 Context will be auto-resolved from session memberships`);

  return true;
}

/**
 * Clear development mode
 */
export function clearDevMode() {
  localStorage.removeItem("freshflow:dev-user-email");
  localStorage.removeItem("freshflow:tenantId");
  localStorage.removeItem("freshflow:accountId");
  console.log("✅ Dev mode cleared");
  console.log("🔄 Reload the page to apply changes");
}

/**
 * Get current dev mode status
 */
export function getDevModeStatus() {
  if (!import.meta.env.DEV) {
    return { enabled: false, message: "Not in development environment" };
  }

  const devUserEmail = localStorage.getItem("freshflow:dev-user-email");
  const tenantId = localStorage.getItem("freshflow:tenantId");
  const accountId = localStorage.getItem("freshflow:accountId");

  if (!devUserEmail) {
    return { enabled: false, message: "Dev mode not configured" };
  }

  return {
    enabled: true,
    email: devUserEmail,
    tenantId,
    accountId,
  };
}

/**
 * Initialize dev mode on page load if in development
 * Call this from main.tsx
 */
export function initDevMode() {
  if (!import.meta.env.DEV) return;

  const status = getDevModeStatus();
  if (status.enabled) {
    console.log("🔧 [DEV MODE] Active");
    console.log(`📧 User: ${status.email}`);
    if (status.tenantId) console.log(`🏢 Tenant: ${status.tenantId}`);
    if (status.accountId) console.log(`🏪 Account: ${status.accountId}`);
  } else {
    console.log("🔧 [DEV MODE] Not configured");
    console.log("💡 Use setupDevMode('chef') to configure");
    console.log("   Available users: admin, owner, chef");
  }
}

// Expose to window for easy console access
if (import.meta.env.DEV && typeof window !== "undefined") {
  (window as any).devSetup = {
    setup: setupDevMode,
    clear: clearDevMode,
    status: getDevModeStatus,
    users: DEV_USERS,
  };
  console.log("💡 Dev utilities available at: window.devSetup");
  console.log("   Users: admin, owner, manager, warehouse, chef, buyer, assistant");
}
