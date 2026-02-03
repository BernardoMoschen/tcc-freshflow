import { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw, Home, Bug } from "lucide-react";
import { Button } from "./ui/button";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorId: string | null;
  isReporting: boolean;
  reportSent: boolean;
}

/**
 * Generate a unique error ID for tracking
 */
function generateErrorId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `err_${timestamp}_${random}`;
}

/**
 * Report error to backend
 */
async function reportErrorToBackend(
  errorId: string,
  error: Error,
  errorInfo: ErrorInfo
): Promise<boolean> {
  try {
    const errorPayload = {
      errorId,
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      url: window.location.href,
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString(),
    };

    // Log to console in dev mode
    if (import.meta.env.DEV) {
      console.error("🚨 Error Report:", errorPayload);
    }

    // Send to backend error tracking endpoint
    const response = await fetch("/api/v1/errors", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Include auth token if available
        ...(localStorage.getItem("freshflow:token")
          ? { Authorization: `Bearer ${localStorage.getItem("freshflow:token")}` }
          : {}),
      },
      body: JSON.stringify(errorPayload),
    });

    return response.ok;
  } catch (reportError) {
    console.error("Failed to report error:", reportError);
    return false;
  }
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
      isReporting: false,
      reportSent: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
      errorId: generateErrorId(),
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error to console with structured format
    console.error("🚨 Application Error:", {
      errorId: this.state.errorId,
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
    });

    this.setState({ errorInfo });

    // Call optional error handler
    this.props.onError?.(error, errorInfo);

    // Report to backend automatically
    if (this.state.errorId) {
      this.setState({ isReporting: true });
      reportErrorToBackend(this.state.errorId, error, errorInfo)
        .then((success) => {
          this.setState({ isReporting: false, reportSent: success });
        })
        .catch(() => {
          this.setState({ isReporting: false, reportSent: false });
        });
    }
  }

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
      isReporting: false,
      reportSent: false,
    });
  };

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = "/chef/catalog";
  };

  render() {
    if (this.state.hasError) {
      // Allow custom fallback
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const isDev = import.meta.env.DEV;

      return (
        <div className="min-h-screen flex items-center justify-center bg-muted px-4">
          <div className="max-w-md w-full bg-card rounded-lg shadow-lg p-8">
            <div className="flex items-center justify-center w-16 h-16 bg-destructive/10 rounded-full mx-auto mb-4">
              <AlertTriangle className="w-8 h-8 text-destructive" aria-hidden="true" />
            </div>

            <h1 className="text-2xl font-bold text-card-foreground text-center mb-2">
              Ops! Algo deu errado
            </h1>

            <p className="text-muted-foreground text-center mb-4">
              Encontramos um erro inesperado. Tente novamente ou entre em contato com o suporte.
            </p>

            {this.state.errorId && (
              <p className="text-xs text-muted-foreground text-center mb-6">
                ID do erro: <code className="bg-muted px-1 rounded">{this.state.errorId}</code>
                {this.state.reportSent && (
                  <span className="ml-2 text-success">✓ Reportado</span>
                )}
                {this.state.isReporting && (
                  <span className="ml-2 text-primary">Reportando...</span>
                )}
              </p>
            )}

            {isDev && this.state.error && (
              <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-md">
                <div className="flex items-center gap-2 mb-2">
                  <Bug className="w-4 h-4 text-destructive" aria-hidden="true" />
                  <span className="text-sm font-medium text-destructive">Erro (Dev)</span>
                </div>
                <p className="text-sm font-mono text-destructive break-all">
                  {this.state.error.message}
                </p>
              </div>
            )}

            <div className="flex flex-col gap-3">
              <Button onClick={this.handleRetry} className="w-full" variant="default">
                <RefreshCw className="w-4 h-4 mr-2" aria-hidden="true" />
                Tentar Novamente
              </Button>

              <div className="flex gap-3">
                <Button onClick={this.handleReload} className="flex-1" variant="outline">
                  <RefreshCw className="w-4 h-4 mr-2" aria-hidden="true" />
                  Recarregar
                </Button>

                <Button onClick={this.handleGoHome} className="flex-1" variant="outline">
                  <Home className="w-4 h-4 mr-2" aria-hidden="true" />
                  Início
                </Button>
              </div>
            </div>

            {isDev && this.state.error?.stack && (
              <details className="mt-6">
                <summary className="text-sm text-muted-foreground cursor-pointer hover:text-foreground">
                  Ver Stack Trace (Dev)
                </summary>
                <pre className="mt-2 p-4 bg-muted border border-border rounded text-xs overflow-auto max-h-64">
                  {this.state.error.stack}
                </pre>
                {this.state.errorInfo?.componentStack && (
                  <>
                    <p className="mt-3 text-sm text-muted-foreground">Component Stack:</p>
                    <pre className="mt-1 p-4 bg-muted border border-border rounded text-xs overflow-auto max-h-64">
                      {this.state.errorInfo.componentStack}
                    </pre>
                  </>
                )}
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Hook-friendly error boundary wrapper
 */
export function withErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  fallback?: ReactNode
) {
  return function WithErrorBoundary(props: P) {
    return (
      <ErrorBoundary fallback={fallback}>
        <WrappedComponent {...props} />
      </ErrorBoundary>
    );
  };
}
