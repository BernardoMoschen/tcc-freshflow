# FreshFlow Testing Checklist ✅

**Date Started:** _______________
**Tester:** _______________
**Environment:** Local / Staging / Production

---

## 📱 Device Testing

- [ ] Desktop (Chrome, 1920x1080)
- [ ] Desktop (Firefox, 1920x1080)
- [ ] Desktop (Safari, if Mac)
- [ ] Tablet (iPad/Android, landscape)
- [ ] Tablet (iPad/Android, portrait)
- [ ] Mobile (iPhone 14, 390x844)
- [ ] Mobile (Android, 360x800)
- [ ] Mobile (small device, 375x667)

---

## 🔐 Authentication

| Test | Pass | Fail | Notes |
|------|------|------|-------|
| Login page loads | ☐ | ☐ | |
| Valid login works | ☐ | ☐ | |
| Invalid login shows error | ☐ | ☐ | |
| Logout clears session | ☐ | ☐ | |
| Protected routes redirect | ☐ | ☐ | |
| Session persists on refresh | ☐ | ☐ | |

---

## 🛒 Chef Flow - Product Catalog

| Test | Pass | Fail | Notes |
|------|------|------|-------|
| Products load and display | ☐ | ☐ | |
| Search filters in real-time | ☐ | ☐ | |
| Price filter (min) works | ☐ | ☐ | |
| Price filter (max) works | ☐ | ☐ | |
| Unit type filter works | ☐ | ☐ | |
| Sort by name (asc) works | ☐ | ☐ | |
| Sort by name (desc) works | ☐ | ☐ | |
| Sort by price (asc) works | ☐ | ☐ | |
| Sort by price (desc) works | ☐ | ☐ | |
| Mobile: Filter panel toggles | ☐ | ☐ | |
| Add to cart works | ☐ | ☐ | |
| Toast notification appears | ☐ | ☐ | |
| Cart count updates | ☐ | ☐ | |

---

## 🛍️ Chef Flow - Shopping Cart

| Test | Pass | Fail | Notes |
|------|------|------|-------|
| Cart displays all items | ☐ | ☐ | |
| Quantity increase works | ☐ | ☐ | |
| Quantity decrease works | ☐ | ☐ | |
| Remove item works | ☐ | ☐ | |
| Subtotal calculates correctly | ☐ | ☐ | |
| Empty cart shows empty state | ☐ | ☐ | |
| "Send Order" disabled when empty | ☐ | ☐ | |
| Order submission works | ☐ | ☐ | |
| Success toast appears | ☐ | ☐ | |
| Redirects to orders page | ☐ | ☐ | |
| Cart clears after submission | ☐ | ☐ | |

---

## 📋 Chef Flow - Orders List

| Test | Pass | Fail | Notes |
|------|------|------|-------|
| Orders display correctly | ☐ | ☐ | |
| Status badges show correct colors | ☐ | ☐ | |
| DRAFT badge (gray) | ☐ | ☐ | |
| SENT badge (blue) | ☐ | ☐ | |
| IN_SEPARATION badge (yellow) | ☐ | ☐ | |
| FINALIZED badge (green) | ☐ | ☐ | |
| Filter by status works | ☐ | ☐ | |
| PDF download shows for FINALIZED | ☐ | ☐ | |
| PDF download works | ☐ | ☐ | |
| PDF opens in new tab | ☐ | ☐ | |
| Empty state shows when no orders | ☐ | ☐ | |
| Date formatting is correct | ☐ | ☐ | |

---

## ⚖️ Admin Flow - Weighing Interface

| Test | Pass | Fail | Notes |
|------|------|------|-------|
| Order loads with all items | ☐ | ☐ | |
| Requested quantity displays | ☐ | ☐ | |
| Weight input accepts decimals | ☐ | ☐ | |
| Weight input validates (> 0) | ☐ | ☐ | |
| Price override input works | ☐ | ☐ | |
| Price override is optional | ☐ | ☐ | |
| "Persist price" checkbox works | ☐ | ☐ | |
| Notes textarea works | ☐ | ☐ | |
| Save button disabled when invalid | ☐ | ☐ | |
| Weighing saves successfully | ☐ | ☐ | |
| Success toast appears | ☐ | ☐ | |
| Already weighed items show badge | ☐ | ☐ | |
| Input fields clear after save | ☐ | ☐ | |
| Actual weight displays correctly | ☐ | ☐ | |
| Final price displays correctly | ☐ | ☐ | |

---

## 📶 Admin Flow - Offline Mode

| Test | Pass | Fail | Notes |
|------|------|------|-------|
| Offline indicator appears | ☐ | ☐ | |
| Weighing works while offline | ☐ | ☐ | |
| "Queued for sync" toast appears | ☐ | ☐ | |
| Pending counter shows | ☐ | ☐ | |
| Pending counter is accurate | ☐ | ☐ | |
| Multiple items can be queued | ☐ | ☐ | |
| Online indicator appears | ☐ | ☐ | |
| Auto-sync happens | ☐ | ☐ | |
| Success toast after sync | ☐ | ☐ | |
| Pending counter clears | ☐ | ☐ | |
| Synced data appears on server | ☐ | ☐ | |

---

