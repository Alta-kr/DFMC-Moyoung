import { connectFunctionsEmulator, getFunctions, httpsCallable } from 'firebase/functions';
import { emailAuth } from './emailAuth';

const functions = getFunctions(emailAuth.app, 'asia-northeast3');
connectFunctionsEmulator(functions, '127.0.0.1', 5001);

export interface MembershipChange { clubId: string; uid: string; status: 'active' | 'revoked'; isLeader: boolean }
const callable = httpsCallable<MembershipChange, { changed: boolean }>(functions, 'setClubMembership');
export async function changeMembership(input: MembershipChange) {
  return (await callable(input)).data;
}
