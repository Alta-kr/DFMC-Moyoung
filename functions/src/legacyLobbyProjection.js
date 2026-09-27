import { FieldPath } from 'firebase-admin/firestore';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { getFirestore } from 'firebase-admin/firestore';
// Activate only after schedule dates and source mappings have been backfilled and checked.
export async function refreshLegacyLobby(db, now=Date.now()) {
  return db.runTransaction(async tx=>{
    const settingsRef=db.doc('lobby_settings/main');
    const settings=await tx.get(settingsRef);
    if(settings.data()?.readModelVersion!==1) return false;
    const [clubs,cells,notices,popups]=await Promise.all([
      tx.get(db.collection('clubs')),tx.get(db.collection('cells')),
      tx.get(db.collection('notices').orderBy('created_at','desc').limit(1)),
      tx.get(db.collection('popups').where('is_active','==',1).limit(1))]);
    const schedules=(await Promise.all(clubs.docs.map(async club=>{
      const next=await tx.get(db.collection('club_schedules').where('club_id','==',Number(club.id))
        .where('startsAtMs','>=',now).orderBy('startsAtMs').orderBy(FieldPath.documentId()).limit(1));
      const source=next.docs[0],data=source?.data();if(!data) return null;
      return {id:data.id,sourceId:source.id,club_id:Number(club.id),club_name:club.data().name,
        club_icon:club.data().icon??'',title:data.title??'',event_date:data.event_date??'',location:data.location??'',
        fee_info:data.fee_info??'',attendees_count:Array.isArray(data.attendees)?data.attendees.length:0,
        total_members:club.data().member_count??0,timestamp:data.startsAtMs,is_attending:false};
    }))).filter(Boolean).sort((a,b)=>a.timestamp-b.timestamp);
    const notice=notices.docs[0]?.data();
    tx.set(db.doc('_readModels/lobby'),{version:1,updatedAt:now,clubs:clubs.docs.map(d=>d.data()),cells:cells.docs.map(d=>d.data()),
      notice:notice?.is_active===0?null:notice??null,popup:popups.docs[0]?.data()??null,welcome:settings.data(),schedules});
    return true;
  });
}
const region='asia-northeast3';
const trigger=document=>onDocumentWritten({document,region,retry:true,maxInstances:2},()=>refreshLegacyLobby(getFirestore()));
export const legacyLobbySchedule=trigger('club_schedules/{id}');
export const legacyLobbyClub=trigger('clubs/{id}');
export const legacyLobbyNotice=trigger('notices/{id}');
export const legacyLobbyPopup=trigger('popups/{id}');
export const legacyLobbyCell=trigger('cells/{id}');
export const legacyLobbySettings=trigger('lobby_settings/{id}');
export const advanceLegacyLobby=onSchedule({schedule:'every 5 minutes',region,maxInstances:1},()=>refreshLegacyLobby(getFirestore()));
