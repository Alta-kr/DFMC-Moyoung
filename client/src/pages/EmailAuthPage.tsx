import MembershipAdminPanel from '../components/MembershipAdminPanel';
import MemberHomePage from './MemberHomePage';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { User } from 'firebase/auth';
import { emailAuth, profileDb, observeEmailUser, registerEmail, loginEmail, logoutEmail, resetPassword,
  verifyEmail, readProfile, ensureProfile, authError, type MemberProfile } from '../firebase/emailAuth';

export default function EmailAuthPage() {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [profile, setProfile] = useState<MemberProfile | null>(null);
  const [mode, setMode] = useState<'login' | 'register' | 'reset'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [verified, setVerified] = useState(false);
  const generation = useRef(0);
  const locked = useRef(false);

  useEffect(() => {
    const lifecycle = generation;
    const unsubscribe = observeEmailUser(async next => {
      const version = ++generation.current;
      setUser(next); setProfile(null); setError(''); setMessage('');
      setVerified(next?.emailVerified || false);
      if (!next) { setReady(true); return; }
      try {
        const value = await readProfile(next);
        if (generation.current === version) setProfile(value);
      } catch (e) {
        if (generation.current === version) setError(authError(e));
      } finally {
        if (generation.current === version) setReady(true);
      }
    });
    return () => { lifecycle.current++; unsubscribe(); };
  }, []);

  async function run(action: () => Promise<void>) {
    if (locked.current) return;
    locked.current = true; setBusy(true); setError(''); setMessage('');
    try { await action(); } catch (e) { setError(authError(e)); }
    finally { locked.current = false; setBusy(false); setPassword(''); }
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    void run(async () => {
      if (mode === 'reset') {
        await resetPassword(email);
        setMessage('가입된 이메일이면 비밀번호 재설정 안내를 확인해주세요.');
      } else if (mode === 'register') {
        const account = await registerEmail(email, password, name);
        setProfile(await readProfile(account));
        await verifyEmail();
        setMessage('가입되었습니다. 이메일 인증 안내를 확인해주세요.');
      } else {
        await loginEmail(email, password);
      }
    });
  }
  if (!ready) return <main className="card" role="status">로그인 상태를 확인하고 있습니다.</main>;
  return <main style={{ maxWidth: 440, margin: '48px auto', padding: 24, width: '100%' }} className="card">
    <h1>모영</h1>
    {error && <p role="alert">{error}</p>}
    {message && <p role="status">{message}</p>}
    {user ? <>
      <p>{profile?.name || user.displayName || '회원'}님, 로그인되었습니다.</p>
      <p>{user.email}</p>
      {verified && (profile?.role === 'server_admin' || profile?.role === 'head_admin') && <MembershipAdminPanel />}
      {profile && <MemberHomePage key={user.uid} db={profileDb} uid={user.uid} />}
      <p>{verified ? '이메일 인증 완료' : '이메일 인증이 필요합니다.'}</p>
      {!profile && <form onSubmit={event => { event.preventDefault(); void run(async () => {
        const current = emailAuth.currentUser;
        if (current) setProfile(await ensureProfile(current, name));
      }); }}>
        <label className="form-label" htmlFor="profile-name">프로필 이름</label>
        <input id="profile-name" className="form-input" value={name} maxLength={80} required onChange={e => setName(e.target.value)} />
        <button className="btn" disabled={busy}>프로필 저장·복구</button>
      </form>}
      {!verified && <button className="btn" disabled={busy} onClick={() => void run(async () => {
        await verifyEmail(); setMessage('인증 안내를 다시 보냈습니다.');
      })}>인증 이메일 다시 보내기</button>}
      <button className="btn" disabled={busy} onClick={() => void run(async () => {
        await user.reload(); await user.getIdToken(true); setVerified(user.emailVerified);
        setMessage(user.emailVerified ? '이메일 인증을 확인했습니다.' : '이메일 인증 후 다시 확인해주세요.');
      })}>인증 상태 확인</button>
      <button className="btn" disabled={busy} onClick={() => void run(async () => { await logoutEmail(); })}>로그아웃</button>
    </> : <>
      <h2>{mode === 'register' ? '회원가입' : mode === 'reset' ? '비밀번호 재설정' : '로그인'}</h2>
      <form onSubmit={submit}>
        <fieldset disabled={busy} style={{ border: 0, padding: 0 }}>
          {mode === 'register' && <div className="form-group">
            <label htmlFor="name" className="form-label">이름</label>
            <input id="name" className="form-input" autoComplete="name" maxLength={80} required value={name} onChange={e => setName(e.target.value)} />
          </div>}
          <div className="form-group">
            <label htmlFor="email" className="form-label">이메일</label>
            <input id="email" className="form-input" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} />
          </div>
          {mode !== 'reset' && <div className="form-group">
            <label htmlFor="password" className="form-label">비밀번호</label>
            <input id="password" className="form-input" type="password" autoComplete={mode === 'register' ? 'new-password' : 'current-password'} minLength={6} required value={password} onChange={e => setPassword(e.target.value)} />
          </div>}
          <button className="btn btn-primary btn-block">{busy ? '처리 중…' : mode === 'register' ? '가입하기' : mode === 'reset' ? '재설정 안내 받기' : '로그인'}</button>
        </fieldset>
      </form>
      <nav aria-label="인증 메뉴">
        {(['login', 'register', 'reset'] as const).filter(value => value !== mode).map(value =>
          <button key={value} className="btn" disabled={busy} onClick={() => {
            setMode(value); setPassword(''); setError(''); setMessage('');
          }}>{value === 'login' ? '로그인' : value === 'register' ? '회원가입' : '비밀번호 찾기'}</button>)}
      </nav>
    </>}
  </main>;
}
