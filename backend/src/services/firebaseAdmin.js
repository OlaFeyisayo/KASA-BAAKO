import admin from "firebase-admin";
import { readFileSync } from "node:fs";

// Expected at backend/serviceAccountKey.json (gitignored — get this file
// privately from whoever manages the Firebase project, never via GitHub).
const serviceAccount = JSON.parse(readFileSync(new URL("../../serviceAccountKey.json", import.meta.url)));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

export default admin;