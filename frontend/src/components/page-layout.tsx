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
    <div className="min-h-screen bg-muted">
      {showNav && <Navbar />}

      <div className="bg-card shadow-sm border-b border-border">
        <div className="max-w-7xl mx-auto px-4 py-4 md:py-6">
          <div className="flex justify-between items-center">
            <h1 className="text-xl md:text-2xl font-bold text-card-foreground">{title}</h1>
            {action && <div>{action}</div>}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-4 md:py-8">{children}</div>
    </div>
  );
}
