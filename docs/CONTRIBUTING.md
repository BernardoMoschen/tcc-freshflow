# Contributing to FreshFlow

Thank you for your interest in contributing to FreshFlow! This guide will help you get started with development and ensure consistent code quality.

## Development Setup

### Prerequisites

- Node.js 20+ and npm 10+
- Docker and Docker Compose
- Supabase project (for auth)
- Git

### Initial Setup

1. Fork and clone the repository
2. Install dependencies: `npm ci`
3. Copy `.env.local.example` to `.env` and configure
4. Start Postgres: `docker-compose up -d postgres`
5. Run migrations: `npm run db:migrate`
6. Seed database: `npm run db:seed`
7. Start dev servers: `npm run dev`

## Code Style

### TypeScript

- **Strict mode**: All code must pass TypeScript strict checks
- **No `any`**: Avoid `any` types; use `unknown` or proper types
- **Explicit return types**: Always specify function return types
- **Naming conventions**:
  - PascalCase for types, interfaces, components
  - camelCase for variables, functions
  - UPPER_SNAKE_CASE for constants

### File Organization

- **Colocation**: Keep related files together
- **Index exports**: Use index files to re-export public APIs
- **Naming**: Use descriptive names (e.g., `use-auth.ts` not `auth.ts` for hooks)

### Imports

Order imports as:
1. React/framework imports
2. Third-party libraries
3. Internal absolute imports (`@/...`)
4. Relative imports (`./...`)

Example:
```typescript
import { useState } from "react";
import { trpc } from "@trpc/react-query";
import { Button } from "@/components/ui/button";
import { formatPrice } from "./utils";
```

## Git Workflow

### Branch Naming

- `feature/description` - New features
- `fix/description` - Bug fixes
- `refactor/description` - Code refactoring
- `docs/description` - Documentation updates
- `test/description` - Test additions/fixes

Examples:
- `feature/add-product-images`
- `fix/pdf-generation-crash`
- `refactor/order-state-machine`

### Commit Messages

Follow conventional commits format:

```
type(scope): description

[optional body]

[optional footer]
```

Types:
- `feat` - New feature
- `fix` - Bug fix
- `refactor` - Code refactoring
- `docs` - Documentation
- `test` - Tests
- `chore` - Maintenance (dependencies, build, etc.)

Examples:
```
feat(orders): add ability to add extra items to orders

Admins can now add extra items to orders before finalization.
This is useful for correcting order issues or adding forgotten items.

Closes #123
```

```
fix(pdf): correct total calculation for mixed orders

Orders with both FIXED and WEIGHT items were showing incorrect
totals. Fixed by separating subtotal calculations.
```

### Pull Request Process

1. **Create feature branch** from `main`
2. **Implement changes** with tests
3. **Run checks**: `npm run typecheck && npm run lint && npm test`
4. **Commit changes** with descriptive messages
5. **Push branch** and create PR
6. **Address review feedback**
7. **Squash and merge** when approved

### PR Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] E2E tests added/updated
- [ ] Manual testing completed

## Checklist
- [ ] Code follows style guidelines
- [ ] TypeScript strict checks pass
- [ ] All tests pass
- [ ] Documentation updated
```

## Testing

### Unit Tests

Located in `backend/src/**/*.test.ts`

Test business logic in isolation:
- Price engine calculations
- Order state transitions
- RBAC permission checks

Example:
```typescript
import { resolvePrice } from './price-engine';

describe('Price Engine', () => {
  it('should prioritize manual price over customer price', async () => {
    const price = await resolvePrice(
      'option-id',
      'customer-id',
      5000 // manual price
    );
    expect(price).toBe(5000);
  });
});
```

Run: `npm run test:unit`

### Integration Tests

Located in `tests/integration/**/*.test.ts`

Test tRPC procedures with test database:
- Auth middleware
- RBAC enforcement
- Full procedure flows

Example:
```typescript
import { appRouter } from '../backend/src/router';

