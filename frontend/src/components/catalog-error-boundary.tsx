import { ReactNode, Component, ErrorInfo } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class CatalogErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    console.error("🚨 [Catalog Error Boundary] Error caught:", error);
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("🚨 [Catalog Error Boundary] Component error details:", {
      error: error.toString(),
      errorInfo: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
    });

    // Log to localStorage for debugging in E2E tests
    try {
      const logs = JSON.parse(localStorage.getItem("freshflow:error-logs") || "[]");
      logs.push({
        type: "CATALOG_ERROR",
        error: error.toString(),
        stack: error.stack,
        timestamp: new Date().toISOString(),
      });
      localStorage.setItem("freshflow:error-logs", JSON.stringify(logs.slice(-10)));
    } catch (e) {
      // Ignore localStorage errors
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[50vh] flex items-center justify-center p-4 bg-destructive/10 rounded-lg">
          <div className="text-center max-w-md">
            <AlertTriangle className="mx-auto h-12 w-12 text-destructive mb-4" />
            <h2 className="text-lg font-semibold text-destructive mb-2">
              Erro ao Carregar Catálogo
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              {this.state.error?.message || "Ocorreu um erro inesperado"}
            </p>
            {import.meta.env.DEV && (
              <details className="text-left bg-white p-2 rounded border border-border mb-4">
                <summary className="text-xs cursor-pointer font-mono">Details</summary>
                <pre className="text-xs overflow-auto max-h-40 mt-2">
                  {this.state.error?.stack}
                </pre>
              </details>
            )}
            <Button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
              variant="outline"
            >
              Recarregar Página
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
