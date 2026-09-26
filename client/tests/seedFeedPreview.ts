import { seedMemberFeed } from './previewFixtures.ts';
const uid = process.argv[2];
if (!uid || !/^[a-zA-Z0-9_-]+$/.test(uid)) throw new Error('Usage: node --experimental-strip-types client/tests/seedFeedPreview.ts <local-auth-uid>');
// Only seed a UID that already has a profile in the local emulator.
const result = await fetch('http://127.0.0.1:8080/v1/projects/demo-moyoung/databases/(default)/documents/users/' + uid,
  { headers: { Authorization: 'Bearer owner' } });
if (!result.ok) throw new Error('Create the local Auth profile first.');
await seedMemberFeed(uid, 'preview-club');
console.log('Local summary and 23 feed cards ready. Refresh the member home.');
