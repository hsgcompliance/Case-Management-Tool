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
// Base URL of the separately-deployed Forms surface (forms-web hosting target).
// Used to build tokenized render URLs (e.g. https://housing-db-forms.web.app).
// NOTE: deliberately named FORMS_APP_BASE_URL — do not reuse FORMS_BASE_URL, which
// is an orphaned legacy var (= https://api.jotform.com) in .env.housing-db-v2.
export const FORMS_APP_BASE_URL: any = defineString("FORMS_APP_BASE_URL");
export const GMAIL_SENDER: any = defineString("GMAIL_SENDER");
export const MAIL_FROM_NAME: any = defineString("MAIL_FROM_NAME");
export const GOOGLE_API_SCOPES: any = defineString("GOOGLE_API_SCOPES");
export const GOOGLE_DRIVE_AUTH_MODE: any = defineString("GOOGLE_DRIVE_AUTH_MODE");
export const GDRIVE_CUSTOMER_INDEX_SHEET_ID: any = defineString("GDRIVE_CUSTOMER_INDEX_SHEET_ID");

// Secrets
export const GMAIL_CLIENT_ID: any = defineSecret("GMAIL_CLIENT_ID");
export const GMAIL_CLIENT_SECRET: any = defineSecret("GMAIL_CLIENT_SECRET");
export const GMAIL_REFRESH_TOKEN: any = defineSecret("GMAIL_REFRESH_TOKEN");
export const GOOGLE_OAUTH_CLIENT_ID: any = defineSecret("GOOGLE_OAUTH_CLIENT_ID");
export const GOOGLE_OAUTH_CLIENT_SECRET: any = defineSecret("GOOGLE_OAUTH_CLIENT_SECRET");
export const GOOGLE_OAUTH_REFRESH_TOKEN: any = defineSecret("GOOGLE_OAUTH_REFRESH_TOKEN");
export const DRIVE_SANDBOX_FOLDER_ID: any = defineSecret("DRIVE_SANDBOX_FOLDER_ID");
export const JOTFORM_API_KEY: any = defineSecret("JOTFORM_API_KEY");
export const JOTFORM_API_KEY_SECRET: any = defineSecret("JOTFORM_API_KEY_SECRET");
export const SHEETS_BRIDGE_SHARED_SECRET: any = defineSecret("SHEETS_BRIDGE_SHARED_SECRET");

// Legacy mailer OAuth aliases. New Google Drive/Calendar integrations should
// use GOOGLE_OAUTH_* so automated email credentials stay isolated.
export const OAUTH_CLIENT_ID: any = GMAIL_CLIENT_ID;
export const OAUTH_CLIENT_SECRET: any = GMAIL_CLIENT_SECRET;
export const OAUTH_REFRESH_TOKEN: any = GMAIL_REFRESH_TOKEN;

// Google per-user OAuth integration (Calendar + Drive server-side token storage)
// Set via: firebase functions:secrets:set GOOGLE_OAUTH_STATE_SECRET
export const GOOGLE_OAUTH_STATE_SECRET: any = defineSecret("GOOGLE_OAUTH_STATE_SECRET");
// Redirect URI registered in Google Cloud Console OAuth credentials
// Must match exactly; update after first deploy to reflect the actual Cloud Function URL.
export const GOOGLE_OAUTH_REDIRECT_URI: any = defineString("GOOGLE_OAUTH_REDIRECT_URI");
