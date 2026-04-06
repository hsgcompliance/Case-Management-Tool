// functions/src/core/env.ts
import { defineSecret, defineString } from "firebase-functions/params";

export const RUNTIME = {
  region: "us-central1",
  minInstances: 0,
  concurrency: 80,
} as const;

/**
 * NOTE: defineString/defineSecret return firebase-functions internal param types.
 * When we emit .d.ts, TS throws TS2742 unless these exports have a portable annotation.
 * These values are runtime-only (resolved by Cloud Functions), so `any` is intentional.
 */

// Non-secret params
export const ALLOWED_ORIGINS: any = defineString("ALLOWED_ORIGINS");
export const ENFORCE_APP_CHECK: any = defineString("APP_CHECK_ENFORCE");
export const WEB_BASE_URL: any = defineString("WEB_BASE_URL");
export const GMAIL_SENDER: any = defineString("GMAIL_SENDER");
export const MAIL_FROM_NAME: any = defineString("MAIL_FROM_NAME");
export const GOOGLE_API_SCOPES: any = defineString("GOOGLE_API_SCOPES");
export const GOOGLE_DRIVE_AUTH_MODE: any = defineString("GOOGLE_DRIVE_AUTH_MODE");

// Secrets
export const GMAIL_CLIENT_ID: any = defineSecret("GMAIL_CLIENT_ID");
export const GMAIL_CLIENT_SECRET: any = defineSecret("GMAIL_CLIENT_SECRET");
export const GMAIL_REFRESH_TOKEN: any = defineSecret("GMAIL_REFRESH_TOKEN");
export const DRIVE_SANDBOX_FOLDER_ID: any = defineSecret("DRIVE_SANDBOX_FOLDER_ID");
export const JOTFORM_API_KEY: any = defineSecret("JOTFORM_API_KEY");
export const JOTFORM_API_KEY_SECRET: any = defineSecret("JOTFORM_API_KEY_SECRET");
export const SHEETS_BRIDGE_SHARED_SECRET: any = defineSecret("SHEETS_BRIDGE_SHARED_SECRET");

// Alias OAUTH_* to GMAIL_* so existing code keeps working
export const OAUTH_CLIENT_ID: any = GMAIL_CLIENT_ID;
export const OAUTH_CLIENT_SECRET: any = GMAIL_CLIENT_SECRET;
export const OAUTH_REFRESH_TOKEN: any = GMAIL_REFRESH_TOKEN;
