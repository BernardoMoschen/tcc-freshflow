import { useEffect, useMemo, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

export interface CartItem {
  productOptionId: string;
  productName: string;
  optionName: string;
  unitType: "FIXED" | "WEIGHT";
  requestedQty: number;
  price: number;
  notes?: string;
}

const STORAGE_KEY = "freshflow:cart-offline";

export function useCart() {
  const hasSyncedOffline = useRef(false);

  // Only fetch draft if user has account context (account users only)
  // Platform admins and tenant admins without account context don't have carts
  const hasAccountContext = !!localStorage.getItem("freshflow:accountId");

  // Fetch draft order
  const draftQuery = trpc.orders.getDraft.useQuery(undefined, {
    retry: 1,
    staleTime: 1000 * 30, // 30 seconds
    enabled: hasAccountContext,
  });

  // Update draft mutation
  const updateDraftMutation = trpc.orders.updateDraft.useMutation({
    onSuccess: () => {
      draftQuery.refetch();
      // Clear offline storage on successful sync
      localStorage.removeItem(STORAGE_KEY);
    },
    onError: (error) => {
      toast.error("Failed to update cart", {
        description: error.message,
      });
    },
  });

  // Clear draft mutation
  const clearDraftMutation = trpc.orders.clearDraft.useMutation({
    onSuccess: () => {
      draftQuery.refetch();
      localStorage.removeItem(STORAGE_KEY);
      toast.success("Cart cleared");
    },
    onError: (error) => {
      toast.error("Failed to clear cart", {
        description: error.message,
      });
    },
  });

  // Convert order items to cart items
  const items: CartItem[] = useMemo(() => {
    if (!draftQuery.data?.items) return [];

    return draftQuery.data.items.map((item: any) => ({
      productOptionId: item.productOptionId,
      productName: item.productOption.product.name,
      optionName: item.productOption.name,
      unitType: item.productOption.unitType,
      requestedQty: item.requestedQty,
      price: item.finalPrice || item.productOption.basePrice,
      notes: item.notes,
    }));
  }, [draftQuery.data]);

  // Sync offline cart to server when online (run once)
  useEffect(() => {
    if (draftQuery.data && !draftQuery.isLoading && !hasSyncedOffline.current) {
      const offlineCart = localStorage.getItem(STORAGE_KEY);
      if (offlineCart) {
        try {
          const offlineItems = JSON.parse(offlineCart) as CartItem[];
          if (offlineItems.length > 0 && draftQuery.data.id) {
            hasSyncedOffline.current = true;

            // Merge with existing items
            const currentItems = draftQuery.data.items.map((item: any) => ({
              productOptionId: item.productOptionId,
              requestedQty: item.requestedQty,
            }));

            const merged = [...currentItems];
            offlineItems.forEach((offlineItem) => {
              const existing = merged.find(
                (i) => i.productOptionId === offlineItem.productOptionId
              );
              if (existing) {
                existing.requestedQty += offlineItem.requestedQty;
              } else {
                merged.push({
                  productOptionId: offlineItem.productOptionId,
                  requestedQty: offlineItem.requestedQty,
                });
              }
            });

            // Update draft on server
            updateDraftMutation.mutate({
              orderId: draftQuery.data.id,
              items: merged,
            });
          }
        } catch (error) {
          console.error("Failed to sync offline cart:", error);
          localStorage.removeItem(STORAGE_KEY);
        }
      }
    }
  }, [draftQuery.data?.id, draftQuery.isLoading]);

  const syncToServer = (updatedItems: CartItem[]) => {
    if (!draftQuery.data?.id) {
      // Offline: store in localStorage
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedItems));
      return;
    }

    // Online: update draft on server
    updateDraftMutation.mutate({
      orderId: draftQuery.data.id,
      items: updatedItems.map((item) => ({
        productOptionId: item.productOptionId,
        requestedQty: item.requestedQty,
      })),
    });
  };

  const addItem = (item: CartItem) => {
    const existing = items.find((i) => i.productOptionId === item.productOptionId);

    let updatedItems: CartItem[];
    if (existing) {
      updatedItems = items.map((i) =>
        i.productOptionId === item.productOptionId
          ? { ...i, requestedQty: i.requestedQty + item.requestedQty }
          : i
      );
    } else {
      updatedItems = [...items, item];
    }

    syncToServer(updatedItems);
  };

  const removeItem = (productOptionId: string) => {
    const updatedItems = items.filter((i) => i.productOptionId !== productOptionId);
    syncToServer(updatedItems);
  };

  const updateQuantity = (productOptionId: string, requestedQty: number) => {
    if (requestedQty <= 0) {
      removeItem(productOptionId);
      return;
    }

    const updatedItems = items.map((i) =>
      i.productOptionId === productOptionId ? { ...i, requestedQty } : i
    );
    syncToServer(updatedItems);
  };

  const updateNotes = (productOptionId: string, notes: string) => {
    const updatedItems = items.map((i) =>
      i.productOptionId === productOptionId ? { ...i, notes } : i
    );
    syncToServer(updatedItems);
  };

  const clear = () => {
    if (draftQuery.data?.id) {
      clearDraftMutation.mutate({ orderId: draftQuery.data.id });
    }
  };

  const subtotal = items.reduce((sum, item) => {
    return sum + item.price * item.requestedQty;
  }, 0);

  return {
    items,
    addItem,
    removeItem,
    updateQuantity,
    updateNotes,
    clear,
    subtotal,
    count: items.length,
    draftOrderId: draftQuery.data?.id,
    isLoading: hasAccountContext && draftQuery.isLoading,
    isSyncing: updateDraftMutation.isPending || clearDraftMutation.isPending,
    hasAccountContext,
  };
}
