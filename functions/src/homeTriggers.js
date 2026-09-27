import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { getFirestore } from 'firebase-admin/firestore';
import { refreshClubSummary, processHomeSummaryPage, syncMemberSummary, advanceHomeSchedules, queueClubHomeRefresh, refreshUserHomes } from './homeProjection.js';
const region = 'asia-northeast3';
const relevant = snapshot => {
  const data = snapshot?.data();
  return data?.type === 'schedule' ? [data.type, data.title, data.status, data.startsAt ?? null] : null;
};
export const projectHomeSchedule = onDocumentWritten({
  document: 'clubs/{clubId}/feed/{itemId}', region, retry: true, maxInstances: 5,
}, async event => {
  if (JSON.stringify(relevant(event.data?.before)) === JSON.stringify(relevant(event.data?.after))) return;
  await refreshClubSummary(getFirestore(), event.params.clubId);
});
export const distributeHomeSummary = onDocumentWritten({
  document: '_homeSummaryJobs/{clubId}', region, retry: true, maxInstances: 5,
}, async event => {
  if (event.data?.after.data()?.pending) await processHomeSummaryPage(getFirestore(), event.params.clubId);
});
export const projectMemberHome = onDocumentWritten({
  document: 'clubs/{clubId}/members/{uid}', region, retry: true, maxInstances: 5,
}, async event => {
  const db=getFirestore(), {clubId,uid}=event.params;
  const member=db.doc('clubs/'+clubId+'/members/'+uid), link=db.doc('users/'+uid+'/_clubLinks/'+clubId);
  await db.runTransaction(async tx=>{const current=await tx.get(member);if(current.exists) tx.set(link,{clubId}); else tx.delete(link);});
  await syncMemberSummary(db,clubId,uid);
});
export const advanceHomeScheduleItems = onSchedule({
  schedule: 'every 5 minutes', timeZone: 'Asia/Seoul', region,
  maxInstances: 1, timeoutSeconds: 540, retryCount: 3,
}, async () => { await advanceHomeSchedules(getFirestore()); });

export const projectClubHome = onDocumentWritten({document:'clubs/{clubId}',region,retry:true,maxInstances:5},async event=>{
  const fields = snap => {const d=snap?.data(); return [d?.name ?? null,d?.membershipSchemaVersion ?? null];};
  if(JSON.stringify(fields(event.data?.before))===JSON.stringify(fields(event.data?.after))) return;
  await refreshClubSummary(getFirestore(),event.params.clubId);
  await queueClubHomeRefresh(getFirestore(),event.params.clubId);
});
export const projectUserHome = onDocumentWritten({document:'users/{uid}',region,retry:true,maxInstances:5},async event=>{
  const fields=snap=>{const d=snap?.data();return [d?.role??null,d?.is_guest??false];};
  if(JSON.stringify(fields(event.data?.before))===JSON.stringify(fields(event.data?.after))) return;
  await refreshUserHomes(getFirestore(),event.params.uid);
});
