// contracts/src/http.ts
// Canonical HTTP envelope + paging contracts (shared FE/BE)
import type { TTsLike } from "./core";
export type Ok<T = unknown> = { ok: true } & T;

export type OkEmpty = Ok<Record<string, never>>;

export type Err = { ok: false; error: string };

export type ApiResp<T = unknown> = Ok<T> | Err;

export type PageCursorUpdatedAt = {
  cursorUpdatedAt: TTsLike;
  cursorId: string;
};

export type PaginatedResp<
  TItem,
  TFilter = unknown,
  TCursor = PageCursorUpdatedAt
> = Ok<{
  items: TItem[];
  next: TCursor | null;
  filter: TFilter;
  note?: string;
}>;
