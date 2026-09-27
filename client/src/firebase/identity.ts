export function samePerson(record: any, user: any): boolean {
  if (!record || !user) return false;
  const key = record.user_key ?? record.userKey ?? record.uid;
  if (key != null) return String(key) === String(user.uid ?? user.username);
  const id = record.user_id ?? record.userId;
  return id != null && user.id != null && String(id) === String(user.id);
}
export function managerIds(club: any): string[] {
  const ids = club?.manager_ids ?? club?.managerIds;
  return Array.isArray(ids) ? ids.map(String) : [];
}
export function isClubManager(club: any, user: any): boolean {
  return ['head_admin', 'server_admin'].includes(user?.role) ||
    (user?.role !== 'guest' && !user?.is_guest && managerIds(club).includes(String(user?.id)));
}
