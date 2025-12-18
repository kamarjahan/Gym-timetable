// lib/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBEixYfk4xMGG3AAzOSa7HLVVMck4MNTK8",
  authDomain: "workoutplan-2d216.firebaseapp.com",
  projectId: "workoutplan-2d216",
  storageBucket: "workoutplan-2d216.firebasestorage.app",
  messagingSenderId: "593565637350",
  appId: "1:593565637350:web:7835884da02198ab5a7927",
  measurementId: "G-DME8K80WWN"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);