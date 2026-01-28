import { useState } from "react";
import { Link } from "react-router-dom";
import { useCart } from "@/hooks/use-cart";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart, X, ChevronRight } from "lucide-react";

export function CartPreview() {
  const [isOpen, setIsOpen] = useState(false);
  const { items, updateQuantity, removeItem, subtotal, count } = useCart();

  if (count === 0) {
    return (
      <Link to="/chef/cart" aria-label="Ver carrinho (vazio)">
        <Button
          variant="outline"
          size="icon"
          className="fixed bottom-4 right-4 md:bottom-6 md:right-6 h-14 w-14 rounded-full shadow-lg bg-white hover:bg-gray-50 z-40"
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
        className="fixed bottom-4 right-4 md:bottom-6 md:right-6 h-14 w-14 rounded-full shadow-lg bg-primary hover:bg-primary/90 text-white flex items-center justify-center z-40 transition-all hover:scale-110"
        aria-label={`Abrir carrinho (${count} ${count === 1 ? "item" : "itens"})`}
        aria-haspopup="dialog"
      >
        <ShoppingCart className="h-6 w-6" aria-hidden="true" />
        <Badge className="absolute -top-1 -right-1 h-6 w-6 flex items-center justify-center rounded-full bg-red-500 text-white text-xs border-2 border-white" aria-hidden="true">
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
            role="dialog"
            aria-modal="true"
            aria-labelledby="cart-drawer-title"
            className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-white z-50 shadow-2xl animate-in slide-in-from-right duration-300 flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b bg-gray-50">
              <div className="flex items-center gap-3">
                <ShoppingCart className="h-5 w-5" aria-hidden="true" />
                <h2 id="cart-drawer-title" className="font-semibold text-lg">Seu Carrinho</h2>
                <Badge variant="secondary">{count} {count === 1 ? "item" : "itens"}</Badge>
              </div>
              <Button
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
              {items.map((item) => (
                <div
                  key={item.productOptionId}
                  className="bg-gray-50 rounded-lg p-3 space-y-2"
                >
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-sm truncate">{item.productName}</h3>
                      <p className="text-xs text-gray-600 truncate">{item.optionName}</p>
                    </div>
                    <button
                      onClick={() => removeItem(item.productOptionId)}
                      className="text-gray-400 hover:text-red-600 transition-colors"
                      aria-label={`Remover ${item.productName} do carrinho`}
                    >
                      <X className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2" role="group" aria-label={`Quantidade de ${item.productName}`}>
                      <button
                        onClick={() =>
                          updateQuantity(item.productOptionId, Math.max(0.1, item.requestedQty - 1))
                        }
                        className="h-8 w-8 rounded border border-gray-300 hover:bg-gray-200 flex items-center justify-center transition-colors"
                        aria-label={`Diminuir quantidade de ${item.productName}`}
                      >
                        <span aria-hidden="true">-</span>
                      </button>
                      <span className="text-sm font-medium w-12 text-center" aria-live="polite">
                        {item.requestedQty}
                      </span>
                      <button
                        onClick={() =>
                          updateQuantity(item.productOptionId, item.requestedQty + 1)
                        }
                        className="h-8 w-8 rounded border border-gray-300 hover:bg-gray-200 flex items-center justify-center transition-colors"
                        aria-label={`Aumentar quantidade de ${item.productName}`}
                      >
                        <span aria-hidden="true">+</span>
                      </button>
                    </div>

                    <div className="text-right">
                      <p className="text-xs text-gray-500">
                        R$ {(item.price / 100).toFixed(2)}
                        {item.unitType === "WEIGHT" ? "/kg" : ""}
                      </p>
                      <p className="text-sm font-semibold text-primary">
                        R$ {((item.price * item.requestedQty) / 100).toFixed(2)}
                      </p>
                    </div>
                  </div>

                  {item.notes && (
                    <p className="text-xs text-gray-600 italic bg-white p-2 rounded">
                      Note: {item.notes}
                    </p>
                  )}
                </div>
              ))}
            </div>

            {/* Footer with Subtotal and Checkout */}
            <div className="border-t p-4 space-y-3 bg-gray-50">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Subtotal:</span>
                <span className="text-xl font-bold text-primary">
                  R$ {(subtotal / 100).toFixed(2)}
                </span>
              </div>

              <Link to="/chef/cart" onClick={() => setIsOpen(false)}>
                <Button className="w-full" size="lg">
                  Go to Cart
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>

              <p className="text-xs text-center text-gray-500">
                Weight items priced after weighing
              </p>
            </div>
          </div>
        </>
      )}
    </>
  );
}
