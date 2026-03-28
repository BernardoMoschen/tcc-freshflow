import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Home,
  Package,
  Users,
  LogOut,
  Menu,
  X,
  PackageSearch,
  ClipboardList,
  ShoppingCart,
  ShoppingBag,
  User as UserIcon,
  Settings,
  ChevronDown,
} from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useCart } from "@/hooks/use-cart";
import { ContextSwitcher } from "./context-switcher";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, isTenantAdmin, isAccountUser } = useAuth();
  const { items } = useCart();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const cartItemCount = items.length;

  const handleLogout = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const isActive = (path: string) => {
    return location.pathname === path || location.pathname.startsWith(path + "/");
  };

  // Navigation links based on user type
  // Tenant admins: manage products, stock, customers, process orders
  // Account users (buyers): browse catalog, place orders, view their orders
  const tenantAdminLinks = [
    { path: "/dashboard", label: "Painel", icon: Home },
    { path: "/admin/orders", label: "Pedidos", icon: ClipboardList },
    { path: "/admin/products", label: "Produtos", icon: Package },
    { path: "/admin/customers", label: "Clientes", icon: Users },
    { path: "/admin/stock", label: "Estoque", icon: PackageSearch },
  ];

  const accountUserLinks = [
    { path: "/dashboard", label: "Painel", icon: Home },
    { path: "/chef/catalog", label: "Catálogo", icon: ShoppingBag },
    { path: "/chef/orders", label: "Meus Pedidos", icon: ClipboardList },
  ];

  // Determine which links to show based on role
  const links = isTenantAdmin ? tenantAdminLinks : accountUserLinks;

  return (
    <nav className="bg-card border-b border-border sticky top-0 z-50 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          {/* Logo */}
          <div className="flex items-center">
            <Link to="/dashboard" className="flex items-center">
              <Package className="h-8 w-8 text-primary" />
              <span className="ml-2 text-xl font-bold text-foreground">FreshFlow</span>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex md:items-center md:space-x-1">
            {links.map((link) => {
              const Icon = link.icon;
              const active = isActive(link.path);
              return (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`px-3 py-2 rounded-md text-sm font-medium flex items-center gap-2 transition-colors ${active
                      ? "bg-primary text-primary-foreground"
                      : "text-foreground hover:bg-accent/10"
                    }`}
                >
                  <Icon className="h-4 w-4" />
                  {link.label}
                </Link>
              );
            })}

            {/* Cart button for account users */}
            {isAccountUser && (
              <Link
                to="/chef/cart"
                className={`px-3 py-2 rounded-md text-sm font-medium flex items-center gap-2 transition-colors relative ${isActive("/chef/cart")
                    ? "bg-primary text-primary-foreground"
                    : "text-foreground hover:bg-accent/10"
                  }`}
              >
                <ShoppingCart className="h-4 w-4" />
                Carrinho
                {cartItemCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-semibold">
                    {cartItemCount}
                  </span>
                )}
              </Link>
            )}

            <div className="ml-3">
              <ContextSwitcher />
            </div>

            {/* User Menu */}
            <div className="ml-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <UserIcon className="h-4 w-4 text-primary" />
                    </div>
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>Minha Conta</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate("/profile")}>
                    <UserIcon className="h-4 w-4 mr-2" />
                    Perfil
                  </DropdownMenuItem>
                  {isTenantAdmin && (
                    <DropdownMenuItem onClick={() => navigate("/admin/settings")}>
                      <Settings className="h-4 w-4 mr-2" />
                      Configurações do Tenant
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={handleLogout}
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <LogOut className="h-4 w-4 mr-2" />
                    Sair
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Mobile menu button */}
          <div className="flex items-center md:hidden">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? (
                <X className="h-6 w-6" />
              ) : (
                <Menu className="h-6 w-6" />
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile Navigation */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-border bg-card">
          <div className="px-2 pt-2 pb-3 space-y-1">
            {links.map((link) => {
              const Icon = link.icon;
              const active = isActive(link.path);
              return (
                <Link
                  key={link.path}
                  to={link.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`block px-3 py-2 rounded-md text-base font-medium flex items-center gap-2 ${active
                      ? "bg-primary text-primary-foreground"
                      : "text-foreground hover:bg-accent/10"
                    }`}
                >
                  <Icon className="h-5 w-5" />
                  {link.label}
                </Link>
              );
            })}

            {/* Cart button for account users (mobile) */}
            {isAccountUser && (
              <Link
                to="/chef/cart"
                onClick={() => setMobileMenuOpen(false)}
                className={`block px-3 py-2 rounded-md text-base font-medium flex items-center gap-2 ${isActive("/chef/cart")
                    ? "bg-primary text-primary-foreground"
                    : "text-foreground hover:bg-accent/10"
                  }`}
              >
                <ShoppingCart className="h-5 w-5" />
                Carrinho
                {cartItemCount > 0 && (
                  <span className="bg-red-500 text-white text-xs rounded-full px-2 py-0.5 font-semibold">
                    {cartItemCount}
                  </span>
                )}
              </Link>
            )}

            <div className="px-3 py-2">
              <ContextSwitcher />
            </div>

            <div className="border-t border-border mt-2 pt-2">
              <Link
                to="/profile"
                onClick={() => setMobileMenuOpen(false)}
                className="block px-3 py-2 rounded-md text-base font-medium text-foreground hover:bg-accent/10 flex items-center gap-2"
              >
                <UserIcon className="h-5 w-5" />
                Perfil
              </Link>
              {isTenantAdmin && (
                <Link
                  to="/admin/settings"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block px-3 py-2 rounded-md text-base font-medium text-foreground hover:bg-accent/10 flex items-center gap-2"
                >
                  <Settings className="h-5 w-5" />
                  Configurações do Tenant
                </Link>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10 mt-1"
              >
                <LogOut className="h-5 w-5 mr-2" />
                Sair
              </Button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
