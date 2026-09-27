import { doc, runTransaction, type Firestore } from 'firebase/firestore';
import { samePerson } from './identity.ts';
import { parseMoyoungDate, scheduleTimes } from '../../../functions/src/dateTime.js';
export async function saveLegacyParticipation(db: Firestore, collectionName: 'club_polls' | 'club_schedules',
  id: string, clubId: number, username: string, value: string | boolean) {
  if (!username) throw new Error('로그인이 필요합니다.');
  const ref = doc(db, collectionName, id);
  return runTransaction(db, async tx => {
    const [target, profile] = await Promise.all([tx.get(ref), tx.get(doc(db, 'users', username))]);
    if (!target.exists() || !profile.exists()) throw new Error('대상 또는 회원을 찾을 수 없습니다.');
    const data = target.data(), user: Record<string, any> = {...profile.data(), username};
    if (user.id == null || typeof user.name !== 'string') throw new Error('회원 정보를 확인해주세요.');
    if (Number(data.club_id ?? data.clubId) !== clubId) throw new Error('다른 모임의 항목입니다.');
    const poll = collectionName === 'club_polls';
    const deadline = poll ? parseMoyoungDate(data.closesAtMs ?? data.closes_at_ms ?? data.end_date ?? data.endDate, true)
      : scheduleTimes(data).endsAtMs;
    if (deadline === null || deadline <= Date.now() || data.is_closed || data.isClosed) throw new Error('마감된 참여입니다.');
    if (poll && (user.role === 'guest' || user.is_guest)) throw new Error('게스트는 투표할 수 없습니다.');
    if (poll && (typeof value !== 'string' || !data.options?.includes(value))) throw new Error('선택지를 확인해주세요.');
    if (!poll && typeof value !== 'boolean') throw new Error('참석 상태를 확인해주세요.');
    const field = poll ? 'votes' : 'attendees';
    const values = (Array.isArray(data[field]) ? data[field] : []).filter((entry: any) => !samePerson(entry, user));
    const entry = { user_key: username, user_id: user.id, user_name: user.name, user_cell: user.cell_name ?? '' };
    if (poll) values.push({ ...entry, selected_option: value, voted_at: new Date().toISOString() });
    else if (value) values.push({ ...entry, userId: user.id, userName: user.name, cellName: user.cell_name ?? '', joined_at: new Date().toISOString() });
    tx.update(ref, { [field]: values });
    return poll ? { message: '투표가 반영되었습니다.' } : {
      message: value ? '참석 신청되었습니다.' : '참석이 취소되었습니다.', is_attending: value, attendees: values,
    };
  });
}
