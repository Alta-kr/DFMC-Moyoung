import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8082';
const app = initializeApp({ projectId: 'demo-moyoung-ui' }, 'prepare-ui-roles');
const db = getFirestore(app);
db.settings({ host: '127.0.0.1:8082', ssl: false });
try {
  await db.runTransaction(async tx => {
    const clubRef = db.doc('clubs/1');
    const adminRef = db.doc('users/previewadmin');
    const leaderRef = db.doc('users/previewfutsal');
    const [club, admin, leader] = await tx.getAll(clubRef, adminRef, leaderRef);
    if (!club.exists || club.data().name !== '풋살 모영') throw new Error('Open the original local UI first to initialize fixtures');
    for (const existing of [admin, leader]) {
      if (existing.exists && existing.data().previewFixture !== true) throw new Error('Account ID already exists');
    }
    const common = { cell_name: '둔산제일교회', cell_verified: 1, previewFixture: true, created_at: new Date().toISOString() };
    tx.set(adminRef, { ...common, id: 900001, username: 'previewadmin', name: '체험관리자', role: 'head_admin' });
    tx.set(leaderRef, { ...common, id: 900002, username: 'previewfutsal', name: '체험총무', role: 'member' });
    // Keep fixture permissions and display names consistent.
    tx.update(clubRef, { manager_ids: ['900002'], manager_names: '체험총무' });
  });
  const [admin, leader, club] = await db.getAll(db.doc('users/previewadmin'), db.doc('users/previewfutsal'), db.doc('clubs/1'));
  if (admin.data().role !== 'head_admin' || leader.data().role !== 'member'
    || JSON.stringify(club.data().manager_ids) !== JSON.stringify(['900002'])
    || club.data().manager_names !== leader.data().name) throw new Error('Verification failed');
  console.log('전체관리자: previewadmin / 체험관리자');
  console.log('풋살 총무: previewfutsal / 체험총무');
} finally { await db.terminate(); await deleteApp(app); }
