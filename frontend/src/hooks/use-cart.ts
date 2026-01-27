import { useState, useEffect } from "react";

export interface CartItem {
  productOptionId: string;
  productName: string;
  optionName: string;
  unitType: "FIXED" | "WEIGHT";
  requestedQty: number;
  price: number;
}

const STORAGE_KEY = "freshflow:cart";

export function useCart() {
  const [items, setItems] = useState<CartItem[]>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  const addItem = (item: CartItem) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.productOptionId === item.productOptionId);

      if (existing) {
        return prev.map((i) =>
          i.productOptionId === item.productOptionId
            ? { ...i, requestedQty: i.requestedQty + item.requestedQty }
            : i
        );
      }

      return [...prev, item];
    });
  };

  const removeItem = (productOptionId: string) => {
    setItems((prev) => prev.filter((i) => i.productOptionId !== productOptionId));
  };

  const updateQuantity = (productOptionId: string, requestedQty: number) => {
    if (requestedQty <= 0) {
      removeItem(productOptionId);
      return;
    }

    setItems((prev) =>
      prev.map((i) => (i.productOptionId === productOptionId ? { ...i, requestedQty } : i))
    );
  };

  const clear = () => {
    setItems([]);
  };

  const subtotal = items.reduce((sum, item) => {
    if (item.unitType === "FIXED") {
      return sum + item.price * item.requestedQty;
    }
    return sum + item.price * item.requestedQty;
  }, 0);

  return {
    items,
    addItem,
    removeItem,
    updateQuantity,
    clear,
    subtotal,
    count: items.length,
  };
}
