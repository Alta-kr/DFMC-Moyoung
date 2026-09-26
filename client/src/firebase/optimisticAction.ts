// One in-flight mutation per panel avoids stale rollback overwriting a later user action.
export function createOptimisticAction() {
  let pending = false;
  return async (apply: () => void, persist: () => Promise<unknown>, rollback: () => void) => {
    if (pending) return false;
    pending = true;
    try {
      apply();
      try { await persist(); } catch (error) { rollback(); throw error; }
      return true;
    } finally { pending = false; }
  };
}
