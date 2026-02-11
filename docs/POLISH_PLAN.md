# FreshFlow Polish Plan 🎨

## Goal: Perfect the Experience Before Launch

**Timeline:** 3-4 weeks
**Focus:** Quality, reliability, user experience

---

## Week 1: Testing & Stability (Foundation)

### Phase 1.1: End-to-End Testing (Days 1-2)
**Goal:** Find and document all bugs

#### Test Checklist

**Authentication Flow**
- [ ] Login page loads correctly
- [ ] Login with valid credentials works
- [ ] Login with invalid credentials shows error
- [ ] Logout clears session
- [ ] Protected routes redirect to login
- [ ] Session persists on page refresh

**Chef Flow - Product Catalog**
- [ ] Products load and display correctly
- [ ] Search filters products in real-time
- [ ] Price filters work (min/max)
- [ ] Unit type filter works (FIXED/WEIGHT)
- [ ] Sort by name/price works
- [ ] Product images load (if present)
- [ ] Mobile: Filter panel toggles correctly
- [ ] Add to cart button works
- [ ] Toast notification appears on add

**Chef Flow - Shopping Cart**
- [ ] Cart displays all added items
- [ ] Quantity adjustment works
- [ ] Remove item works
- [ ] Subtotal calculates correctly
- [ ] Empty cart shows empty state
- [ ] "Send Order" button disabled when empty
- [ ] Order submission works
- [ ] Success toast appears
- [ ] Redirects to orders page
- [ ] Cart clears after submission

**Chef Flow - Orders List**
- [ ] Orders display with correct status badges
- [ ] Order details show correctly
- [ ] Filter by status works
- [ ] PDF download works for FINALIZED orders
- [ ] Empty state shows when no orders
- [ ] Date formatting is correct (pt-BR)

**Admin Flow - Weighing Interface**
- [ ] Order loads with all items
- [ ] Requested quantity displays correctly
- [ ] Weight input accepts decimal numbers
- [ ] Price override input works
- [ ] "Persist price" checkbox works
- [ ] Save button disabled with invalid input
- [ ] Weighing saves successfully
- [ ] Toast notifications work
- [ ] Already weighed items show green badge
- [ ] Input fields clear after successful save

**Admin Flow - Offline Mode**
- [ ] Offline indicator appears when disconnected
- [ ] Weighing queues when offline
- [ ] "Pending" counter shows queued items
- [ ] Sync happens automatically when online
- [ ] Success toast appears after sync
- [ ] Queue counter updates after sync

**Admin Flow - Order Finalization**
- [ ] Order summary displays correctly
- [ ] Fixed items total calculates correctly
- [ ] Weight items total calculates correctly
- [ ] Grand total is accurate
- [ ] Warning shows for unweighed items
- [ ] Finalize button disabled until all weighed
- [ ] Confirmation dialog appears
- [ ] Dialog Cancel button works
- [ ] Finalize succeeds and updates status
- [ ] PDF download button appears
- [ ] PDF downloads and opens correctly
- [ ] PDF contains all order details
- [ ] PDF formatting is correct (pt-BR)

**Mobile Responsiveness**
- [ ] All pages work on mobile (375px width)
- [ ] Touch targets are at least 44px
- [ ] No horizontal scrolling
- [ ] Forms don't zoom on iOS (16px font size)
- [ ] Sticky headers work correctly
- [ ] Dialogs/modals are mobile-friendly
- [ ] Text is readable without zooming

**Performance**
- [ ] Initial page load < 3 seconds
- [ ] Navigation is instant
- [ ] API calls complete < 2 seconds
- [ ] No console errors
- [ ] No TypeScript errors
- [ ] Images optimized
- [ ] Bundle size reasonable

**Edge Cases**
- [ ] Long product names don't break layout
- [ ] Large order (20+ items) displays correctly
- [ ] Decimal quantities work correctly
- [ ] Zero quantity handled properly
- [ ] Network errors show user-friendly messages
- [ ] Concurrent weighing doesn't cause conflicts
- [ ] PDF generation for large orders works

#### Bug Tracking Template
```markdown
## Bug #X: [Short Description]
**Severity:** Critical / High / Medium / Low
**Page:** [URL or component]
**Steps to Reproduce:**
1.
2.
3.

**Expected:**
**Actual:**
**Screenshot:** [if applicable]
**Console Errors:** [if any]
```

### Phase 1.2: Bug Fixing Sprint (Days 3-5)
- Fix all Critical bugs
- Fix all High bugs
- Document Medium/Low bugs for later
- Retest after fixes
- Update tests if needed

---

## Week 2: Real-time Updates & Offline Polish

### Phase 2.1: Real-time Order Status (Days 6-8)

