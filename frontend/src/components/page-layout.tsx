import { ReactNode } from "react";
import { MobileNav } from "./mobile-nav";

interface PageLayoutProps {
  children: ReactNode;
  title: string;
  showNav?: boolean;
  action?: ReactNode;
}

export function PageLayout({ children, title, showNav = true, action }: PageLayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50 pb-16 md:pb-0">
      <nav className="bg-white shadow-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4 md:py-6">
          <div className="flex justify-between items-center">
            <h1 className="text-xl md:text-2xl font-bold text-gray-900">{title}</h1>
            {action && <div>{action}</div>}
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 py-4 md:py-8">{children}</div>

      {showNav && <MobileNav />}
    </div>
  );
}