## ✅ Admin Flow - Order Finalization

| Test | Pass | Fail | Notes |
|------|------|------|-------|
| Back button works | ☐ | ☐ | |
| Order number displays | ☐ | ☐ | |
| Customer name displays | ☐ | ☐ | |
| Order status displays | ☐ | ☐ | |
| Status badge correct | ☐ | ☐ | |
| Warning for unweighed items | ☐ | ☐ | |
| Warning disappears when all weighed | ☐ | ☐ | |
| Item list displays | ☐ | ☐ | |
| Unweighed items highlighted | ☐ | ☐ | |
| Fixed items total correct | ☐ | ☐ | |
| Weight items total correct | ☐ | ☐ | |
| Grand total correct | ☐ | ☐ | |
| Finalize button disabled if not weighed | ☐ | ☐ | |
| Finalize button enabled when ready | ☐ | ☐ | |
| Confirmation dialog appears | ☐ | ☐ | |
| Dialog cancel button works | ☐ | ☐ | |
| Dialog confirm button works | ☐ | ☐ | |
| Finalize succeeds | ☐ | ☐ | |
| Status updates to FINALIZED | ☐ | ☐ | |
| Success toast appears | ☐ | ☐ | |
| PDF download button appears | ☐ | ☐ | |
| PDF downloads correctly | ☐ | ☐ | |

---

## 📄 PDF Generation

| Test | Pass | Fail | Notes |
|------|------|------|-------|
| PDF contains header | ☐ | ☐ | |
| "Extrato de Conferência" title | ☐ | ☐ | |
| Order number correct | ☐ | ☐ | |
| Date correct | ☐ | ☐ | |
| Customer name correct | ☐ | ☐ | |
| All items listed | ☐ | ☐ | |
| Product names correct | ☐ | ☐ | |
| Requested quantities correct | ☐ | ☐ | |
| Actual weights correct | ☐ | ☐ | |
| Unit prices correct | ☐ | ☐ | |
| Line item totals correct | ☐ | ☐ | |
| Fixed items subtotal correct | ☐ | ☐ | |
| Weight items subtotal correct | ☐ | ☐ | |
| Grand total correct | ☐ | ☐ | |
| Currency formatting (R$) | ☐ | ☐ | |
| Signature area present | ☐ | ☐ | |
| PDF is readable | ☐ | ☐ | |
| PDF is printable | ☐ | ☐ | |

---

## 📱 Mobile Responsiveness

| Test | Pass | Fail | Notes |
|------|------|------|-------|
| All pages work at 375px | ☐ | ☐ | |
| No horizontal scrolling | ☐ | ☐ | |
| Touch targets ≥ 44px | ☐ | ☐ | |
| Forms don't zoom on iOS | ☐ | ☐ | |
| Sticky headers work | ☐ | ☐ | |
| Dialogs are mobile-friendly | ☐ | ☐ | |
| Text readable without zoom | ☐ | ☐ | |
| Images scale properly | ☐ | ☐ | |
| Navigation menu works | ☐ | ☐ | |
| Bottom navigation (if present) | ☐ | ☐ | |

---

## ⚡ Performance

| Test | Pass | Fail | Notes |
|------|------|------|-------|
| Initial page load < 3s | ☐ | ☐ | |
| Navigation is instant | ☐ | ☐ | |
| API calls < 2s | ☐ | ☐ | |
| No console errors | ☐ | ☐ | |
| No console warnings | ☐ | ☐ | |
| No TypeScript errors | ☐ | ☐ | |
| Images optimized | ☐ | ☐ | |
| Smooth scrolling | ☐ | ☐ | |
| No janky animations | ☐ | ☐ | |

---

## 🔍 Edge Cases

| Test | Pass | Fail | Notes |
|------|------|------|-------|
| Long product name (50+ chars) | ☐ | ☐ | |
| Large order (20+ items) | ☐ | ☐ | |
| Decimal quantities (0.5, 1.25) | ☐ | ☐ | |
| Zero quantity handled | ☐ | ☐ | |
| Very large weight (999.99 kg) | ☐ | ☐ | |
| Very small weight (0.01 kg) | ☐ | ☐ | |
| High price (R$ 9999.99) | ☐ | ☐ | |
| Network error shows message | ☐ | ☐ | |
| Concurrent weighing | ☐ | ☐ | |
| PDF for large order | ☐ | ☐ | |
| Multiple users same order | ☐ | ☐ | |
| Browser back button | ☐ | ☐ | |
| Browser refresh | ☐ | ☐ | |

---

## 🐛 Bugs Found

### Bug #1
- **Severity:** _______________
- **Page:** _______________
- **Description:**



- **Steps to Reproduce:**
  1.
  2.
  3.


### Bug #2
- **Severity:** _______________
- **Page:** _______________
- **Description:**



- **Steps to Reproduce:**
  1.
  2.
  3.


---

## ✅ Final Checklist

- [ ] All Critical bugs fixed
- [ ] All High bugs fixed
- [ ] Medium/Low bugs documented
- [ ] Re-tested after fixes
- [ ] Performance acceptable
- [ ] Mobile experience good
- [ ] Ready for next phase

---

## Notes & Observations

[Add any general notes, patterns, or observations here]
