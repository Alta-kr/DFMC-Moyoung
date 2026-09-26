import { initializeApp, getApp, getApps } from 'firebase/app';
import { getAuth, connectAuthEmulator, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  sendEmailVerification, sendPasswordResetEmail, updateProfile, onAuthStateChanged, signOut,
  type User } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator, doc, getDoc, runTransaction, serverTimestamp } from 'firebase/firestore';

// Deliberately isolated until legacy account ownership and role migration are implemented.
const name = 'moyoung-auth-preview';
const fresh = !getApps().some(app => app.name === name);
const app = fresh ? initializeApp({ projectId: 'demo-moyoung', apiKey: 'demo-key', authDomain: 'demo-moyoung.firebaseapp.com' }, name) : getApp(name);
export const emailAuth = getAuth(app);
export const profileDb = getFirestore(app);
if (fresh) {
  connectAuthEmulator(emailAuth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(profileDb, '127.0.0.1', 8080);
}

export interface MemberProfile { uid: string; name: string; role: 'member' | 'server_admin' | 'head_admin' | 'media_admin' | 'guest' }
export async function ensureProfile(user: User, suppliedName?: string): Promise<MemberProfile> {
  const ref = doc(profileDb, 'users', user.uid);
  return runTransaction(profileDb, async tx => {
    const existing = await tx.get(ref);
    if (existing.exists()) return existing.data() as MemberProfile;
    const name = (suppliedName || user.displayName || '').trim();
    if (!name || name.length > 80) throw new Error('프로필 이름을 입력해주세요.');
    const profile: MemberProfile = { uid: user.uid, name, role: 'member' };
    tx.set(ref, { ...profile, createdAt: serverTimestamp() });
    return profile;
  });
}
export async function readProfile(user: User): Promise<MemberProfile | null> {
  const snapshot = await getDoc(doc(profileDb, 'users', user.uid));
  return snapshot.exists() ? snapshot.data() as MemberProfile : null;
}
export async function registerEmail(email: string, password: string, name: string) {
  if (!name.trim() || name.trim().length > 80) throw new Error('이름은 1~80자로 입력해주세요.');
  const { user } = await createUserWithEmailAndPassword(emailAuth, email.trim(), password);
  // A failure leaves the Auth account available for profile recovery, not duplicate signup.
  await updateProfile(user, { displayName: name.trim() });
  await ensureProfile(user, name);
  return user;
}
export const loginEmail = (email: string, password: string) => signInWithEmailAndPassword(emailAuth, email.trim(), password);
export const resetPassword = (email: string) => sendPasswordResetEmail(emailAuth, email.trim());
export const verifyEmail = () => {
  if (!emailAuth.currentUser) throw new Error('로그인이 필요합니다.');
  return sendEmailVerification(emailAuth.currentUser);
};
export const logoutEmail = () => signOut(emailAuth);
export const observeEmailUser = (next: (user: User | null) => void) => onAuthStateChanged(emailAuth, next);
export function authError(error: unknown): string {
  const code = (error as { code?: string })?.code;
  const messages: Record<string, string> = {
    'auth/invalid-credential': '이메일 또는 비밀번호를 확인해주세요.',
    'auth/wrong-password': '이메일 또는 비밀번호를 확인해주세요.',
    'auth/user-not-found': '이메일 또는 비밀번호를 확인해주세요.',
    'auth/email-already-in-use': '이미 가입된 이메일입니다. 로그인하거나 비밀번호를 재설정해주세요.',
    'auth/invalid-email': '올바른 이메일을 입력해주세요.',
    'auth/weak-password': '비밀번호는 6자 이상 입력해주세요.',
    'auth/too-many-requests': '잠시 후 다시 시도해주세요.',
    'auth/network-request-failed': '연결을 확인한 뒤 다시 시도해주세요.',
    'permission-denied': '프로필 접근 권한을 확인할 수 없습니다.',
    'unavailable': '연결을 확인한 뒤 다시 시도해주세요.',
  };
  return (code && messages[code]) || (error instanceof Error && !code ? error.message : '처리하지 못했습니다. 다시 시도해주세요.');
}