#### Backend Changes
**File:** `backend/src/routers/orders.router.ts`

```typescript
import { observable } from "@trpc/server/observable";
import { EventEmitter } from "events";

const orderEvents = new EventEmitter();

export const ordersRouter = router({
  // ... existing procedures ...

  /**
   * Subscribe to order status changes
   */
  onStatusChange: protectedProcedure
    .input(z.object({ orderId: z.string().uuid() }))
    .subscription(async ({ ctx, input }) => {
      return observable<Order>((emit) => {
        const handler = (data: { orderId: string; order: Order }) => {
          if (data.orderId === input.orderId) {
            emit.next(data.order);
          }
        };

        orderEvents.on("orderUpdated", handler);

        return () => {
          orderEvents.off("orderUpdated", handler);
        };
      });
    }),
});

// Update existing mutations to emit events
async function updateOrderStatus(orderId: string, status: OrderStatus) {
  const order = await prisma.order.update({
    where: { id: orderId },
    data: { status },
    include: { /* full order with relations */ }
  });

  // Emit event for real-time updates
  orderEvents.emit("orderUpdated", { orderId, order });

  return order;
}
```

#### Frontend Changes
**File:** `frontend/src/hooks/use-order-subscription.ts`

```typescript
import { useEffect } from "react";
import { trpc } from "@/lib/trpc";

export function useOrderSubscription(orderId: string | undefined) {
  const utils = trpc.useUtils();

  useEffect(() => {
    if (!orderId) return;

    const subscription = trpc.orders.onStatusChange.subscribe(
      { orderId },
      {
        onData: (order) => {
          // Update cached order data
          utils.orders.get.setData({ id: orderId }, order);

          // Show toast notification
          toast.info(`Order status updated: ${order.status}`);
        },
        onError: (error) => {
          console.error("Subscription error:", error);
        },
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [orderId, utils]);
}
```

**Usage in components:**
```typescript
// In OrdersPage.tsx
useOrderSubscription(undefined); // Subscribe to all orders

// In FinalizePage.tsx
useOrderSubscription(orderId); // Subscribe to specific order
```

#### Features
- [x] Real-time status updates across devices
- [x] Auto-refresh order list when status changes
- [x] Toast notification on updates
- [x] WebSocket connection management
- [x] Reconnection on disconnect

### Phase 2.2: Enhanced Offline Sync (Days 9-10)

#### Better IndexedDB Schema
**File:** `frontend/src/lib/offline.ts`

```typescript
import Dexie, { Table } from "dexie";

interface QueuedWeighing {
  id: string;
  orderItemId: string;
  actualWeight: number;
  finalPrice?: number;
  persistPrice: boolean;
  notes?: string;
  timestamp: number;
  retries: number;
  status: "pending" | "syncing" | "failed" | "synced";
  error?: string;
  localVersion: number; // For conflict detection
}

class OfflineDatabase extends Dexie {
  weighings!: Table<QueuedWeighing>;

  constructor() {
    super("FreshFlowOffline");
    this.version(1).stores({
      weighings: "++id, orderItemId, timestamp, status",
    });
  }
}

const db = new OfflineDatabase();

// Queue weighing with retry logic
export async function queueWeighing(data: WeighingInput) {
  const queued: QueuedWeighing = {
    id: crypto.randomUUID(),
    ...data,
    timestamp: Date.now(),
    retries: 0,
    status: "pending",
    localVersion: 1,
  };

  await db.weighings.add(queued);
  return queued;
}

// Sync with conflict detection
export async function syncQueue() {
  const pending = await db.weighings
    .where("status")
    .equals("pending")
    .toArray();

  for (const item of pending) {
    try {
      // Mark as syncing
      await db.weighings.update(item.id!, { status: "syncing" });

      // Check for server conflicts
      const serverItem = await trpc.orders.getItem.query({
        id: item.orderItemId,
      });

      if (serverItem.localVersion > item.localVersion) {
        // Conflict detected!
        await db.weighings.update(item.id!, {
          status: "failed",
          error: "Conflict: Item was updated on server",
        });
        continue;
      }

      // Sync to server
      await trpc.orders.weigh.mutate({
        orderItemId: item.orderItemId,
        actualWeight: item.actualWeight,
        finalPrice: item.finalPrice,
        persistPrice: item.persistPrice,
        notes: item.notes,
      });

      // Mark as synced
      await db.weighings.update(item.id!, { status: "synced" });
    } catch (error) {
      // Retry logic
      const newRetries = item.retries + 1;
      if (newRetries >= 3) {
        await db.weighings.update(item.id!, {
          status: "failed",
          error: error instanceof Error ? error.message : "Unknown error",
          retries: newRetries,
        });
      } else {
        await db.weighings.update(item.id!, {
          status: "pending",
          retries: newRetries,
        });
      }
    }
  }
}
```

