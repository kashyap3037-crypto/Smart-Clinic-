import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
    getFirestore, collection, doc, onSnapshot, 
    updateDoc, setDoc, getDoc, addDoc, getDocs,
    query, where, orderBy, serverTimestamp, deleteDoc, limit
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCPe8su-8fdvaB4rxvFa-Ts7rIjeFdYTJc",
  authDomain: "smart-clinic-queue-ed453.firebaseapp.com",
  projectId: "smart-clinic-queue-ed453",
  storageBucket: "smart-clinic-queue-ed453.firebasestorage.app",
  messagingSenderId: "934566411703",
  appId: "1:934566411703:web:7cca7341f582df36a2bc32",
  measurementId: "G-Y4D8VES0BJ"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { 
    db, collection, doc, onSnapshot, 
    updateDoc, setDoc, getDoc, addDoc, getDocs,
    query, where, orderBy, serverTimestamp, deleteDoc, limit
};
