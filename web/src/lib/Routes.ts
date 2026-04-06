// web/src/Routes.ts
//current use only for tours

export type RouteFn<Args extends unknown[] = unknown[]> = (...args: Args) => string;

export const Routes = {
  root: (() => "/") as RouteFn,

  public: {
    login: (() => "/login") as RouteFn,
    accessPending: (() => "/access-pending") as RouteFn,
  },

  protected: {
    // (protected)/page.tsx – if you use it as a landing inside auth
    home: (() => "/") as RouteFn,

    // (protected)/reports/page.tsx
    reports: (() => "/reports") as RouteFn,
    // (protected)/reports/[toolKey]/page.tsx
    reportsTool: ((toolKey: string | ":toolKey") =>
      `/reports/${toolKey}`) as RouteFn<[string | ":toolKey"]>,

    // (protected)/customers/page.tsx
    customers: (() => "/customers") as RouteFn,
    // (protected)/customers/[customerId]/page.tsx
    customer: ((id: string | number | ":id") =>
      `/customers/${id}`) as RouteFn<[string | number | ":id"]>,

    // (protected)/grants/page.tsx
    grants: (() => "/grants") as RouteFn,
    // (protected)/grants/[grantId]/page.tsx
    grant: ((id: string | number | ":id") =>
      `/grants/${id}`) as RouteFn<[string | number | ":id"]>,

    // (protected)/casemanagers/page.tsx
    casemanagers: (() => "/casemanagers") as RouteFn,

    // (protected)/settings/page.tsx
    settings: (() => "/settings") as RouteFn,

    // (protected)/users/page.tsx
    users: (() => "/users") as RouteFn,

    // (protected)/dev layout & subpages
    dev: {
      root: (() => "/dev") as RouteFn,
      endpoints: (() => "/dev/functions") as RouteFn,
      functions: (() => "/dev/functions") as RouteFn,
      orgManager: (() => "/dev/org-manager") as RouteFn,
    },

    // (protected)/admin layout & subpages
    admin: {
      root: (() => "/admin") as RouteFn,
      acuity: (() => "/admin/acuity") as RouteFn,
      debug: (() => "/admin/debug") as RouteFn,
      users: (() => "/admin/users") as RouteFn,
      orgConfig: (() => "/admin/org-config") as RouteFn,
    },
  },
} as const;

export type AppRoutes = typeof Routes;
export type ProtectedRoutes = typeof Routes.protected;
export type PublicRoutes = typeof Routes.public;

export default Routes;
