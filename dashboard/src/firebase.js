// Firebase config for the dashboard's login. This apiKey is a public web
// config value (not a secret — it's restricted by Firebase's own security
// rules and authorized-domains list), unlike backend/serviceAccountKey.json
// which is a real credential and stays out of git entirely.
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyCb2KjSpG0u0dOF48w694SrfCd7E5nRUxA",
  authDomain: "kasa-baako.firebaseapp.com",
  projectId: "kasa-baako",
  storageBucket: "kasa-baako.firebasestorage.app",
  messagingSenderId: "835880525315",
  appId: "1:835880525315:web:612472586b32d8648ff836",
  measurementId: "G-54L1RTL64H",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
