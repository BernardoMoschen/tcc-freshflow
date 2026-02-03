import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import { useCart } from "@/hooks/use-cart";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart, X, ChevronRight, Loader2 } from "lucide-react";

export function CartPreview() {
  const [isOpen, setIsOpen] = useState(false);
  const { items, updateQuantity, removeItem, subtotal, count, isSyncing } = useCart();
  const drawerRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const firstFocusableRef = useRef<HTMLButtonElement>(null);

  // Handle escape key to close drawer
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen]);

  // Focus trap for accessibility
  useEffect(() => {
    if (!isOpen || !drawerRef.current) return;

    // Focus the close button when drawer opens
    closeButtonRef.current?.focus();

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab" || !drawerRef.current) return;

      const focusableElements = drawerRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (e.shiftKey && document.activeElement === firstElement) {
        e.preventDefault();
        lastElement?.focus();
      } else if (!e.shiftKey && document.activeElement === lastElement) {
        e.preventDefault();
        firstElement?.focus();
      }
    };

    document.addEventListener("keydown", handleTabKey);
    return () => document.removeEventListener("keydown", handleTabKey);
  }, [isOpen]);

  // Prevent body scroll when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const handleQuantityChange = useCallback(
    (productOptionId: string, newQty: number) => {
      updateQuantity(productOptionId, newQty);
    },
    [updateQuantity]
  );

  const handleRemove = useCallback(
    (productOptionId: string) => {
      removeItem(productOptionId);
    },
    [removeItem]
  );

  if (count === 0) {
    return (
      <Link to="/chef/cart" aria-label="Ver carrinho (vazio)">
        <Button
          variant="outline"
          size="icon"
          className="fixed bottom-20 right-4 md:bottom-6 md:right-6 h-14 w-14 rounded-full shadow-lg bg-card hover:bg-muted z-40"
          aria-label="Abrir carrinho"
        >
          <ShoppingCart className="h-6 w-6" aria-hidden="true" />
        </Button>
      </Link>
    );
  }

  return (
    <>
      {/* Floating Cart Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-20 right-4 md:bottom-6 md:right-6 h-14 w-14 rounded-full shadow-lg bg-primary hover:bg-primary/90 text-white flex items-center justify-center z-40 transition-all hover:scale-110"
        aria-label={`Abrir carrinho (${count} ${count === 1 ? "item" : "itens"})`}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
      >
        {isSyncing ? (
          <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
        ) : (
          <ShoppingCart className="h-6 w-6" aria-hidden="true" />
        )}
        <Badge
          className="absolute -top-1 -right-1 h-6 w-6 flex items-center justify-center rounded-full bg-destructive text-primary-foreground text-xs border-2 border-card"
          aria-hidden="true"
        >
          {count}
        </Badge>
      </button>

      {/* Cart Drawer */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 z-40 animate-in fade-in duration-200"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />

          {/* Drawer */}
          <div
            ref={drawerRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="cart-drawer-title"
            aria-busy={isSyncing}
            className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-card z-50 shadow-2xl animate-in slide-in-from-right duration-300 flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b bg-muted">
              <div className="flex items-center gap-3">
                <ShoppingCart className="h-5 w-5" aria-hidden="true" />
                <h2 id="cart-drawer-title" className="font-semibold text-lg">Seu Carrinho</h2>
                <Badge variant="secondary">{count} {count === 1 ? "item" : "itens"}</Badge>
                {isSyncing && (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-label="Sincronizando..." />
                )}
              </div>
              <Button
                ref={closeButtonRef}
                variant="ghost"
                size="icon"
                onClick={() => setIsOpen(false)}
                className="rounded-full"
                aria-label="Fechar carrinho"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </Button>
            </div>

            {/* Cart Items - Scrollable */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {items.map((item, index) => (
                <div
                  key={item.productOptionId}
                  className="bg-muted rounded-lg p-3 space-y-2"
                >
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-sm truncate">{item.productName}</h3>
                      <p className="text-xs text-muted-foreground truncate">{item.optionName}</p>
                    </div>
                    <button
                      onClick={() => handleRemove(item.productOptionId)}
                      disabled={isSyncing}
                      className="text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50 min-h-[44px] min-w-[44px] flex items-center justify-center"
                      aria-label={`Remover ${item.productName} do carrinho`}
                    >
                      <X className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2" role="group" aria-label={`Quantidade de ${item.productName}`}>
                      <button
                        ref={index === 0 ? firstFocusableRef : undefined}
                        onClick={() =>
                          handleQuantityChange(item.productOptionId, Math.max(0.1, item.requestedQty - 1))
                        }
                        disabled={isSyncing}
                        className="h-11 w-11 rounded border border-border hover:bg-muted flex items-center justify-center transition-colors disabled:opacity-50"
                        aria-label={`Diminuir quantidade de ${item.productName}`}
                      >
                        <span aria-hidden="true">-</span>
                      </button>
                      <span className="text-sm font-medium w-12 text-center" aria-live="polite">
                        {item.requestedQty}
                      </span>
                      <button
                        onClick={() =>
                          handleQuantityChange(item.productOptionId, item.requestedQty + 1)
                        }
                        disabled={isSyncing}
                        className="h-11 w-11 rounded border border-border hover:bg-muted flex items-center justify-center transition-colors disabled:opacity-50"
                        aria-label={`Aumentar quantidade de ${item.productName}`}
                      >
                        <span aria-hidden="true">+</span>
                      </button>
                    </div>

                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">
                        R$ {(item.price / 100).toFixed(2)}
                        {item.unitType === "WEIGHT" ? "/kg" : ""}
                      </p>
                      <p className="text-sm font-semibold text-primary">
                        R$ {((item.price * item.requestedQty) / 100).toFixed(2)}
                      </p>
                    </div>
                  </div>

                  {item.notes && (
                    <p className="text-xs text-muted-foreground italic bg-card p-2 rounded">
                      Obs: {item.notes}
                    </p>
                  )}
                </div>
              ))}
            </div>

            {/* Footer with Subtotal and Checkout */}
            <div className="border-t p-4 space-y-3 bg-muted">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Subtotal:</span>
                <span className="text-xl font-bold text-primary">
                  R$ {(subtotal / 100).toFixed(2)}
                </span>
              </div>

              <Link to="/chef/cart" onClick={() => setIsOpen(false)}>
                <Button className="w-full h-12" size="lg" disabled={isSyncing}>
                  {isSyncing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sincronizando...
                    </>
                  ) : (
                    <>
                      Ir para o Carrinho
                      <ChevronRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </Link>

              <p className="text-xs text-center text-muted-foreground">
                Itens por peso são precificados após pesagem
              </p>
            </div>
          </div>
        </>
      )}
    </>
  );
}
