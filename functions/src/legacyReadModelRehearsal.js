import { FieldPath } from 'firebase-admin/firestore';
import { normalizeSource, reconcileFeedSource } from './feedProjection.js';
import { scheduleTimes, parseMoyoungDate } from './dateTime.js';
// Local rehearsal only. Production migration needs an approved export/mapping and rollback snapshot.
export async function prepareLegacyReadModel(db, clubId) {
  if(!/^127\.0\.0\.1:\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST??'') || !db.projectId.startsWith('demo-')) throw new Error('Local demo emulator only');
  if(!/^\d+$/.test(clubId)) throw new Error('Explicit numeric club ID required');
  const club=db.doc('clubs/'+clubId);
  if(!(await club.get()).exists) throw new Error('Missing club');
  const sources=[];
  for(const collection of ['club_posts','club_polls','club_schedules']){
    let cursor=null;
    do{
      let q=db.collection(collection).where('club_id','==',Number(clubId)).orderBy(FieldPath.documentId()).limit(100);
      if(cursor)q=q.startAfter(cursor);
      const page=await q.get();
      for(const source of page.docs){
        const data=source.data(),patch={feedSchemaVersion:1,feedClubId:clubId};
        if(collection==='club_schedules'){Object.assign(patch,scheduleTimes(data));if(patch.startsAtMs===null||patch.endsAtMs===null||patch.endsAtMs<=patch.startsAtMs)throw new Error('Invalid schedule date: '+source.id);}
        if(collection==='club_polls')patch.closesAtMs=parseMoyoungDate(data.closesAtMs??data.end_date,true);
        if(!normalizeSource(collection,source.id,{...data,...patch}))throw new Error('Invalid source: '+source.ref.path);
        sources.push({source,patch,collection});
      }
      cursor=page.size===100?page.docs.at(-1):null;
    }while(cursor);
  }
  await club.update({feedProjectionVersion:1});
  for(const {source,patch,collection} of sources){
    await source.ref.update(patch,{lastUpdateTime:source.updateTime});
    await reconcileFeedSource(db,collection,source.id);
  }
  const feed=await club.collection('feed').get();
  if(feed.size!==sources.length)throw new Error('Source/feed mismatch; reader remains disabled');
  await club.update({feedReadModelVersion:1});
  return {sources:sources.length,feed:feed.size};
}