describe('Orders Router', () => {
  it('should require auth for orders.submitDraft', async () => {
    const caller = appRouter.createCaller({ userId: null });

    await expect(
      caller.orders.submitDraft({ orderId: 'test-id' })
    ).rejects.toThrow('UNAUTHORIZED');
  });
});
```

Run: `npm run test:integration`

### E2E Tests

Located in `tests/e2e/**/*.spec.ts`

Test full user flows with Playwright:
- Order creation flow
- Weighing flow
- PDF generation

Example:
```typescript
test('chef can create order', async ({ page }) => {
  await page.goto('/login');
  await page.fill('input[type="email"]', 'chef@test.com');
  await page.fill('input[type="password"]', 'password');
  await page.click('button[type="submit"]');

  await page.waitForURL('/chef/catalog');
  // ... rest of test
});
```

Run: `npm run test:e2e`

## Database Migrations

### Creating Migrations

1. Update `backend/prisma/schema.prisma`
2. Create migration: `cd backend && npx prisma migrate dev --name description`
3. Review generated SQL in `prisma/migrations/`
4. Test migration on fresh database
5. Commit both schema and migration files

### Migration Guidelines

- **Backward compatible**: Don't break existing data
- **Incremental**: Small, focused changes
- **Tested**: Verify on test database first
- **Documented**: Add comments for complex migrations

### Dangerous Operations

Avoid:
- Dropping columns with data
- Changing column types without migration
- Renaming without data migration

Instead:
1. Add new column
2. Migrate data
3. Remove old column (in separate migration)

## API Design

### tRPC Procedures

Follow RESTful naming:
- `list` - Get collection
- `get` - Get single item
- `create` - Create new item
- `update` - Update existing item
- `delete` - Delete item

Input validation:
- Use Zod schemas for all inputs
- Validate required fields
- Validate data types and formats
- Provide clear error messages

Example:
```typescript
create: protectedProcedure
  .input(
    z.object({
      name: z.string().min(1).max(255),
      price: z.number().positive(),
    })
  )
  .mutation(async ({ input, ctx }) => {
    // Implementation
  })
```

### Error Handling

Use tRPC error codes:
- `BAD_REQUEST` - Invalid input
- `UNAUTHORIZED` - Not authenticated
- `FORBIDDEN` - Not authorized
- `NOT_FOUND` - Resource not found
- `INTERNAL_SERVER_ERROR` - Unexpected error

Example:
```typescript
if (!order) {
  throw new TRPCError({
    code: 'NOT_FOUND',
    message: 'Order not found',
  });
}
```

## Frontend Components

### Component Structure

```typescript
// Good
export function ProductCard({ product }: ProductCardProps) {
  return (
    <div className="...">
      {/* ... */}
    </div>
  );
}

// Bad - no typed props
export function ProductCard(props) {
  return <div>{props.product.name}</div>;
}
```

### Hooks

- **Naming**: `use` prefix (e.g., `useCart`, `useAuth`)
- **Dependencies**: List all dependencies in `useEffect`
- **Cleanup**: Return cleanup function if needed

### Styling

- **Tailwind first**: Use Tailwind classes
- **Custom CSS**: Only when Tailwind insufficient
- **Responsive**: Mobile-first design
- **Accessibility**: Semantic HTML, ARIA labels

## Performance

### Backend

- **Database queries**: Use indexes, avoid N+1 queries
- **Caching**: Cache expensive operations
- **Pagination**: Always paginate large datasets

### Frontend

- **Code splitting**: Use dynamic imports
- **Memoization**: Use `useMemo` for expensive calculations
- **Virtualization**: Use for long lists

## Security

### Authentication

- **JWT validation**: Always verify tokens server-side
- **Token expiry**: Handle expired tokens gracefully
- **Secure storage**: Store tokens securely (httpOnly cookies or secure storage)

### Authorization

- **RBAC checks**: Always check permissions server-side
- **Context validation**: Verify tenant/account context
- **Input validation**: Sanitize and validate all inputs

### Sensitive Data

- **No secrets in code**: Use environment variables
- **No passwords in logs**: Redact sensitive data
- **Audit logs**: Log sensitive operations

## Documentation

### Code Comments

- **Why, not what**: Explain reasoning, not obvious code
- **Complex logic**: Add comments for non-obvious algorithms
- **TODOs**: Use `// TODO:` with description and context

### API Documentation

- Update README.md when adding endpoints
- Document input/output types
- Provide examples

### Database Schema

- Add comments to Prisma schema for complex fields
- Document relationships and constraints

## Review Checklist

Before requesting review:

- [ ] Code follows style guidelines
- [ ] TypeScript passes strict checks
- [ ] All tests pass
- [ ] No console.log or debug code
- [ ] Error handling implemented
- [ ] Input validation added
- [ ] Documentation updated
- [ ] Commits are clean and descriptive

## Getting Help

- **Questions**: Open a discussion on GitHub
- **Bugs**: Create an issue with reproduction steps
- **Feature requests**: Open an issue with use case

## Code of Conduct

- Be respectful and constructive
- Welcome newcomers
- Focus on code, not individuals
- Assume good intent

Thank you for contributing to FreshFlow!
