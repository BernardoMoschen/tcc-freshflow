import { useEffect, useMemo, useRef, useCallback, useState } from "react";
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
  const utils = trpc.useUtils();

  // Optimistic state for immediate UI updates
  const [optimisticItems, setOptimisticItems] = useState<CartItem[] | null>(null);

  // Only fetch draft if user has account context (account users only)
  // Platform admins and tenant admins without account context don't have carts
  const hasAccountContext = !!localStorage.getItem("freshflow:accountId");

  // Fetch draft order with improved error handling
  const draftQuery = trpc.orders.getDraft.useQuery(undefined, {
    retry: (failureCount, error) => {
      // Don't retry on auth/permission errors
      if (error?.data?.code === "UNAUTHORIZED" || error?.data?.code === "FORBIDDEN") {
        return false;
      }
      // Don't retry on NOT_FOUND (customer not found)
      if (error?.data?.code === "NOT_FOUND") {
        return false;
      }
      // Retry other errors up to 2 times
      return failureCount < 2;
    },
    staleTime: 1000 * 30, // 30 seconds
    enabled: hasAccountContext,
    // Prevent rapid refetches on window focus when there's an error
    refetchOnWindowFocus: (query) => query.state.status !== "error",
  });

  // Update draft mutation with optimistic updates
  const updateDraftMutation = trpc.orders.updateDraft.useMutation({
    onSuccess: (data) => {
      // Update cache from server response without refetching
      utils.orders.getDraft.setData(undefined, data);
      setOptimisticItems(null);
      // Clear offline storage on successful sync
      localStorage.removeItem(STORAGE_KEY);
    },
    onError: (error) => {
      // Clear optimistic state on error (revert to server state)
      setOptimisticItems(null);
      toast.error("Failed to update cart", {
        description: error.message,
      });
    },
  });

  // Clear draft mutation with optimistic update
  const clearDraftMutation = trpc.orders.clearDraft.useMutation({
    onMutate: () => {
      // Optimistically clear the cart
      setOptimisticItems([]);
    },
    onSuccess: () => {
      setOptimisticItems(null);
      utils.orders.getDraft.invalidate();
      localStorage.removeItem(STORAGE_KEY);
      toast.success("Cart cleared");
    },
    onError: (error) => {
      // Revert optimistic update
      setOptimisticItems(null);
      toast.error("Failed to clear cart", {
        description: error.message,
      });
    },
  });

  // Convert order items to cart items (from server data)
  const serverItems: CartItem[] = useMemo(() => {
    if (!draftQuery.data?.items) return [];

    return draftQuery.data.items.map((item: any) => ({
      productOptionId: item.productOptionId,
      productName: item.productOption.product.name,
      optionName: item.productOption.name,
      unitType: item.productOption.unitType,
      requestedQty: item.requestedQty,
      price: item.finalPrice || item.productOption.basePrice,
      notes: item.notes ?? undefined,
    }));
  }, [draftQuery.data]);

  // Use optimistic items if available, otherwise use server items
  const items = optimisticItems !== null ? optimisticItems : serverItems;

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

  // Sync items to server with optimistic update
  const syncToServer = useCallback((updatedItems: CartItem[]) => {
    if (!draftQuery.data?.id) {
      // Offline: store in localStorage and update optimistic state
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedItems));
      setOptimisticItems(updatedItems);
      return;
    }

    // Set optimistic state immediately for instant UI feedback
    setOptimisticItems(updatedItems);

    // Online: update draft on server
    updateDraftMutation.mutate({
      orderId: draftQuery.data.id,
      items: updatedItems.map((item) => ({
        productOptionId: item.productOptionId,
        requestedQty: item.requestedQty,
        notes: item.notes ?? undefined,
      })),
    });
  }, [draftQuery.data?.id, updateDraftMutation]);

  const addItem = useCallback((item: CartItem) => {
    // Use current items (either optimistic or server)
    const currentItems = optimisticItems !== null ? optimisticItems : serverItems;
    const existing = currentItems.find((i) => i.productOptionId === item.productOptionId);

    let updatedItems: CartItem[];
    if (existing) {
      updatedItems = currentItems.map((i) =>
        i.productOptionId === item.productOptionId
          ? { ...i, requestedQty: i.requestedQty + item.requestedQty }
          : i
      );
    } else {
      updatedItems = [...currentItems, item];
    }

    syncToServer(updatedItems);
  }, [optimisticItems, serverItems, syncToServer]);

  const removeItem = useCallback((productOptionId: string) => {
    const currentItems = optimisticItems !== null ? optimisticItems : serverItems;
    const updatedItems = currentItems.filter((i) => i.productOptionId !== productOptionId);
    syncToServer(updatedItems);
  }, [optimisticItems, serverItems, syncToServer]);

  const updateQuantity = useCallback((productOptionId: string, requestedQty: number, immediate = false) => {
    if (requestedQty <= 0) {
      removeItem(productOptionId);
      return;
    }

    const currentItems = optimisticItems !== null ? optimisticItems : serverItems;
    const updatedItems = currentItems.map((i) =>
      i.productOptionId === productOptionId ? { ...i, requestedQty } : i
    );
    setOptimisticItems(updatedItems);
    if (immediate) {
      syncToServer(updatedItems);
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedItems));
    }
  }, [optimisticItems, removeItem, serverItems, syncToServer]);

  const updateNotes = useCallback((productOptionId: string, notes: string, immediate = false) => {
    const currentItems = optimisticItems !== null ? optimisticItems : serverItems;
    const updatedItems = currentItems.map((i) =>
      i.productOptionId === productOptionId ? { ...i, notes } : i
    );
    setOptimisticItems(updatedItems);
    if (immediate) {
      syncToServer(updatedItems);
    } else {
      // Keep local cache while typing; sync happens on blur
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedItems));
    }
  }, [optimisticItems, serverItems, syncToServer]);

  const clear = useCallback(() => {
    if (draftQuery.data?.id) {
      clearDraftMutation.mutate({ orderId: draftQuery.data.id });
    }
  }, [draftQuery.data?.id, clearDraftMutation]);

  const subtotal = useMemo(() => {
    return items.reduce((sum, item) => {
      return sum + item.price * item.requestedQty;
    }, 0);
  }, [items]);

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
    isOptimistic: optimisticItems !== null,
    hasAccountContext,
  };
}
