import { initializeApp } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getStorage, connectStorageEmulator } from 'firebase/storage';

export const firebaseConfig = {
  apiKey: "AIzaSyCoxSaZLUgNHbnzM2hj4mvxkvUWs8SGo3E",
  authDomain: "moyoung-abd47.firebaseapp.com",
  projectId: "moyoung-abd47",
  storageBucket: "moyoung-abd47.firebasestorage.app",
  messagingSenderId: "359135153535",
  appId: "1:359135153535:web:0f5605aaf125e32ae91e4a",
  measurementId: "G-FMFCP9BMHD"
};

// Original screens against isolated local data; production configuration remains unchanged.
const localUi = import.meta.env.DEV && import.meta.env.MODE === 'ui-preview';
export const app = initializeApp(localUi ? {
  projectId: 'demo-moyoung-ui', apiKey: 'demo-key',
  authDomain: 'demo-moyoung-ui.firebaseapp.com', storageBucket: 'demo-moyoung-ui.appspot.com',
} : firebaseConfig);
export const db = getFirestore(app);
export const storage = getStorage(app);

if (localUi) {
  connectFirestoreEmulator(db, '127.0.0.1', 8082);
  connectStorageEmulator(storage, '127.0.0.1', 9198);
}
