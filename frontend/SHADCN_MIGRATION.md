# shadcn/ui Migration Guide

## ✅ Migrated Components

### Finalize Page
- ✅ Custom dialog → shadcn Dialog
- ✅ Custom buttons → shadcn Button
- ✅ Custom badge → shadcn Badge
- ✅ Uses lucide-react icons

## Component Usage Examples

### 1. Button Component

**Before (Custom):**
```tsx
<button
  onClick={handleClick}
  disabled={loading}
  className="w-full bg-primary text-white px-6 py-5 rounded-xl hover:bg-primary/90 disabled:opacity-50"
>
  Click me
</button>
```

**After (shadcn):**
```tsx
import { Button } from "@/components/ui/button"

<Button
  onClick={handleClick}
  disabled={loading}
  className="w-full px-6 py-7"
  size="lg"
>
  Click me
</Button>
```

**Button Variants:**
- `default` - Primary button (green)
- `destructive` - Red danger button
- `outline` - Outlined button
- `secondary` - Secondary gray button
- `ghost` - Transparent button
- `link` - Link-styled button

**Button Sizes:**
- `default` - Standard size
- `sm` - Small
- `lg` - Large
- `icon` - Square icon button

### 2. Dialog Component

**Before (Custom):**
```tsx
{showDialog && (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
      <h3 className="text-xl font-bold">Title</h3>
      <p className="text-gray-600 mb-6">Description</p>
      <div className="flex gap-3">
        <button onClick={() => setShowDialog(false)}>Cancel</button>
        <button onClick={handleConfirm}>Confirm</button>
      </div>
    </div>
  </div>
)}
```

**After (shadcn):**
```tsx
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

<Dialog open={showDialog} onOpenChange={setShowDialog}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Title</DialogTitle>
      <DialogDescription>Description</DialogDescription>
    </DialogHeader>
    <DialogFooter>
      <Button variant="outline" onClick={() => setShowDialog(false)}>
        Cancel
      </Button>
      <Button onClick={handleConfirm}>Confirm</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

### 3. Badge Component

**Before (Custom):**
```tsx
<span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium">
  Status
</span>
```

**After (shadcn):**
```tsx
import { Badge } from "@/components/ui/badge"

<Badge className="bg-green-100 text-green-800 hover:bg-green-100">
  Status
</Badge>
```

**Badge Variants:**
- `default` - Standard badge
- `secondary` - Gray badge
- `destructive` - Red badge
- `outline` - Outlined badge

### 4. Toast Notifications

**Option A: Keep Custom Toast (Current)**
```tsx
import { useToast } from "@/components/toast"

const { showToast } = useToast()
showToast("Order created successfully!", "success")
showToast("Failed to create order", "error")
```

**Option B: Use Sonner (shadcn, now available)**
```tsx
import { toast } from "sonner"

toast.success("Order created successfully!")
toast.error("Failed to create order")
toast.warning("Please complete weighing first")
toast.info("Weight queued for sync")
toast.loading("Creating order...")
toast.promise(createOrder(), {
  loading: "Creating order...",
  success: "Order created!",
  error: "Failed to create order"
})
```

### 5. Icons with lucide-react

**Before (Inline SVG):**
```tsx
<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
</svg>
```

**After (lucide-react):**
```tsx
import { ArrowLeft, Download, AlertTriangle, Check } from "lucide-react"

<ArrowLeft className="h-6 w-6" />
<Download className="h-6 w-6" />
<AlertTriangle className="h-6 w-6" />
<Check className="h-6 w-6" />
```

**Common Icons:**
- `ArrowLeft`, `ArrowRight` - Navigation
- `Download`, `Upload` - File actions
- `AlertTriangle`, `AlertCircle` - Warnings/alerts
- `Check`, `X` - Status indicators
- `ShoppingCart`, `Package` - E-commerce
- `User`, `Users` - User management
- `Search`, `Filter` - Search/filter
- `Plus`, `Minus` - Add/remove actions

### 6. Skeleton Loading

**Our custom skeleton is already good! But here's the shadcn version:**

**shadcn Skeleton:**
```tsx
import { Skeleton } from "@/components/ui/skeleton"

<Skeleton className="h-6 w-3/4" />
<Skeleton className="h-4 w-1/2" />
<Skeleton className="h-10 w-full" />
```

### 7. Card Component

**New! shadcn Card for better structure:**
```tsx
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"

<Card>
  <CardHeader>
    <CardTitle>Order #12345</CardTitle>
    <CardDescription>Created on Jan 27, 2026</CardDescription>
  </CardHeader>
  <CardContent>
    <p>Order details here...</p>
  </CardContent>
  <CardFooter className="flex justify-between">
    <Button variant="outline">Cancel</Button>
    <Button>Confirm</Button>
  </CardFooter>
</Card>
```

### 8. Input & Label

**shadcn Input with Label:**
```tsx
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

<div className="space-y-2">
  <Label htmlFor="weight">Actual Weight (kg)</Label>
  <Input
    id="weight"
    type="number"
    value={weight}
    onChange={(e) => setWeight(e.target.value)}
    placeholder="0.00"
  />
</div>
```

## Migration Checklist

### High Priority (Already Done)
- [x] finalize.tsx - Dialog, Button, Badge migrated
- [x] App.tsx - Sonner added (both toast systems available)

### Recommended Next Steps
1. **Migrate weighing.tsx** - Use Button, Badge components
2. **Migrate cart.tsx** - Use Button component, consider Sonner
3. **Migrate catalog.tsx** - Use Button, Card components
4. **Migrate orders.tsx** - Use Badge, Button, Card components
5. **Migrate login.tsx** - Use Button, Input, Label components

### Optional
- Replace custom skeleton with shadcn Skeleton (our custom one is good though!)
- Gradually replace inline SVGs with lucide-react icons
- Migrate from custom toast to Sonner everywhere

## Benefits of Migration

1. **Consistency** - Unified design system across the app
2. **Accessibility** - Radix UI primitives are fully accessible (ARIA, keyboard nav)
3. **Maintainability** - Less custom code to maintain
4. **Features** - Built-in animations, focus management, etc.
5. **Documentation** - Well-documented components at ui.shadcn.com
6. **Customization** - Easy to customize with Tailwind classes

## Notes

- Both toast systems work simultaneously - choose what works best for each use case
- Our custom components were well-built! Migration is about standardization, not fixing problems
- shadcn components use our existing Tailwind config (green primary color preserved)
- All components are copied to our codebase - we own the code and can customize freely
