import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { getFirestore } from 'firebase-admin/firestore';
import { reconcileActivity } from './activityProjection.js';

export const projectActivity = onDocumentWritten({
  document: 'clubs/{clubId}/feed/{itemId}/activity/{activityId}',
  region: 'asia-northeast3', retry: true, maxInstances: 5,
}, event => reconcileActivity(getFirestore(), event.params.clubId, event.params.itemId, event.params.activityId));