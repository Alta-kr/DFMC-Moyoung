import { useRef, useState } from 'react';
import { changeMembership } from '../firebase/membershipAdmin';

// Mounted only for an administrator profile; the Function independently validates authority.
export default function MembershipAdminPanel() {
  const [clubId, setClubId] = useState('');
  const [uid, setUid] = useState('');
  const [status, setStatus] = useState<'active' | 'revoked'>('active');
  const [isLeader, setLeader] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const lock = useRef(false);
  return <section style={{ marginTop: 24 }}>
    <h2>모임 회원 관리</h2>
    <form onSubmit={async event => {
      event.preventDefault();
      if (lock.current) return;
      lock.current = true; setBusy(true); setMessage('');
      try {
        const result = await changeMembership({ clubId: clubId.trim(), uid: uid.trim(), status, isLeader });
        setMessage(result.changed ? '회원 상태를 변경했습니다.' : '이미 같은 상태입니다.');
      } catch (error) {
        setMessage((error as { message?: string }).message || '변경하지 못했습니다. 다시 시도해주세요.');
      } finally { lock.current = false; setBusy(false); }
    }}>
      <fieldset disabled={busy} style={{ border: 0, padding: 0 }}>
        <label className="form-label" htmlFor="membership-club">모임 ID</label>
        <input id="membership-club" className="form-input" required value={clubId} onChange={e => setClubId(e.target.value)} />
        <label className="form-label" htmlFor="membership-user">회원 UID</label>
        <input id="membership-user" className="form-input" required value={uid} onChange={e => setUid(e.target.value)} />
        <label className="form-label" htmlFor="membership-status">가입 상태</label>
        <select id="membership-status" className="form-input" value={status} onChange={e => {
          setStatus(e.target.value as 'active' | 'revoked'); setLeader(false);
        }}><option value="active">가입</option><option value="revoked">가입 해제</option></select>
        <label><input type="checkbox" disabled={status === 'revoked'} checked={isLeader} onChange={e => setLeader(e.target.checked)} /> 총무 지정</label>
        <button className="btn btn-primary" type="submit">{busy ? '처리 중…' : '변경하기'}</button>
      </fieldset>
    </form>
    {message && <p role="status">{message}</p>}
  </section>;
}
