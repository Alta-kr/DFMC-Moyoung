// Explicitly localhost + demo project: this helper must never target production.
const root = 'http://127.0.0.1:8080/v1/projects/demo-moyoung/databases/(default)/documents';
function encode(value: any): any {
  if (value === null) return { nullValue: null };
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number') return { integerValue: String(value) };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(encode) } };
  return { mapValue: { fields: Object.fromEntries(Object.entries(value).map(([key, v]) => [key, encode(v)])) } };
}
export async function putFixture(path: string, data: Record<string, unknown>) {
  const response = await fetch(root + '/' + path, {
    method: 'PATCH', headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: encode(data).mapValue.fields }),
  });
  if (!response.ok) throw new Error('Local fixture write failed: ' + await response.text());
}
export async function deleteFixture(path: string) {
  const response = await fetch(root + '/' + path, { method: 'DELETE', headers: { Authorization: 'Bearer owner' } });
  if (!response.ok) throw new Error('Local fixture delete failed');
}
export function sampleFeed(count = 23) {
  return Array.from({ length: count }, (_, index) => ({
    id: 'item-' + String(index).padStart(3, '0'),
    type: index === 0 ? 'notice' : index === 1 ? 'schedule' : index === 2 ? 'poll' : 'post',
    title: index === 0 ? '모영 공지' : index === 1 ? '함께하는 모임' : index === 2 ? '다음 모임 투표' : '모영 이야기 ' + (index + 1),
    excerpt: '서로의 일상을 나누고 다음 만남을 준비해요.',
    priority: index === 0 ? 100 : index === 1 ? 90 : index === 2 ? 80 : 10,
    // Tied timestamps intentionally exercise document-ID ordering at page boundaries.
    sortAt: 1800000000000,
    status: index === 22 ? 'closed' : 'active',
    sourceId: 'local-source-' + index,
    closesAtMs: 4102444800000,
    optionIds: index === 2 ? ['option-a', 'option-b'] : [],
    options: index === 2 ? [{ id: 'option-a', label: '토요일' }, { id: 'option-b', label: '일요일' }] : [],
    stats: { attendanceCount: 0, heartCount: 0, commentCount: 0, voteCounts: {} },
  }));
}
export async function seedMemberFeed(uid: string, clubId: string, count = 23) {
  if (!/^[a-zA-Z0-9_-]+$/.test(uid) || !/^[a-zA-Z0-9_-]+$/.test(clubId)) throw new Error('Invalid fixture ID');
  const existingClub = await fetch(root + '/clubs/' + clubId, { headers: { Authorization: 'Bearer owner' } });
  if (existingClub.status === 404) {
    await putFixture('clubs/' + clubId, { name: '함께하는 모영', membershipSchemaVersion: 1, leaderUids: [], publicSummary: { nextSchedule: { title: '주말 모임', startsAt: 1800000000000 } } });
  } else if (!existingClub.ok) throw new Error('Cannot inspect local club fixture');
  const existingMember = await fetch(root + '/clubs/' + clubId + '/members/' + uid, { headers: { Authorization: 'Bearer owner' } });
  if (existingMember.status === 404) await putFixture('clubs/' + clubId + '/members/' + uid, { role: 'member', status: 'active', is_leader: false });
  else if (!existingMember.ok) throw new Error('Cannot inspect local membership fixture');
  await putFixture('users/' + uid + '/summaries/home', {
    notice: '이번 주에도 모영에서 만나요.',
    clubs: [{ id: clubId, name: '함께하는 모영', nextSchedule: { title: '주말 모임', startsAt: 1800000000000 } }],
    updatedAt: Date.now(),
  });
  for (const { id, ...item } of sampleFeed(count)) {
    const target = 'clubs/' + clubId + '/feed/' + id;
    const existing = await fetch(root + '/' + target, { headers: { Authorization: 'Bearer owner' } });
    if (existing.status === 404) await putFixture(target, item);
    else if (!existing.ok) throw new Error('Cannot inspect local feed fixture');
  }
}
