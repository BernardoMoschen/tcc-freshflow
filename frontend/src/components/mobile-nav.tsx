import { Link, useLocation } from "react-router-dom";
import { useCart } from "@/hooks/use-cart";
import { ShoppingBag, ShoppingCart, ClipboardList } from "lucide-react";

export function MobileNav() {
  const location = useLocation();
  const { count } = useCart();

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

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 md:hidden z-50"
      aria-label="Navegação principal mobile"
      role="navigation"
    >
      <div className="grid grid-cols-3 h-16">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);

          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center justify-center space-y-1 relative transition-colors ${
                active ? "text-primary" : "text-gray-600 hover:text-gray-900"
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
                  className="absolute top-2 right-1/4 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-medium"
                  aria-hidden="true"
                >
                  {item.badge > 99 ? "99+" : item.badge}
                </span>
              )}
              <Icon className="w-6 h-6" aria-hidden="true" />
              <span className="text-xs font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
