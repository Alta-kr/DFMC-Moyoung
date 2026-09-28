import {onSchedule} from 'firebase-functions/v2/scheduler';
import {getFirestore} from 'firebase-admin/firestore';
export const cleanApiSessions=onSchedule({schedule:'every 60 minutes',region:'asia-northeast3',maxInstances:1},async()=>{
  const db=getFirestore();
  for(const name of ['_apiSessions','_apiChallenges','_apiLimits']) {
    for(let page=0;page<10;page++) {
      const expired=await db.collection(name).where('expiresAt','<',new Date()).limit(400).get();
      if(expired.empty)break;
      const batch=db.batch();expired.docs.forEach(doc=>batch.delete(doc.ref,{lastUpdateTime:doc.updateTime}));await batch.commit();
      if(expired.size<400)break;
    }
  }
});
