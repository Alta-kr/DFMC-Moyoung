import { test } from 'node:test';
import assert from 'node:assert/strict';
import { previewMigration } from '../src/migrationPreview.js';
const now = Date.parse('2026-09-27T00:00:00Z');
const fixture = () => ({ version: 1, clubs: [{ id: 'club_a', membershipSchemaVersion: 1 }],
  sources: [{ collection: 'club_posts', id: 'post_a', data: { feedSchemaVersion: 1, feedClubId: 'club_a',
    created_at: '2026-09-26T00:00:00Z', content: 'PRIVATE_BODY' } }],
  accounts: [{ uid: 'uid_a', password: 'SECRET_PASSWORD' }],
  identityMappings: [{ legacyId: 'old', uid: 'uid_a', verificationRef: 'PRIVATE_EVIDENCE' }] });
test('preview is deterministic, does not mutate input or disclose private content', () => {
  const input = fixture(), original = structuredClone(input);
  const result = previewMigration(input, now);
  assert.equal(result.totals.eligibleCards, 1);
  assert.equal(result.applySupported, false);
  assert.equal(result.identities[0].status, 'requires-manual-evidence-review');
  assert.deepEqual(input, original);
  assert.deepEqual(result, previewMigration(input, now));
  for (const secret of ['PRIVATE_BODY', 'SECRET_PASSWORD', 'PRIVATE_EVIDENCE']) assert.equal(JSON.stringify(result).includes(secret), false);
});
test('mapping collisions, ambiguous aliases, missing ownership evidence and invalid dates block candidates', () => {
  const input = fixture();
  input.sources.push(structuredClone(input.sources[0]));
  input.identityMappings.push({ legacyId: 'other', uid: 'uid_a', verificationRef: 'ref' });
  const result = previewMigration(input, now);
  assert.equal(result.cards.length, 0); assert.equal(result.identities.length, 0);
  assert.equal(result.issues.length, 4);
  const bad = fixture();
  bad.sources[0].data.feed_club_id = 'different';
  delete bad.identityMappings[0].verificationRef;
  assert.deepEqual(previewMigration(bad, now).issues.map(x => x.code), ['CONFLICTING_ALIASES', 'OWNERSHIP_EVIDENCE_REQUIRED']);
  const date = fixture();
  date.sources[0].data.created_at = 'invalid';
  assert.equal(previewMigration(date, now).cards.length, 0);
  assert.throws(() => previewMigration({}, now));
});

test('legacy audit resolves duplicate names by explicit IDs without disclosing names', () => {
  const input=fixture();
  input.legacyUsers=[{legacyId:'old',id:1,name:'PRIVATE_SAME_NAME',role:'member'},
    {legacyId:'other',id:2,name:'PRIVATE_SAME_NAME',role:'member'}];
  input.accounts.push({uid:'uid_b'});
  input.identityMappings.push({legacyId:'other',uid:'uid_b',verificationRef:'checked'});
  Object.assign(input.clubs[0],{manager_ids:['2'],manager_names:'PRIVATE_SAME_NAME'});
  const before=structuredClone(input),result=previewMigration(input,now);
  assert.equal(result.readyForReview,true);
  assert.deepEqual(result.legacyAudit.managerCandidates,[{clubIndex:0,userIndexes:[1]}]);
  assert.equal(result.legacyAudit.completenessVerified,false);
  assert.equal(JSON.stringify(result).includes('PRIVATE_SAME_NAME'),false);
  assert.deepEqual(input,before);
});

test('legacy identity ambiguity, guests and name-only managers block review',()=>{
  const input=fixture();
  input.legacyUsers=[{legacyId:'old',id:1,role:'member'},{legacyId:'other',id:'1',role:'member'},
    {legacyId:'guest',id:3,role:'guest'}];
  input.clubs[0].manager_ids=['1'];
  let result=previewMigration(input,now);
  assert.equal(result.readyForReview,false);
  assert.equal(result.legacyAudit.managerCandidates.length,0);
  for(const code of ['DUPLICATE_LEGACY_ID','UNMAPPED_LEGACY_USER','MANAGER_ACCOUNT_NOT_UNIQUE']) assert.ok(result.issues.some(issue=>issue.code===code));
  input.clubs[0].manager_ids=['3'];
  assert.ok(previewMigration(input,now).issues.some(issue=>issue.code==='GUEST_MANAGER_FORBIDDEN'));
  delete input.clubs[0].manager_ids;input.clubs[0].manager_names='동명이인';
  assert.ok(previewMigration(input,now).issues.some(issue=>issue.code==='EXPLICIT_MANAGER_IDS_REQUIRED'));
  input.clubs[0].manager_ids=['1','2','3','4'];
  assert.ok(previewMigration(input,now).issues.some(issue=>issue.code==='INVALID_MANAGER_IDS'));
  assert.throws(()=>previewMigration({...input,legacyUsers:{}},now));
});

test('schedule ranges and legacy club mappings cannot silently disagree',()=>{
  const input=fixture();
  input.sources[0].collection='club_schedules';
  Object.assign(input.sources[0].data,{club_id:1,event_date:'2026-09-27 14:00 ~ 16:00'});
  assert.ok(previewMigration(input,now).issues.some(issue=>issue.code==='LEGACY_CLUB_MAPPING_MISMATCH'));
  input.clubs[0].legacyId=1;
  assert.equal(previewMigration(input,now).cards.length,1);
  input.sources[0].data.startsAtMs=Date.parse('2026-09-27T15:00:00+09:00');
  assert.ok(previewMigration(input,now).issues.some(issue=>issue.code==='CONFLICTING_SCHEDULE_TIME'));
  delete input.sources[0].data.startsAtMs;
  input.sources[0].data.event_date='2026-09-27 16:00 ~ 14:00';
  assert.ok(previewMigration(input,now).issues.some(issue=>issue.code==='INVALID_SCHEDULE_TIME'));
});

test('conflicting poll deadline and missing legacy mapping are review blockers',()=>{
  const input=fixture();
  input.sources[0].collection='club_polls';
  Object.assign(input.sources[0].data,{options:['A','B'],end_date:'2026-09-27',closesAtMs:Date.parse('2026-09-28T00:00:00Z')});
  input.legacyUsers=[];
  const result=previewMigration(input,now);
  assert.equal(result.readyForReview,false);
  assert.equal(result.cards.length,0);
  for(const code of ['CONFLICTING_POLL_DEADLINE','LEGACY_ACCOUNT_NOT_UNIQUE']) assert.ok(result.issues.some(issue=>issue.code===code));
});
