// Read current source + last applied contribution inside a transaction.
// Event delivery order and duplicate event IDs do not affect the resulting totals.
export async function reconcileActivity(db, clubId, itemId, activityId) {
  const feedRef = db.doc('clubs/' + clubId + '/feed/' + itemId);
  const sourceRef = feedRef.collection('activity').doc(activityId);
  const receiptRef = feedRef.collection('_appliedActivity').doc(activityId);
  return db.runTransaction(async tx => {
    const [feed, source, receipt] = await tx.getAll(feedRef, sourceRef, receiptRef);
    if (!feed.exists) return; // Never recreate a deleted feed card.
    const data = source.data();
    const current = {
      attendance: data?.kind === 'attendance' && data.value === true ? 1 : 0,
      heart: data?.kind === 'heart' && data.value === true ? 1 : 0,
      comment: data?.kind === 'comment' ? 1 : 0,
      option: data?.kind === 'vote' && typeof data.value === 'string' ? data.value : null,
    };
    const previous = receipt.data()?.contribution || { attendance: 0, heart: 0, comment: 0, option: null };
    if (Object.keys(current).every(key => current[key] === previous[key])) return;
    const stats = feed.data().stats || {};
    const votes = new Map(Object.entries(stats.voteCounts || {}));
    if (previous.option) votes.set(previous.option, Math.max(0, Number(votes.get(previous.option) || 0) - 1));
    if (current.option) votes.set(current.option, Number(votes.get(current.option) || 0) + 1);
    tx.update(feedRef, { stats: {
      attendanceCount: Math.max(0, (stats.attendanceCount || 0) + current.attendance - previous.attendance),
      heartCount: Math.max(0, (stats.heartCount || 0) + current.heart - previous.heart),
      commentCount: Math.max(0, (stats.commentCount || 0) + current.comment - previous.comment),
      voteCounts: Object.fromEntries(votes),
    } });
    tx.set(receiptRef, { contribution: current });
  });
}