#### UI Components
**File:** `frontend/src/components/offline-status.tsx`

```typescript
export function OfflineStatus() {
  const { isOnline } = useOffline();
  const { data: queue } = useQuery({
    queryKey: ["offline-queue"],
    queryFn: () => db.weighings.where("status").equals("pending").count(),
    refetchInterval: 1000,
  });

  const { data: failed } = useQuery({
    queryKey: ["offline-failed"],
    queryFn: () => db.weighings.where("status").equals("failed").count(),
    refetchInterval: 1000,
  });

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {!isOnline && (
        <Badge variant="destructive" className="mb-2">
          Offline
        </Badge>
      )}
      {queue > 0 && (
        <Badge variant="warning">
          {queue} pending sync
        </Badge>
      )}
      {failed > 0 && (
        <Button
          variant="destructive"
          size="sm"
          onClick={() => {/* Show failed items dialog */}}
        >
          {failed} failed - Review
        </Button>
      )}
    </div>
  );
}
```

---

## Week 3: Admin Dashboard & Analytics

### Phase 3.1: Admin Dashboard (Days 11-15)

#### New Page: Admin Dashboard
**File:** `frontend/src/pages/admin/dashboard.tsx`

```typescript
export function DashboardPage() {
  const today = startOfDay(new Date());

  const stats = trpc.admin.getDashboardStats.useQuery({
    startDate: today.toISOString(),
    endDate: endOfDay(today).toISOString(),
  });

  return (
    <PageLayout title="Dashboard">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <StatCard
          title="Today's Orders"
          value={stats.data?.ordersCount ?? 0}
          icon={<ShoppingCart />}
          trend="+12% vs yesterday"
        />
        <StatCard
          title="Revenue"
          value={formatCurrency(stats.data?.revenue ?? 0)}
          icon={<DollarSign />}
          trend="+8% vs yesterday"
        />
        <StatCard
          title="Pending Weighing"
          value={stats.data?.pendingWeighing ?? 0}
          icon={<Scale />}
          trend="2 urgent"
        />
        <StatCard
          title="Avg Order Value"
          value={formatCurrency(stats.data?.avgOrderValue ?? 0)}
          icon={<TrendingUp />}
          trend="+5% vs last week"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Card>
          <CardHeader>
            <CardTitle>Orders Over Time</CardTitle>
          </CardHeader>
          <CardContent>
            <OrdersChart data={stats.data?.ordersOverTime} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top Products</CardTitle>
          </CardHeader>
          <CardContent>
            <TopProductsList products={stats.data?.topProducts} />
          </CardContent>
        </Card>
      </div>

      {/* Recent Orders */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Orders</CardTitle>
        </CardHeader>
        <CardContent>
          <RecentOrdersTable orders={stats.data?.recentOrders} />
        </CardContent>
      </Card>
    </PageLayout>
  );
}
```

#### Backend Endpoint
**File:** `backend/src/routers/admin.router.ts`

```typescript
export const adminRouter = router({
  getDashboardStats: protectedProcedure
    .input(z.object({
      startDate: z.string(),
      endDate: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      const { startDate, endDate } = input;

      // Parallel queries for performance
      const [
        ordersCount,
        revenue,
        pendingWeighing,
        ordersOverTime,
        topProducts,
        recentOrders,
      ] = await Promise.all([
        ctx.prisma.order.count({
          where: {
            createdAt: { gte: startDate, lte: endDate },
          },
        }),
        ctx.prisma.order.aggregate({
          where: {
            createdAt: { gte: startDate, lte: endDate },
            status: "FINALIZED",
          },
          _sum: { /* calculate total */ },
        }),
        ctx.prisma.orderItem.count({
          where: {
            productOption: { unitType: "WEIGHT" },
            actualWeight: null,
          },
        }),
        // ... other queries
      ]);

      return {
        ordersCount,
        revenue: revenue._sum,
        pendingWeighing,
        avgOrderValue: revenue._sum / ordersCount,
        ordersOverTime,
        topProducts,
        recentOrders,
      };
    }),
});
```

---

## Week 4: Search Enhancement & Final Polish

### Phase 4.1: Search Autocomplete (Days 16-17)

#### Autocomplete Component
**File:** `frontend/src/components/search-autocomplete.tsx`

