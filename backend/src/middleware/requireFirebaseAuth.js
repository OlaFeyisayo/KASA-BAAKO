import { auth } from "../services/firebaseAdmin.js";

// Replaces the old shared-password requireDashboardAuth. Every
// dashboard-only route now expects a Firebase ID token (issued by the
// Firebase client SDK after email/password sign-in), sent the same way
// the old custom token was: `Authorization: Bearer <token>`.
export async function requireFirebaseAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or invalid Authorization header" });
  }

  const idToken = authHeader.slice(7);

  try {
    const decoded = await auth.verifyIdToken(idToken);
    req.user = decoded; // { uid, email, ... } — available to route handlers if needed
    next();
  } catch (err) {
    res.status(401).json({ error: "Invalid or expired session" });
  }
}