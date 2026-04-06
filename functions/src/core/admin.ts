// functions/src/core/admin.ts
import admin from "firebase-admin";

if (!admin.apps.length) {
  admin.initializeApp();
  admin.firestore().settings({ ignoreUndefinedProperties: true });
}

export const db = admin.firestore();
export const authAdmin = admin.auth();

// Useful Firestore exports
export const FieldValue = admin.firestore.FieldValue;
export const Timestamp = admin.firestore.Timestamp;
export const FieldPath = admin.firestore.FieldPath;

// branded DocId type for stronger ids in your code
export type DocId<T extends string = string> = T & { readonly __brand: "DocId" };

export default admin;