```typescript
import { Command, CommandInput, CommandList, CommandItem } from "@/components/ui/command";

export function SearchAutocomplete() {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);

  const suggestions = trpc.products.searchSuggestions.useQuery(
    { query: search },
    { enabled: search.length >= 2 }
  );

  return (
    <Command>
      <CommandInput
        placeholder="Search products..."
        value={search}
        onValueChange={setSearch}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 200)}
      />
      {open && suggestions.data && (
        <CommandList className="absolute top-full mt-1 w-full bg-white shadow-lg rounded-lg border z-50">
          {suggestions.data.map((product) => (
            <CommandItem
              key={product.id}
              onSelect={() => {
                // Navigate to product or add to cart
              }}
            >
              <span className="font-medium">{product.name}</span>
              <span className="text-sm text-gray-500 ml-2">
                {formatCurrency(product.basePrice)}
              </span>
            </CommandItem>
          ))}
        </CommandList>
      )}
    </Command>
  );
}
```

### Phase 4.2: Order History & Reordering (Days 18-19)

**File:** `frontend/src/pages/chef/order-detail.tsx`

```typescript
export function OrderDetailPage() {
  const { orderId } = useParams();
  const navigate = useNavigate();

  const order = trpc.orders.get.useQuery({ id: orderId! });
  const reorderMutation = trpc.orders.reorder.useMutation();

  const handleReorder = async () => {
    reorderMutation.mutate({ orderId: orderId! });

    const newOrder = await createOrder.mutateAsync({ items });
    toast.success(`Order #${newOrder.orderNumber} created!`);
    navigate("/chef/cart");
  };

  return (
    <PageLayout title="Order Details">
      {/* Order info */}
      <Card>
        <CardHeader>
          <CardTitle>Order #{order.data?.orderNumber}</CardTitle>
          <CardDescription>
            Created {formatDate(order.data?.createdAt)}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Items list */}
          <OrderItemsList items={order.data?.items} />

          {/* Totals */}
          <OrderTotals order={order.data} />
        </CardContent>
        <CardFooter>
          <Button onClick={handleReorder} className="w-full">
            <RefreshCw className="mr-2 h-4 w-4" />
            Reorder
          </Button>
        </CardFooter>
      </Card>
    </PageLayout>
  );
}
```

### Phase 4.3: Final Polish (Days 20-21)

#### Loading States Everywhere
- Skeleton screens for all loading states
- Button loading spinners
- Optimistic updates where appropriate

#### Error Boundaries
**File:** `frontend/src/components/error-boundary.tsx`

```typescript
export class ErrorBoundary extends React.Component {
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Error caught by boundary:", error, errorInfo);
    // Send to error tracking service
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <Card className="max-w-md">
            <CardHeader>
              <CardTitle>Something went wrong</CardTitle>
            </CardHeader>
            <CardContent>
              <p>We're sorry, but something unexpected happened.</p>
              <Button onClick={() => window.location.reload()}>
                Reload Page
              </Button>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}
```

#### Form Validation
- All forms use react-hook-form + zod
- Clear error messages
- Field-level validation
- Disabled submit until valid

#### Accessibility
- [ ] All buttons have aria-labels
- [ ] Forms have proper labels
- [ ] Keyboard navigation works
- [ ] Focus states visible
- [ ] Color contrast meets WCAG AA
- [ ] Screen reader tested

---

## Success Criteria

### Before Beta Launch
- [ ] All Critical/High bugs fixed
- [ ] Real-time updates working
- [ ] Offline sync reliable (0% data loss)
- [ ] Admin dashboard deployed
- [ ] Search is fast (< 300ms)
- [ ] Mobile experience is smooth
- [ ] No console errors
- [ ] TypeScript 100% typed
- [ ] Performance score > 85 (Lighthouse)
- [ ] Load time < 3s on 3G

### Quality Metrics
- [ ] Test coverage > 80%
- [ ] Zero TypeScript errors
- [ ] Zero ESLint warnings
- [ ] All Lighthouse categories > 90
- [ ] Documented all features
- [ ] User testing with 3+ people
- [ ] All feedback addressed

---

## Week 4+ Buffer: Supabase Setup

**Only after everything above is complete:**
1. Create Supabase project
2. Configure authentication
3. Create test users
4. Update environment variables
5. Test authentication flow
6. Prepare for deployment

---

## Daily Workflow

### Morning (9 AM - 12 PM)
- Review yesterday's progress
- Pick highest priority task
- Code + test
- Commit progress

### Afternoon (1 PM - 5 PM)
- Continue main task
- Fix any bugs found
- Update documentation
- Code review if needed

### End of Day
- Update todo list
- Document any blockers
- Plan tomorrow's tasks
- Commit all changes

---

## Communication Plan

### Weekly Progress Reports
**Every Friday:**
- Features completed this week
- Bugs fixed
- Current blockers
- Next week priorities
- Demo video (optional)

### Testing Sessions
**Every 3 days:**
- Manual testing of new features
- Document bugs found
- Prioritize fixes
- Update test checklist

---

This plan ensures a polished, production-ready application with excellent UX before any beta customers see it!
