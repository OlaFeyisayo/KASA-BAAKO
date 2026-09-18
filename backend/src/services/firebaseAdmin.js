import { initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { readFileSync } from "node:fs";

// Expected at backend/serviceAccountKey.json (gitignored — get this file
// privately from whoever manages the Firebase project, never via GitHub).
const serviceAccount = JSON.parse(readFileSync(new URL("../../serviceAccountKey.json", import.meta.url)));

const app = initializeApp({
  credential: cert(serviceAccount),
});

export const auth = getAuth(app);
