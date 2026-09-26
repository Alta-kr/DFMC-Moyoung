// Local developer fixture only. Never reads production credentials or accepts a host/project argument.
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
const uid = process.argv[2];
if (!uid || !/^[a-zA-Z0-9_-]{1,128}$/.test(uid)) throw new Error('Pass an existing local Auth UID.');
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
const app = initializeApp({ projectId: 'demo-moyoung' });
const db = getFirestore(app);
try {
  const ref = db.doc('users/' + uid);
  if (!(await ref.get()).exists) throw new Error('Create a local profile first.');
  await getAuth(app).updateUser(uid, { emailVerified: true });
  await ref.update({ role: 'server_admin' });
  console.log('Local preview administrator ready. Sign out and sign in again.');
} finally { await db.terminate(); await deleteApp(app); }
