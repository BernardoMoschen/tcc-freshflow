import { ReactNode } from "react";
import { Navbar } from "./navbar";

interface PageLayoutProps {
  children: ReactNode;
  title: string;
  showNav?: boolean;
  action?: ReactNode;
}

export function PageLayout({ children, title, showNav = true, action }: PageLayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      {showNav && <Navbar />}

      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4 md:py-6">
          <div className="flex justify-between items-center">
            <h1 className="text-xl md:text-2xl font-bold text-gray-900">{title}</h1>
            {action && <div>{action}</div>}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-4 md:py-8">{children}</div>
    </div>
  );
}
