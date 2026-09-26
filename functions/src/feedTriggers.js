import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { getFirestore } from 'firebase-admin/firestore';
import { reconcileFeedSource, expireFeed } from './feedProjection.js';

const project = collection => onDocumentWritten({
  document: collection + '/{sourceId}', region: 'asia-northeast3', retry: true, maxInstances: 5,
}, event => reconcileFeedSource(getFirestore(), collection, event.params.sourceId));

export const projectPost = project('club_posts');
export const projectSchedule = project('club_schedules');
export const projectPoll = project('club_polls');
export const expireFeedItems = onSchedule({
  schedule: 'every 5 minutes', timeZone: 'Asia/Seoul', region: 'asia-northeast3',
  maxInstances: 1, timeoutSeconds: 300, retryCount: 3,
}, async () => { await expireFeed(getFirestore()); });
