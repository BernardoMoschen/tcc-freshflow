import { useRef, useCallback, KeyboardEvent } from "react";
import { Link, useLocation } from "react-router-dom";
import { useCart } from "@/hooks/use-cart";
import { ShoppingBag, ShoppingCart, ClipboardList } from "lucide-react";

export function MobileNav() {
  const location = useLocation();
  const { count } = useCart();
  const navRef = useRef<HTMLDivElement>(null);

  const isActive = (path: string) => location.pathname.startsWith(path);

  const navItems = [
    {
      path: "/chef/catalog",
      label: "Catálogo",
      icon: ShoppingBag,
    },
    {
      path: "/chef/cart",
      label: "Carrinho",
      icon: ShoppingCart,
      badge: count > 0 ? count : undefined,
    },
    {
      path: "/chef/orders",
      label: "Pedidos",
      icon: ClipboardList,
    },
  ];

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLAnchorElement>, currentIndex: number) => {
      const links = navRef.current?.querySelectorAll<HTMLAnchorElement>("a");
      if (!links) return;

      let nextIndex: number | null = null;

      switch (e.key) {
        case "ArrowLeft":
          e.preventDefault();
          nextIndex = currentIndex > 0 ? currentIndex - 1 : navItems.length - 1;
          break;
        case "ArrowRight":
          e.preventDefault();
          nextIndex = currentIndex < navItems.length - 1 ? currentIndex + 1 : 0;
          break;
        case "Home":
          e.preventDefault();
          nextIndex = 0;
          break;
        case "End":
          e.preventDefault();
          nextIndex = navItems.length - 1;
          break;
      }

      if (nextIndex !== null) {
        links[nextIndex]?.focus();
      }
    },
    [navItems.length]
  );

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 bg-card border-t border-border md:hidden z-50 safe-area-inset-bottom"
      aria-label="Navegação principal mobile"
      role="navigation"
    >
      <div ref={navRef} className="grid grid-cols-3 h-16" role="tablist">
        {navItems.map((item, index) => {
          const Icon = item.icon;
          const active = isActive(item.path);

          return (
            <Link
              key={item.path}
              to={item.path}
              role="tab"
              tabIndex={active ? 0 : -1}
              aria-selected={active}
              onKeyDown={(e) => handleKeyDown(e, index)}
              className={`flex flex-col items-center justify-center space-y-1 relative transition-colors min-h-[64px] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset ${
                active ? "text-primary bg-primary/5" : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
              aria-current={active ? "page" : undefined}
              aria-label={
                item.badge
                  ? `${item.label} (${item.badge} ${item.badge === 1 ? "item" : "itens"})`
                  : item.label
              }
            >
              {item.badge !== undefined && (
                <span
                  className="absolute top-2 right-1/4 bg-destructive text-primary-foreground text-xs rounded-full h-5 w-5 flex items-center justify-center font-medium animate-in zoom-in duration-200"
                  aria-hidden="true"
                >
                  {item.badge > 99 ? "99+" : item.badge}
                </span>
              )}
              <Icon className="w-6 h-6" aria-hidden="true" />
              <span className="text-xs font-medium">{item.label}</span>
              {active && (
                <span
                  className="absolute bottom-0 left-1/4 right-1/4 h-0.5 bg-primary rounded-full"
                  aria-hidden="true"
                />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
