# Role Capabilities Matrix

What each FieldTek role can access, based on the **route guards and navigation enforced in the
code** (`src/App.tsx` `RoleGuard allowedRoles`, `src/components/SubscriptionGuard.tsx`,
`src/components/FeatureGate.tsx`, and the sidebar filtering in `src/components/layout/Sidebar.tsx` /
`MainLayout.tsx`). This documents what the app **actually enforces** — it does not invent
capabilities.

Roles come from the `app_role` enum (`src/types/database.ts`):
**owner · admin · dispatcher · technician · client**.

- **owner** — the company account creator; same access as admin, plus account/billing ownership.
- **admin** — full company management.
- **dispatcher** — schedules and manages jobs/clients; no team/billing/settings management.
- **technician** — field worker; sees their own assigned work.
- **client** — the customer; uses the **separate customer Portal** (`/portal/*`), not the staff app.

> Two roles can fail to render a page even when their role is allowed:
> - **Subscription status** (`SubscriptionGuard`): if the tenant's subscription is inactive/past due,
>   guarded pages show a "Subscription Required" screen instead.
> - **Plan tier** (`FeatureGate`, marked **🔒tier** below): the feature must be in the tenant's plan,
>   or the page shows a "feature locked / upgrade" card. Tier is independent of role.

Legend: **✅** allowed (route + appears in that role's menu) · **🔗** route allows it but it is **not
in that role's menu** (reachable by direct URL) · **🔒tier** additionally gated by a plan feature ·
**—** not allowed (redirected to a fallback).

---

## Staff app (tenant routes)

| Area | Route | Owner | Admin | Dispatcher | Technician |
|---|---|:--:|:--:|:--:|:--:|
| Dashboard | `/dashboard` | ✅ | ✅ | ✅ | — *(redirected to My Jobs)* |
| Jobs | `/jobs` | ✅ | ✅ | ✅ | — *(redirected to My Jobs)* |
| Schedule | `/schedule` | ✅ | ✅ | ✅ | — *(redirected to My Jobs)* |
| Clients | `/clients` | ✅ | ✅ | ✅ | — |
| Service Requests | `/requests` | ✅ | ✅ | ✅ | — *(redirected to My Jobs)* |
| Request Service | `/request-service` | ✅ | ✅ | ✅ | ✅ |
| Invoices | `/invoices` | ✅ 🔒tier | ✅ 🔒tier | 🔗 🔒tier | — |
| Team | `/team` | ✅ | ✅ | — | — |
| Settings | `/settings` | ✅ | ✅ | — | — |
| Reports | `/reports` | ✅ 🔒tier | ✅ 🔒tier | — | — |
| Documents | `/documents` | ✅ | ✅ | ✅ | ✅ |
| Equipment | `/equipment` | ✅ 🔒tier | ✅ 🔒tier | ✅ 🔒tier | ✅ 🔒tier |
| Sentinel AI assistant | `/assistant` | ✅ 🔒tier | ✅ 🔒tier | ✅ 🔒tier | ✅ 🔒tier |
| My Jobs | `/my-jobs` | — | — | — | ✅ |
| My Calendar | `/my-calendar` | — | — | — | ✅ |
| Onboarding | `/onboarding` | ✅ | ✅ | ✅ | ✅ |
| Tutorials | `/tutorials` | ✅ | ✅ | ✅ | ✅ |
| Billing return pages | `/billing/*`, `/post-checkout` | ✅ | ✅ | ✅ | ✅ |

### Notes on the matrix
- **owner = admin** at the route level (both are the only roles allowed on Team, Settings,
  Reports). Owner additionally holds account/billing ownership. Internally `isAdmin = admin || owner`.
- **Technician** is intentionally scoped to **My Jobs** and **My Calendar** for day-to-day work, plus
  the shared areas (Documents, Equipment, Sentinel AI, Request Service, Tutorials). A technician who
  lands on a dispatcher route (e.g. `/dashboard`) is **redirected to `/my-jobs`** (silently on
  `/dashboard`, since that's the app's default landing route).
- **Invoices for dispatcher (🔗):** the `/invoices` route guard allows dispatcher, but the sidebar
  lists Invoices for **owner/admin only** — a dispatcher won't see it in the menu but isn't hard-blocked
  at the route. (Owner/admin are the intended Invoices users.)
- **Documents** has no role guard (subscription-gated only), so all four staff roles may open it.
- **🔒tier** areas (Invoices, Reports, Equipment, Sentinel AI) require the corresponding plan feature
  (`invoicing_full`, `advanced_analytics`, `equipment_tracking`, `ai_assistant`). Without it, the page
  shows an upgrade card regardless of role.
- A signed-in user whose **role can't be resolved** at all (e.g. membership not active) sees the
  **"Couldn't load your workspace"** recovery card (Try again / Sign out), not a blank page.

---

## Customer Portal (`client` role)

The **client** role is the customer-facing experience and runs on a **separate auth flow**
(`PortalAuthProvider`), **not** the staff `RoleGuard`. Portal routes are not part of the staff
role matrix above.

| Portal area | Route |
|---|---|
| Login / Sign up | `/portal/login`, `/portal/signup` |
| Portal dashboard | `/portal` |
| Their jobs | `/portal/jobs` |
| Their invoices | `/portal/invoices` |
| Their equipment | `/portal/equipment` |
| Request service | `/portal/request` |
| Profile | `/portal/profile` |
| Payment success | `/portal/payment-success` |

Clients are invited from the staff app's Clients page (Resend Portal Invitation). They only ever see
their **own** company-as-customer data through the portal — never the staff app.

---

## Platform admin (`/admin/*`) — not a tenant role

The `/admin/*` area (tenant management, system health, feature flags, analytics, etc.) is for
**FieldTek platform operators**, gated by a **platform-admin check** (`is_platform_admin` /
`platform_admins` table), **not** by any tenant `app_role`. It uses a separate `AdminLayout` and
login (`/admin/login`) and is outside the pilot company's experience. See
[RUNBOOK.md](RUNBOOK.md) for operations.

---

_Source of truth: `src/App.tsx` (route → `RoleGuard allowedRoles`, `SubscriptionGuard`,
`FeatureGate`), `src/components/layout/Sidebar.tsx` (menu visibility per role), `src/types/database.ts`
(`app_role`). If routes change, update this matrix._
