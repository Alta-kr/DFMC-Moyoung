import { runTransaction } from './adminFirestore.js';
import { parseMoyoungDate, scheduleTimes } from './dateTime.js';

// 참석·투표는 회원별 하위 문서에 저장해 한 일정 문서를 두고 경합하지 않는다.
// club_schedules/{id}/attendance/id_{회원ID}, club_polls/{id}/ballots/id_{회원ID}
// participation_v: 2인 문서만 하위 문서를 읽고, 이전 문서는 기존 배열을 그대로 읽는다.
const SUB = { club_schedules: 'attendance', club_polls: 'ballots' };
const FIELD = { club_schedules: 'attendees', club_polls: 'votes' };
export const PARTICIPATION_V = 2;
export const migrated = data => data?.participation_v === PARTICIPATION_V;
export const participantKey = (entry, index = 0) => entry?.user_id != null || entry?.userId != null
  ? 'id_' + String(entry.user_id ?? entry.userId)
  : entry?.user_key != null ? 'key_' + String(entry.user_key).replace(/\//g, '_') : 'legacy_' + index;
const timeOf = entry => String(entry.joined_at ?? entry.voted_at ?? '');
const sorted = list => list.sort((a, b) => timeOf(a).localeCompare(timeOf(b)));
const strip = ({ club_id: _c, parent_id: _p, ...entry }) => entry;
// 모집 인원. 비어 있거나 1 미만이면 제한 없음.
export const capacityOf = data => {
  const value = Number(data?.max_attendees ?? data?.maxAttendees);
  return Number.isInteger(value) && value > 0 ? value : null;
};

// 한 모영의 모든 참석/투표를 한 번에 읽는다(부모 id → 목록).
export async function participantsByClub(db, collectionName, clubId) {
  const snap = await db.collectionGroup(SUB[collectionName]).where('club_id', '==', Number(clubId)).get();
  const map = new Map();
  for (const d of snap.docs) {
    const entry = d.data(), key = String(entry.parent_id);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(strip(entry));
  }
  for (const list of map.values()) sorted(list);
  return map;
}
export const withParticipants = (collectionName, data, map) => migrated(data)
  ? { ...data, [FIELD[collectionName]]: map.get(String(data.id)) || [] } : data;

export async function participantsOf(db, collectionName, docId, data) {
  if (!migrated(data)) return Array.isArray(data?.[FIELD[collectionName]]) ? data[FIELD[collectionName]] : [];
  const snap = await db.collection(collectionName).doc(docId).collection(SUB[collectionName]).get();
  return sorted(snap.docs.map(d => strip(d.data())));
}

// 새 일정·투표는 처음부터 회원별 구조로 만든다.
export async function createWithParticipants(db, collectionName, docId, data, first = []) {
  const ref = db.collection(collectionName).doc(docId), batch = db.batch();
  const defined = Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined));
  batch.set(ref, { ...defined, [FIELD[collectionName]]: [], participation_v: PARTICIPATION_V });
  first.forEach((entry, i) => batch.set(ref.collection(SUB[collectionName]).doc(participantKey(entry, i)),
    { ...entry, club_id: Number(data.club_id), parent_id: Number(data.id) }));
  await batch.commit();
}

// 기존 배열을 하위 문서로 옮긴다. 이미 옮긴 문서는 건드리지 않아 여러 번 실행해도 안전하다.
export async function migrateParticipation(db, collectionName, docId) {
  const ref = db.collection(collectionName).doc(docId);
  return runTransaction(db, async tx => {
    const snap = await tx.get(ref);
    if (!snap.exists() || migrated(snap.data())) return 0;
    const data = snap.data(), list = Array.isArray(data[FIELD[collectionName]]) ? data[FIELD[collectionName]] : [];
    const seen = new Set();
    list.forEach((entry, i) => {
      const key = participantKey(entry, i);
      if (seen.has(key)) return;
      seen.add(key);
      tx.set(ref.collection(SUB[collectionName]).doc(key), { ...entry, club_id: Number(data.club_id ?? data.clubId), parent_id: Number(data.id) });
    });
    // 되돌리기용으로 기존 배열은 남기고 표시만 바꾼다.
    tx.update(ref, { participation_v: PARTICIPATION_V });
    return seen.size;
  });
}

export async function saveParticipation(db, collectionName, docId, clubId, username, value) {
  if (!username) throw new Error('로그인이 필요합니다.');
  const ref = db.collection(collectionName).doc(docId);
  const [target, profile] = await Promise.all([ref.get(), db.collection('users').doc(username).get()]);
  if (!target.exists || !profile.exists) throw new Error('대상 또는 회원을 찾을 수 없습니다.');
  const data = target.data(), user = { ...profile.data(), username };
  if (user.id == null || typeof user.name !== 'string') throw new Error('회원 정보를 확인해 주세요.');
  if (Number(data.club_id ?? data.clubId) !== Number(clubId)) throw new Error('다른 모임의 항목입니다.');
  const poll = collectionName === 'club_polls';
  const deadline = poll ? parseMoyoungDate(data.closesAtMs ?? data.closes_at_ms ?? data.end_date ?? data.endDate, true)
    : scheduleTimes(data).endsAtMs;
  if (deadline === null || deadline <= Date.now() || data.is_closed || data.isClosed) throw new Error('이미 마감되었습니다.');
  if (poll && (user.role === 'guest' || user.is_guest)) throw new Error('게스트는 투표할 수 없습니다.');
  if (poll && (typeof value !== 'string' || !data.options?.includes(value))) throw new Error('선택지를 확인해 주세요.');
  if (!poll && typeof value !== 'boolean') throw new Error('참석 상태를 확인해 주세요.');
  if (!migrated(data)) await migrateParticipation(db, collectionName, docId);

  // 회원 ID가 문서 이름이라 같은 회원은 한 번만 들어간다. 다른 회원과는 부딪히지 않는다.
  const own = ref.collection(SUB[collectionName]).doc(participantKey({ user_id: user.id }));
  const entry = { user_key: username, user_id: user.id, user_name: user.name, user_cell: user.cell_name ?? '',
    club_id: Number(clubId), parent_id: Number(data.id) };
  if (poll) await own.set({ ...entry, selected_option: value, voted_at: new Date().toISOString() });
  else if (value) {
    const record = { ...entry, userId: user.id, userName: user.name, cellName: user.cell_name ?? '', joined_at: new Date().toISOString() };
    const cap = capacityOf(data);
    // 정원이 있으면 트랜잭션으로 인원을 세어 동시에 신청해도 정원을 넘지 않게 한다.
    if (cap) await db.runTransaction(async tx => {
      const [mine, all] = await Promise.all([tx.get(own), tx.get(ref.collection(SUB[collectionName]))]);
      if (!mine.exists && all.size >= cap) throw Object.assign(new Error('모집 인원이 찼습니다.'), { status: 409 });
      tx.set(own, record);
    });
    else await own.set(record);
  }
  else await own.delete();
  // 이전 방식으로 저장된 같은 회원 기록(아이디 키)이 남아 있으면 정리한다.
  const legacyKey = ref.collection(SUB[collectionName]).doc('key_' + username);
  if ((await legacyKey.get()).exists) await legacyKey.delete();
  if (poll) return { message: '투표가 반영되었습니다.' };
  const attendees = await participantsOf(db, collectionName, docId, { participation_v: PARTICIPATION_V });
  return { message: value ? '참석 신청되었습니다.' : '참석이 취소되었습니다.', is_attending: value, attendees };
}
