// =============================================================================
// FIREBASE-CONFIG.JS
// Firebase app initialization.  Must load before app.js.
// =============================================================================

// --- FIREBASE INITIALIZATION ---
const firebaseConfig = {
    apiKey: "AIzaSyBHWbaqMHNIIdSzFCDkthNZc3NZHMPkVgo",
    authDomain: "motivation-game-26ee1.firebaseapp.com",
    databaseURL: "https://motivation-game-26ee1-default-rtdb.firebaseio.com",
    projectId: "motivation-game-26ee1",
    storageBucket: "motivation-game-26ee1.firebasestorage.app",
    messagingSenderId: "404620697586",
    appId: "1:404620697586:web:8c9e3008294166d910d56b"
};


// Initialize the global 'firebase' object for Realtime Database
firebase.initializeApp(firebaseConfig);
const db = firebase.database();
