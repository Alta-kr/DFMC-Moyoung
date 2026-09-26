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
