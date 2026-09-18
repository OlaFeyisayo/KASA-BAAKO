// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCb2KjSpG0u0dOF48w694SrfCd7E5nRUxA",
  authDomain: "kasa-baako.firebaseapp.com",
  projectId: "kasa-baako",
  storageBucket: "kasa-baako.firebasestorage.app",
  messagingSenderId: "835880525315",
  appId: "1:835880525315:web:612472586b32d8648ff836",
  measurementId: "G-54L1RTL64H"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);