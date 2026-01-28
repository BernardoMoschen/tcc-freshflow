# Development Mode Guide

This guide explains how to test FreshFlow locally without setting up Supabase authentication.

---

## Quick Start

### 1. Start the servers

```bash
# Terminal 1: Start backend
cd backend
npm run dev

# Terminal 2: Start frontend
cd frontend
npm run dev
```

### 2. Open the application

Navigate to [http://localhost:5173](http://localhost:5173)

### 3. Configure dev mode (in browser console)

The app will show a message that dev mode is not configured. Open the browser console (F12) and run:

```javascript
// Option 1: Login as chef (recommended for testing chef flow)
window.devSetup.setup('chef')

// Option 2: Login as tenant owner
window.devSetup.setup('owner')

// Option 3: Login as platform admin
window.devSetup.setup('admin')
```

### 4. Reload the page

After running the setup command, reload the page. You'll now be "logged in" as that user.

---

## Available Dev Users

| User | Email | Role | Access |
|------|-------|------|--------|
| **chef** | chef@chefstable.com | ACCOUNT_OWNER | Chef's Table account, FreshCo tenant |
| **owner** | owner@freshco.com | TENANT_OWNER | FreshCo tenant (all accounts) |
| **admin** | admin@freshflow.com | PLATFORM_ADMIN | Everything |

---

## Dev Mode Console Commands

Once the app is loaded, these commands are available in the browser console:

### Setup dev mode

```javascript
// Configure as chef user
window.devSetup.setup('chef')

// Configure as owner user
window.devSetup.setup('owner')

// Configure as admin user
window.devSetup.setup('admin')
```

### Check dev mode status

```javascript
window.devSetup.status()
// Returns:
// {
//   enabled: true,
//   email: "chef@chefstable.com",
//   tenantId: "f13052ec-6c8f-4433-aad9-b4da43bf6f55",
//   accountId: null
// }
```

### View available users

```javascript
window.devSetup.users
// Shows all available dev users with their details
```

### Clear dev mode (logout)

```javascript
window.devSetup.clear()
```

---

## How It Works

### Backend

The backend checks for the `x-dev-user-email` header in development mode:

```typescript
// backend/src/trpc.ts
if (process.env.NODE_ENV === "development" && devUserEmail) {
  const user = await prisma.user.findUnique({
    where: { email: devUserEmail },
  });
  if (user) {
    userId = user.id;
  }
}
```

### Frontend

The frontend sends the dev user email in headers:

```typescript
// frontend/src/lib/trpc.ts
if (import.meta.env.DEV) {
  const devUserEmail = localStorage.getItem("freshflow:dev-user-email");
  if (devUserEmail) {
    headers["x-dev-user-email"] = devUserEmail;
  }
}
```

### Security

- **Development only**: Dev mode only works when `NODE_ENV=development` (backend) and `import.meta.env.DEV` (frontend)
- **No production impact**: In production, the Supabase authentication flow is used
- **Explicit opt-in**: Users must explicitly run `window.devSetup.setup()` to enable dev mode

---

## Testing Workflows

### Test Chef Flow (Browse → Order → Track)

```javascript
// 1. Setup as chef
window.devSetup.setup('chef')
// 2. Reload page
// 3. Navigate to /chef/catalog
// 4. Add products to cart
// 5. Go to /chef/cart
// 6. Submit order
// 7. Go to /chef/orders to see order history
```

### Test Admin Flow (Weighing → Finalize → PDF)

```javascript
// 1. Setup as tenant owner (has admin access)
window.devSetup.setup('owner')
// 2. Reload page
// 3. Create an order first (as chef) or use existing order
// 4. Navigate to /admin/weighing/:orderId
// 5. Weigh items
// 6. Navigate to /admin/finalize/:orderId
// 7. Finalize order
// 8. Download PDF
```

### Test Offline Mode

```javascript
// 1. Setup as owner
window.devSetup.setup('owner')
// 2. Navigate to weighing page
// 3. Open DevTools → Network tab
// 4. Enable "Offline" mode
// 5. Weigh an item (should queue)
// 6. Disable "Offline" mode
// 7. Should auto-sync
```

---

## Troubleshooting

### "Dev mode not configured" in console

**Solution:** Run `window.devSetup.setup('chef')` in the browser console, then reload the page.

### API returns "Authentication required" error

**Check:**
1. Is `NODE_ENV=development` set in backend/.env?
2. Did you reload the page after running `window.devSetup.setup()`?
3. Check console for `🔧 [DEV MODE] Using dev user: ...` message

### "Access denied to tenant" error

**This was a bug, now fixed!** The RBAC system now properly allows account-level users to access tenant resources.

If you still see this error:
1. Verify the tenant ID is set: `localStorage.getItem("freshflow:tenantId")`
2. Check backend logs for RBAC errors
3. Verify the user has proper membership in the database

### Products not loading

**Check:**
1. Backend server is running (http://localhost:3001/health should return OK)
2. Frontend is proxying to backend (vite.config.ts has proxy config)
3. Database has seed data (run `npm run prisma:seed` in backend/)
4. Console shows dev mode active
5. Network tab shows requests going to `/trpc/products.list`

### Page shows blank/white screen

**Check:**
1. Browser console for errors
2. Is frontend dev server running?
3. Try clearing localStorage: `localStorage.clear()` and reload
4. Check if React is mounting: Look for `<div id="root">` in browser DevTools

---

## Switching Between Users

To test different user roles, simply clear and setup with a different user:

```javascript
// Logout current user
window.devSetup.clear()

// Login as different user
window.devSetup.setup('admin')

// Reload page
location.reload()
```

---

## Database Test Data

The seed script creates the following test data:

### Products (5 total)
1. **Tomatoes** - 1kg box (FIXED) - R$ 8.50
2. **Lettuce** - Unit (FIXED) - R$ 3.50
3. **Fresh Fish** - Per kg (WEIGHT) - R$ 45.00
4. **Beef** - Per kg (WEIGHT) - R$ 60.00
5. **Potatoes** - 5kg bag (FIXED) - R$ 12.00

### Customer Prices (3 overrides)
Some products have special prices for Chef's Table restaurant.

### Sample Order
One existing order in SENT status with 3 items for testing the admin weighing flow.

---

## Production Mode

In production (or when you want to test real Supabase auth):

1. Set up a Supabase project
2. Update `.env` with real credentials:
   ```
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_ANON_KEY=your-anon-key
   SUPABASE_JWT_SECRET=your-jwt-secret
   ```
3. Create users in Supabase with the seeded emails
4. The frontend will automatically use Supabase authentication

---

## Notes

- Dev mode is **only active in development** (NODE_ENV=development)
- In production, Supabase authentication is always used
- Dev mode configuration is stored in browser localStorage
- Each browser/profile has its own dev mode config
- Incognito/private windows have separate dev mode config

---

## Need Help?

If you encounter issues:

1. Check TESTING_STATUS.md for known bugs
2. Check backend logs: `tail -f /tmp/backend.log`
3. Check frontend console for errors
4. Verify environment variables in `.env`
5. Try restarting both servers

**Happy testing! 🧪**
