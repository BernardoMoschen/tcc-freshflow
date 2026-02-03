import { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { ErrorBoundary } from "./error-boundary";
import { Button } from "./ui/button";
import { AlertTriangle, ArrowLeft, RefreshCw } from "lucide-react";

interface PageErrorFallbackProps {
  pageName?: string;
}

/**
 * Fallback UI for page-level errors - simpler than full app error boundary
 */
function PageErrorFallback({ pageName }: PageErrorFallbackProps) {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] p-8">
      <div className="flex items-center justify-center w-12 h-12 bg-warning/10 rounded-full mb-4">
        <AlertTriangle className="w-6 h-6 text-warning" aria-hidden="true" />
      </div>

      <h2 className="text-lg font-semibold text-card-foreground mb-2">
        Erro ao carregar {pageName || "página"}
      </h2>

      <p className="text-sm text-muted-foreground text-center max-w-md mb-6">
        Ocorreu um problema ao carregar esta seção. Tente novamente ou volte para a página anterior.
      </p>

      <div className="flex gap-3">
        <Button
          variant="outline"
          onClick={() => navigate(-1)}
          className="flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar
        </Button>
        <Button
          onClick={() => window.location.reload()}
          className="flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Recarregar
        </Button>
      </div>
    </div>
  );
}

interface PageErrorBoundaryProps {
  children: ReactNode;
  pageName?: string;
  onError?: (error: Error) => void;
}

/**
 * Error boundary wrapper for individual pages.
 * Provides localized error handling without crashing the entire app.
 */
export function PageErrorBoundary({ children, pageName, onError }: PageErrorBoundaryProps) {
  return (
    <ErrorBoundary
      fallback={<PageErrorFallback pageName={pageName} />}
      onError={(error, errorInfo) => {
        console.error(`Page error in ${pageName || "unknown page"}:`, error, errorInfo);
        onError?.(error);
      }}
    >
      {children}
    </ErrorBoundary>
  );
}
