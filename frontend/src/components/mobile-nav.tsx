import { Link, useLocation } from "react-router-dom";
import { useCart } from "@/hooks/use-cart";

export function MobileNav() {
  const location = useLocation();
  const { count } = useCart();

  const isActive = (path: string) => location.pathname.startsWith(path);

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 md:hidden z-50">
      <div className="grid grid-cols-3 h-16">
        <Link
          to="/chef/catalog"
          className={`flex flex-col items-center justify-center space-y-1 ${
            isActive("/chef/catalog") ? "text-primary" : "text-gray-600"
          }`}
        >
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 6h16M4 12h16M4 18h16"
            />
          </svg>
          <span className="text-xs font-medium">Catalog</span>
        </Link>

        <Link
          to="/chef/cart"
          className={`flex flex-col items-center justify-center space-y-1 relative ${
            isActive("/chef/cart") ? "text-primary" : "text-gray-600"
          }`}
        >
          {count > 0 && (
            <span className="absolute top-2 right-1/4 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
              {count}
            </span>
          )}
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
            />
          </svg>
          <span className="text-xs font-medium">Cart</span>
        </Link>

        <Link
          to="/chef/orders"
          className={`flex flex-col items-center justify-center space-y-1 ${
            isActive("/chef/orders") ? "text-primary" : "text-gray-600"
          }`}
        >
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <span className="text-xs font-medium">Orders</span>
        </Link>
      </div>
    </nav>
  );
}
