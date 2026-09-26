import React, { useState, useEffect, useRef } from 'react';
import { User, CellItem } from '../types';
import { ShieldCheck, UserPlus, LogIn, Lock, AlertTriangle, Clock, KeyRound, Check, HelpCircle } from 'lucide-react';

interface LoginPageProps {
  onLoginSuccess: (user: User, token: string) => void;
  onNavigateHome?: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess, onNavigateHome }) => {
  const [isRegister, setIsRegister] = useState(false);
  
  // Login fields (ID and Real Name only)
  const [loginUsername, setLoginUsername] = useState('');
  const [loginName, setLoginName] = useState('');
  
  // Register fields (ID, Name, Direct Cell or Acquaintance Name)
  const [regUsername, setRegUsername] = useState('');
  const [regName, setRegName] = useState('');
  const [regCellName, setRegCellName] = useState('');
  const [isAcquaintance, setIsAcquaintance] = useState(false);
  const [showAcquaintanceHelp, setShowAcquaintanceHelp] = useState(false);
  const [cells, setCells] = useState<CellItem[]>([]);

  // 2FA Modal states
  const [show2FAModal, setShow2FAModal] = useState(false);
  const [twoFACode, setTwoFACode] = useState(['', '', '', '', '']);
  const [devCodeHint, setDevCodeHint] = useState('');
  const [twoFAError, setTwoFAError] = useState('');
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const [twoFALoading, setTwoFALoading] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Guest Mode states
  const [showGuestModal, setShowGuestModal] = useState(false);
  const [guestName, setGuestName] = useState('');
  const [guestAcquaintance, setGuestAcquaintance] = useState('');
  const [guestLoading, setGuestLoading] = useState(false);
  const [guestError, setGuestError] = useState('');

  // Fetch cell list for dropdowns
  useEffect(() => {
    fetch('/api/lobby/data')
      .then((res) => res.json())
      .then((data) => {
        if (data.cells && data.cells.length > 0) {
          setCells(data.cells);
        }
      })
      .catch(() => {});
  }, []);

  // Cooldown countdown timer
  useEffect(() => {
    let timer: any;
    if (cooldownRemaining > 0) {
      timer = setInterval(() => {
        setCooldownRemaining((prev) => (prev <= 1 ? 0 : prev - 1));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [cooldownRemaining]);

  // Handle passwordless login (ID + Real Name only)
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: loginUsername.trim(),
          name: loginName.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        if (data.is_locked) setIsLocked(true);
        if (data.cooldownSeconds) setCooldownRemaining(data.cooldownSeconds);
        throw new Error(data.error || '로그인에 실패했습니다.');
      }

      if (data.requires2FA || data.requires2fa) {
        setShow2FAModal(true);
        setDevCodeHint(data.devCodeHint || '기본 코드: 8470');
        setTwoFACode(['', '', '', '', '']);
        setTwoFAError('');
        setTimeout(() => inputRefs.current[0]?.focus(), 100);
      } else if (data.user) {
        localStorage.setItem('dfmc_token', data.token);
        onLoginSuccess(data.user, data.token);
      }
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Handle guest login
  const handleGuestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!guestName.trim()) {
      setGuestError('성함을 입력해주세요.');
      return;
    }
    if (!guestAcquaintance.trim()) {
      setGuestError('교회 지인(인도자) 이름을 입력해주세요.');
      return;
    }
    setGuestLoading(true);
    setGuestError('');

    try {
      const res = await fetch('/api/auth/guest-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: guestName.trim(),
          acquaintance_name: guestAcquaintance.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '게스트 접속에 실패했습니다.');
      localStorage.setItem('dfmc_token', data.token);
      onLoginSuccess(data.user, data.token);
    } catch (err: any) {
      setGuestError(err.message);
    } finally {
      setGuestLoading(false);
    }
  };

  // Handle passwordless register (ID + Name + Cell)
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: regUsername.trim(),
          name: regName.trim(),
          cell_name: regCellName.trim(),
          is_acquaintance: isAcquaintance,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || '회원가입에 실패했습니다.');
      }

      setSuccessMessage('회원가입이 완료되었습니다! 자동 로그인합니다.');
      localStorage.setItem('dfmc_token', data.token);
      setTimeout(() => {
        onLoginSuccess(data.user, data.token);
      }, 800);
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setLoading(false);
    }
  };


  // 2FA code box input change & auto advance
  const handle2FAInput = (index: number, val: string) => {
    if (cooldownRemaining > 0 || isLocked) return;

    // Take only the last typed character
    const char = val.slice(-1);
    const newCode = [...twoFACode];
    newCode[index] = char;
    setTwoFACode(newCode);

    // Auto focus next input if entered
    if (char && index < 4) {
      inputRefs.current[index + 1]?.focus();
    }

    // If all 5 characters are entered, trigger verification immediately!
    const fullCode = newCode.join('');
    if (fullCode.length === 5) {
      triggerVerify2FA(fullCode);
    }
  };

  // 2FA Backspace handling
  const handle2FAKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !twoFACode[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  // Trigger 2FA Verification
  const triggerVerify2FA = async (codeToVerify: string) => {
    setTwoFALoading(true);
    setTwoFAError('');

    try {
      const res = await fetch('/api/auth/verify-2fa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: codeToVerify }),
      });

      const data = await res.json();
      if (!res.ok) {
        if (data.is_locked) {
          setIsLocked(true);
        }
        if (data.cooldownSeconds) {
          setCooldownRemaining(data.cooldownSeconds);
        }
        // Reset code inputs
        setTwoFACode(['', '', '', '', '']);
        inputRefs.current[0]?.focus();
        throw new Error(data.error || '인증에 실패했습니다.');
      }

      // Success
      localStorage.setItem('dfmc_token', data.token);
      setShow2FAModal(false);
      onLoginSuccess(data.user, data.token);
    } catch (err: any) {
      setTwoFAError(err.message);
    } finally {
      setTwoFALoading(false);
    }
  };

  return (
    <div style={{ padding: '24px 16px', display: 'flex', flexDirection: 'column', minHeight: '100vh', justifyContent: 'center' }}>
      
      {/* Full-screen Loading Overlay */}
      {(loading || twoFALoading) && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(255, 255, 255, 0.8)',
          backdropFilter: 'blur(3px)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999
        }}>
          <div style={{
            width: '42px', height: '42px',
            border: '4px solid #e2e8f0',
            borderTop: '4px solid var(--color-primary)',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }} />
          <style>{`
            @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
          `}</style>
          <div style={{ marginTop: '16px', fontWeight: '800', color: 'var(--color-primary)', fontSize: '15px' }}>
            {twoFALoading ? '인증 확인 중...' : '잠시만 기다려주세요...'}
          </div>
        </div>
      )}

      {/* Brand Header */}
      <div style={{ textAlign: 'center', marginBottom: '28px' }}>
        <div style={{
          width: '56px',
          height: '56px',
          background: 'var(--color-primary-gradient)',
          borderRadius: '16px',
          color: 'white',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '26px',
          fontWeight: '900',
          boxShadow: 'var(--shadow-glow)',
          marginBottom: '12px'
        }}>
          모
        </div>
        <h1 style={{ fontSize: '24px', fontWeight: '900', color: 'var(--color-text-main)', letterSpacing: '-0.5px' }}>
          모영 <span style={{ fontSize: '18px', color: 'var(--color-primary)', fontWeight: '700' }}>Moyoung</span>
        </h1>
        <p style={{ fontSize: '13.5px', color: 'var(--color-text-muted)', marginTop: '4px' }}>
          둔산제일감리교회
        </p>
      </div>

      {/* Main Form Card */}
      <div className="card" style={{ padding: '24px', boxShadow: 'var(--shadow-lg)' }}>
        {/* Toggle Mode */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          background: 'var(--color-card-subtle)',
          padding: '4px',
          borderRadius: 'var(--radius-md)',
          marginBottom: '20px'
        }}>
          <button
            type="button"
            className="btn btn-sm"
            style={{
              background: !isRegister ? 'white' : 'transparent',
              color: !isRegister ? 'var(--color-primary)' : 'var(--color-text-muted)',
              boxShadow: !isRegister ? 'var(--shadow-sm)' : 'none',
              fontWeight: '700'
            }}
            onClick={() => { setIsRegister(false); setErrorMessage(''); }}
          >
            <LogIn size={15} />
            로그인
          </button>
          <button
            type="button"
            className="btn btn-sm"
            style={{
              background: isRegister ? 'white' : 'transparent',
              color: isRegister ? 'var(--color-primary)' : 'var(--color-text-muted)',
              boxShadow: isRegister ? 'var(--shadow-sm)' : 'none',
              fontWeight: '700'
            }}
            onClick={() => { setIsRegister(true); setErrorMessage(''); }}
          >
            <UserPlus size={15} />
            회원가입
          </button>
        </div>

        {errorMessage && (
          <div style={{
            padding: '12px 14px',
            background: 'var(--color-danger-light)',
            color: 'var(--color-danger)',
            borderRadius: 'var(--radius-md)',
            fontSize: '13px',
            marginBottom: '16px',
            lineHeight: 1.5,
            border: '1px solid rgba(239, 68, 68, 0.2)'
          }}>
            {errorMessage}
          </div>
        )}

        {successMessage && (
          <div style={{
            padding: '12px 14px',
            background: 'var(--color-success-light)',
            color: 'var(--color-success)',
            borderRadius: 'var(--radius-md)',
            fontSize: '13px',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <Check size={16} />
            {successMessage}
          </div>
        )}

        {!isRegister ? (
          /* Login Form (ID and Real Name only) */
          <form onSubmit={handleLogin}>

            <div className="form-group">
              <label className="form-label">아이디</label>
              <input
                type="text"
                inputMode="url"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                autoComplete="username"
                className="form-input"
                placeholder="아이디를 입력하세요"
                value={loginUsername}
                onChange={(e) => setLoginUsername(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">이름 (실명)</label>
              <input
                type="text"
                inputMode="text"
                spellCheck={false}
                autoComplete="name"
                className="form-input"
                placeholder="예: 홍길동"
                value={loginName}
                onChange={(e) => setLoginName(e.target.value)}
                required
              />
            </div>


            <button
              type="submit"
              className="btn btn-primary btn-block"
              disabled={loading}
              style={{ marginTop: '8px', padding: '12px', fontSize: '15px', fontWeight: '700' }}
            >
              {loading ? '확인 중...' : '로그인'}
            </button>

            {/* Guest Start Button right below login */}
            <div style={{ marginTop: '14px', textAlign: 'center' }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                margin: '12px 0',
                color: 'var(--color-text-light)',
                fontSize: '11.5px'
              }}>
                <div style={{ flex: 1, height: '1px', background: 'var(--color-border)' }} />
                <span style={{ padding: '0 8px' }}>또는</span>
                <div style={{ flex: 1, height: '1px', background: 'var(--color-border)' }} />
              </div>

              <button
                type="button"
                onClick={() => {
                  setGuestError('');
                  setShowGuestModal(true);
                }}
                className="btn btn-block"
                style={{
                  padding: '11px',
                  background: '#f8fafc',
                  color: '#334155',
                  border: '1.5px solid #cbd5e1',
                  borderRadius: 'var(--radius-md)',
                  fontWeight: '700',
                  fontSize: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                <span>🙋‍♂️ 게스트로 참여하기</span>
              </button>
            </div>

          </form>
        ) : (
          /* Register Form (ID, Name, Cell only - No password!) */
          <form onSubmit={handleRegister}>
            <div className="form-group">
              <label className="form-label">아이디</label>
              <input
                type="text"
                inputMode="url"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                autoComplete="username"
                className="form-input"
                placeholder="영문, 숫자 아이디"
                value={regUsername}
                onChange={(e) => setRegUsername(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">이름 (실명)</label>
              <input
                type="text"
                inputMode="text"
                spellCheck={false}
                autoComplete="name"
                className="form-input"
                placeholder="예: 홍길동"
                value={regName}
                onChange={(e) => setRegName(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label className="form-label" style={{ margin: 0 }}>
                  {isAcquaintance ? '지인 이름(실명)' : '소속 셀'}
                </label>

                {/* Acquaintance checkbox & Question mark */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <label style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '12px',
                    cursor: 'pointer',
                    color: isAcquaintance ? 'var(--color-primary)' : 'var(--color-text-muted)',
                    fontWeight: isAcquaintance ? '700' : 'normal'
                  }}>
                    <input
                      type="checkbox"
                      checked={isAcquaintance}
                      onChange={(e) => {
                        setIsAcquaintance(e.target.checked);
                        setRegCellName('');
                      }}
                      style={{ accentColor: 'var(--color-primary)', cursor: 'pointer' }}
                    />
                    지인
                  </label>

                  <button
                    type="button"
                    onClick={() => setShowAcquaintanceHelp(!showAcquaintanceHelp)}
                    title="도움말 보기"
                    style={{
                      background: showAcquaintanceHelp ? 'var(--color-primary-light)' : 'transparent',
                      border: 'none',
                      borderRadius: '50%',
                      cursor: 'pointer',
                      padding: '2px',
                      color: showAcquaintanceHelp ? 'var(--color-primary)' : 'var(--color-text-light)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <HelpCircle size={16} />
                  </button>
                </div>
              </div>

              {/* Tooltip Help Box */}
              {showAcquaintanceHelp && (
                <div className="animate-fade-in" style={{
                  padding: '10px 12px',
                  background: '#eff6ff',
                  border: '1px solid #bfdbfe',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '12px',
                  color: '#1e40af',
                  marginBottom: '8px',
                  lineHeight: 1.5
                }}>
                  💡 <strong>교인 교차 검증 안내</strong>: 본 사이트는 둔산제일교회 교인 또는 교인의 지인만 등록할 수 있습니다. 소속 셀이 없으신 경우 <strong>지인 체크박스</strong>를 선택하고, 이미 교회에 등록된 <strong>지인의 이름을 작성</strong>해주세요.
                </div>
              )}

              {/* Direct Text Input */}
              <input
                type="text"
                className="form-input"
                placeholder={isAcquaintance ? "등록된 지인 이름 입력 (예: 홍길동)" : "소속 셀 이름 입력 (예: 홍길동셀)"}
                value={regCellName}
                onChange={(e) => setRegCellName(e.target.value)}
                required
              />

              <span style={{ display: 'block', marginTop: '6px', fontSize: '11.5px', color: 'var(--color-text-muted)' }}>
                {isAcquaintance
                  ? "※ 둔산제일교회에 등록된 지인의 실명을 입력하셔야 교차 확인 후 가입이 승인됩니다."
                  : "※ 교회에 등록된 공식 셀 이름을 정확히 입력하셔야 교차 확인 후 승인됩니다."}
              </span>
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-block"
              disabled={loading}
              style={{ marginTop: '12px', padding: '12px', fontSize: '15px', fontWeight: '700' }}
            >
              {loading ? '가입 처리 중...' : '회원가입 완료'}
            </button>
          </form>
        )}
      </div>

      {/* 2FA Verification Modal for Server Admin */}
      {show2FAModal && (
        <div className="modal-overlay">
          <div className="modal-content animate-fade-in" style={{ padding: '24px', maxWidth: '380px' }}>
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <div style={{
                width: '52px',
                height: '52px',
                borderRadius: '50%',
                background: '#ede9fe',
                color: '#7c3aed',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '12px'
              }}>
                <ShieldCheck size={28} />
              </div>
              <h3 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--color-text-main)' }}>
                서버 관리자 2단계 보안 인증
              </h3>
              <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                <code>baehh4159@gmail.com</code>으로 발송된<br />
                <strong>대소문자 구분 5글자</strong> 보안코드를 입력하세요.
              </p>
            </div>


            {isLocked ? (
              <div style={{
                padding: '14px',
                background: 'var(--color-danger-light)',
                color: 'var(--color-danger)',
                borderRadius: 'var(--radius-md)',
                fontSize: '13px',
                textAlign: 'center',
                marginBottom: '16px',
                border: '1px solid var(--color-danger)'
              }}>
                <AlertTriangle size={24} style={{ margin: '0 auto 8px', display: 'block' }} />
                <strong>🚨 시스템 영구 잠금 상태</strong>
                <p style={{ marginTop: '4px', fontSize: '12px' }}>
                  2FA 인증을 5회 연속 실패하여 보안 락이 걸렸습니다. DB 직접 조작으로만 해제 가능합니다.
                </p>
              </div>
            ) : cooldownRemaining > 0 ? (
              <div style={{
                padding: '14px',
                background: '#fffbeb',
                color: '#b45309',
                borderRadius: 'var(--radius-md)',
                fontSize: '13px',
                textAlign: 'center',
                marginBottom: '16px',
                border: '1px solid #fde68a'
              }}>
                <Clock size={22} style={{ margin: '0 auto 6px', display: 'block' }} />
                <strong>1분 쿨다운 대기 중</strong>
                <p style={{ marginTop: '4px', fontSize: '12.5px' }}>
                  인증 실패로 인해 잠시 입력이 제한되었습니다.<br />
                  남은 시간: <span style={{ fontWeight: '800', fontSize: '15px' }}>{cooldownRemaining}초</span>
                </p>
              </div>
            ) : null}

            {twoFAError && (
              <div style={{
                padding: '10px 12px',
                background: 'var(--color-danger-light)',
                color: 'var(--color-danger)',
                borderRadius: 'var(--radius-md)',
                fontSize: '12.5px',
                marginBottom: '14px',
                lineHeight: 1.4
              }}>
                {twoFAError}
              </div>
            )}

            {/* 5-box Input UI */}
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '20px' }}>
              {twoFACode.map((digit, idx) => (
                <input
                  key={idx}
                  ref={(el) => { inputRefs.current[idx] = el; }}
                  type="text"
                  maxLength={1}
                  disabled={cooldownRemaining > 0 || isLocked || twoFALoading}
                  value={digit}
                  onChange={(e) => handle2FAInput(idx, e.target.value)}
                  onKeyDown={(e) => handle2FAKeyDown(idx, e)}
                  style={{
                    width: '46px',
                    height: '54px',
                    textAlign: 'center',
                    fontSize: '24px',
                    fontWeight: '800',
                    fontFamily: 'monospace',
                    borderRadius: 'var(--radius-md)',
                    border: digit ? '2px solid var(--color-primary)' : '1.5px solid var(--color-border)',
                    background: cooldownRemaining > 0 || isLocked ? '#f1f5f9' : 'white',
                    outline: 'none',
                    transition: 'var(--transition)'
                  }}
                />
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShow2FAModal(false)}
                style={{ fontSize: '13px' }}
              >
                닫기
              </button>

              <button
                type="button"
                className="btn btn-primary"
                disabled={twoFACode.join('').length !== 5 || cooldownRemaining > 0 || isLocked || twoFALoading}
                onClick={() => triggerVerify2FA(twoFACode.join(''))}
                style={{ fontSize: '13px' }}
              >
                {twoFALoading ? '검증 중...' : '인증 확인'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Guest Login Modal */}
      {showGuestModal && (
        <div className="modal-overlay" style={{ zIndex: 1000 }} onClick={() => setShowGuestModal(false)}>
          <div
            className="modal-card animate-scale-up"
            style={{
              maxWidth: '340px',
              width: '90%',
              padding: '24px 20px',
              background: '#0f172a',
              color: '#ffffff',
              borderRadius: '16px',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.6)',
              border: '1px solid #1e293b'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#ffffff', marginBottom: '20px', textAlign: 'center' }}>
              게스트 로그인
            </h3>

            {guestError && (
              <div style={{
                padding: '8px 12px',
                background: 'rgba(239, 68, 68, 0.15)',
                color: '#f87171',
                borderRadius: '8px',
                fontSize: '12px',
                marginBottom: '14px',
                border: '1px solid rgba(239, 68, 68, 0.3)'
              }}>
                {guestError}
              </div>
            )}

            <form onSubmit={handleGuestSubmit}>
              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#ffffff', marginBottom: '6px' }}>
                  본인 이름
                </label>
                <input
                  type="text"
                  className="form-input"
                  style={{
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    color: '#0f172a',
                    fontWeight: '500',
                    fontSize: '14px',
                    padding: '10px 12px',
                    borderRadius: '8px'
                  }}
                  placeholder="이름 입력"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  autoFocus
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#ffffff', marginBottom: '6px' }}>
                  지인 이름
                </label>
                <input
                  type="text"
                  className="form-input"
                  style={{
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    color: '#0f172a',
                    fontWeight: '500',
                    fontSize: '14px',
                    padding: '10px 12px',
                    borderRadius: '8px'
                  }}
                  placeholder="지인 이름 입력"
                  value={guestAcquaintance}
                  onChange={(e) => setGuestAcquaintance(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setShowGuestModal(false)}
                  className="btn"
                  style={{
                    padding: '10px',
                    fontWeight: '600',
                    background: '#1e293b',
                    color: '#94a3b8',
                    border: '1px solid #334155',
                    borderRadius: '8px',
                    fontSize: '13.5px'
                  }}
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={guestLoading}
                  className="btn btn-primary"
                  style={{
                    padding: '10px',
                    fontWeight: '700',
                    fontSize: '13.5px',
                    borderRadius: '8px'
                  }}
                >
                  {guestLoading ? '접속 중...' : '시작하기'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
