import { FieldPath } from 'firebase-admin/firestore';

// Compatibility for the existing domain helpers, executed only by Admin SDK.
const snapshot = value => ({ id: value.id, ref: value.ref, exists: () => value.exists, data: () => value.data() });
const clean = value => Array.isArray(value) ? value.map(item => item === undefined ? null : clean(item))
  : value && Object.getPrototypeOf(value) === Object.prototype
    ? Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined).map(([key, item]) => [key, clean(item)])) : value;
export const collection = (db, ...parts) => db.collection(parts.join('/'));
export const doc = (db, ...parts) => db.doc(parts.join('/'));
export const getDoc = async ref => snapshot(await ref.get());
export const getDocs = async ref => {
  const result = await ref.get();
  return { docs: result.docs.map(snapshot), size: result.size, empty: result.empty };
};
export const setDoc = (ref, data, options) => options ? ref.set(clean(data), options) : ref.set(clean(data));
export const updateDoc = (ref, data) => ref.update(clean(data));
export const addDoc = (ref, data) => ref.add(clean(data));
export const deleteDoc = ref => ref.delete();
export const query = (ref, ...constraints) => constraints.reduce((result, apply) => apply(result), ref);
export const where = (...args) => ref => ref.where(...args);
export const orderBy = (...args) => ref => ref.orderBy(...args);
export const limit = count => ref => ref.limit(count);
export const startAfter = (...args) => ref => ref.startAfter(...args);
export const documentId = () => FieldPath.documentId();
export const runTransaction = (db, update) => db.runTransaction(tx => update({
  get: async ref => snapshot(await tx.get(ref)),
  set: (ref, data, options) => options ? tx.set(ref, clean(data), options) : tx.set(ref, clean(data)),
  update: (ref, data) => tx.update(ref, clean(data)),
  delete: ref => tx.delete(ref),
}));
