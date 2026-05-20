# Contracts Workflow

`contracts/` is the shared source of truth for API payloads and common domain shapes. Keep backend, frontend clients, hooks, and UI payloads aligned with it.

## Contract Rules

- Runtime schemas live in `contracts/src/<feature>.ts`.
- Runtime schemas should use `export const <Name>Schema = z...`.
- Request schemas should use clear suffixes like `BodySchema`, `QuerySchema`, or `ParamsSchema`.
- Every runtime schema should have an inferred exported type like `export type T<Name> = z.infer<typeof <Name>Schema>`.
- Endpoint request/response types should be exported from the leaf as `T<Endpoint>Req` and `T<Endpoint>Resp`.
- Leaf contract files should not import from `endpointMap.ts`.

## Endpoint Map

`contracts/src/endpointMap.ts` is the canonical endpoint hook point.

Pattern:

```ts
import type { TLeafOpReq, TLeafOpResp } from "./leaf";

export type LeafOpReq = TLeafOpReq;
export type LeafOpResp = TLeafOpResp;

export interface EndpointMap {
  leafOp: { req: LeafOpReq; resp: LeafOpResp };
}
```

Rules:

- `endpointMap.ts` imports types only from leaf modules.
- The `EndpointMap` interface references canonical alias types.
- Endpoint name to `{ req, resp }` mapping lives here.

## Index Exports

`contracts/src/index.ts` should keep a stable import surface:

- Runtime exports are namespaced by feature where possible.
- Consumer-friendly types may be top-level type exports.
- Contracts code uses relative imports, never `@hdb/contracts`.

## Change Checklist

For an endpoint shape change:

1. Update runtime schemas and inferred types in `contracts/src/<feature>.ts`.
2. Add or update `T<Endpoint>Req` and `T<Endpoint>Resp`.
3. Wire canonical aliases and `EndpointMap` entries in `contracts/src/endpointMap.ts`.
4. Export needed runtime/type surfaces from `contracts/src/index.ts`.
5. Run `npm run contracts:update`.
6. Update backend HTTP/service code.
7. Update frontend client wrapper and hooks.
8. Run builds or focused tests.

## Alignment Audit Checklist

When auditing a feature, trace:

- route/page
- feature component
- hook
- client wrapper
- transport call
- contracts request/response shape
- backend HTTP handler
- backend service
- Firestore reads/writes
- Firestore rules or backend org/team checks

Record mismatches as:

- `P0` - runtime break or security risk
- `P1` - drift likely to break soon
- `P2` - cleanup or consistency issue

Use minimal patches. Do not bundle broad refactors with payload alignment unless required for correctness.
