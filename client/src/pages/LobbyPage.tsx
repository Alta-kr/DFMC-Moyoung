import { accountCache, cacheForAccount } from '../firebase/accountCache';
import React, { useState, useEffect } from 'react';
import { User, Club, Notice, ScheduleHighlight, PopupItem, CellItem, WelcomeSettings } from '../types';
import { PopupModal } from '../components/PopupModal';
import { CellUpdateModal } from '../components/CellUpdateModal';
import { Megaphone, Users, Calendar, Clock, MapPin, ArrowRight, ChevronDown, ChevronUp, Sparkles, Check, UserPlus, X, LogIn, User as UserIcon, RefreshCw } from 'lucide-react';

interface LobbyPageProps {
  user: User | null;
  onUpdateUser: (updated: Partial<User>) => void;
  onNavigateClub: (clubId: number, initialTab?: 'talk' | 'polls' | 'posts' | 'schedules' | 'photos') => void;
  onRequireLogin?: () => void;
  onLoginSuccess?: (user: User, token: string) => void;
}

const getInitialLobbyCache = () => {
  try {
    const cached = accountCache.getItem('dfmc_lobby_cache');
    if (!cached) return null;
    return JSON.parse(cached);
  } catch {
    return null;
  }
};

export const LobbyPage: React.FC<LobbyPageProps> = ({ user, onUpdateUser, onNavigateClub, onRequireLogin, onLoginSuccess }) => {
  const accountCache = cacheForAccount(user?.username || 'anonymous');
  const [initialCache] = useState(() => getInitialLobbyCache());
  const [notice, setNotice] = useState<Notice | null>(() => initialCache?.notice || null);
  const [schedules, setSchedules] = useState<ScheduleHighlight[]>(() => {
    if (!initialCache) return [];
    const rawSchedules: ScheduleHighlight[] = initialCache.schedules || initialCache.highlightedSchedules || [];
    const clubMap = new Map<string, ScheduleHighlight>();
    rawSchedules.forEach((s) => {
      const key = String(s.club_id);
      if (!clubMap.has(key)) clubMap.set(key, s);
    });
    return Array.from(clubMap.values());
  });
  const [clubs, setClubs] = useState<Club[]>(() => initialCache?.clubs || []);
  const [popup, setPopup] = useState<PopupItem | null>(() => initialCache?.popup || null);
  const [cells, setCells] = useState<CellItem[]>(() => initialCache?.cells || []);
  const [welcome, setWelcome] = useState<WelcomeSettings | null>(() => initialCache?.welcome || initialCache?.welcomeMessage || null);
  const [showPopup, setShowPopup] = useState(false);
  const [noticeExpanded, setNoticeExpanded] = useState(false);
  const [loading, setLoading] = useState<boolean>(() => !initialCache);
  const [loadingAttendId, setLoadingAttendId] = useState<number | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Auth / Login Modal on direct attend click (Member login with guest login option)
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'member' | 'guest'>('member');
  const [loginUsername, setLoginUsername] = useState('');
  const [loginName, setLoginName] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState('');

  const [guestName, setGuestName] = useState('');
  const [guestAcquaintance, setGuestAcquaintance] = useState('');
  const [guestLoading, setGuestLoading] = useState(false);
  const [guestError, setGuestError] = useState('');
  const [pendingSchedForGuest, setPendingSchedForGuest] = useState<ScheduleHighlight | null>(null);

  const flashToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  useEffect(() => {
    if (loadingAttendId !== null) return;
    try {
      const cache = cacheForAccount(user?.username || 'anonymous');
      const previous = cache.getItem('dfmc_lobby_cache');
      if (previous) cache.setItem('dfmc_lobby_cache', JSON.stringify({ ...JSON.parse(previous), schedules, highlightedSchedules: schedules }));
    } catch {}
  }, [schedules, loadingAttendId, user?.username]);

  const handleToggleLobbyAttend = async (sched: ScheduleHighlight) => {
    if (loadingAttendId !== null) return;
    const token = accountCache.getItem('dfmc_token');
    setLoadingAttendId(sched.id);

    const willAttend = !sched.is_attending;
    // Optimistic attendance update in lobby state
    setSchedules(prev => prev.map(s => {
      if (s.id !== sched.id) return s;
      return {
        ...s,
        is_attending: willAttend,
        attendees_count: Math.max(0, s.attendees_count + (willAttend ? 1 : -1))
      };
    }));

    try {
      const res = await fetch(`/api/clubs/${sched.club_id}/schedules/${sched.id}/attend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ attending: willAttend })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      flashToast(data.message || (willAttend ? '참석 신청되었습니다! 🙏' : '참석이 취소되었습니다.'));
    } catch (err: any) {
      // Rollback on error
      setSchedules(prev => prev.map(s => {
        if (s.id !== sched.id) return s;
        return {
          ...s,
          is_attending: !willAttend,
          attendees_count: Math.max(0, s.attendees_count + (!willAttend ? 1 : -1))
        };
      }));
      flashToast(err.message || '참석 처리에 실패했습니다.');
    } finally {
      setLoadingAttendId(null);
    }
  };

  const handleAttendButtonClick = (sched: ScheduleHighlight) => {
    if (!user) {
      setPendingSchedForGuest(sched);
      setAuthModalMode('member');
      setLoginUsername('');
      setLoginName('');
      setLoginError('');
      setGuestName('');
      setGuestAcquaintance('');
      setGuestError('');
      setShowAuthModal(true);
      return;
    }
    handleToggleLobbyAttend(sched);
  };

  const handleMemberLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginUsername.trim()) {
      setLoginError('아이디를 입력해주세요.');
      return;
    }
    if (!loginName.trim()) {
      setLoginError('성도 실명을 입력해주세요.');
      return;
    }
    setLoginLoading(true);
    setLoginError('');

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
      if (!res.ok) throw new Error(data.error || '로그인에 실패했습니다.');

      if (data.requires2FA || data.requires2fa) {
        setShowAuthModal(false);
        onRequireLogin?.();
        return;
      }

      if (data.user && data.token) {
        accountCache.setItem('dfmc_token', data.token);
        accountCache.setItem('dfmc_user', JSON.stringify(data.user));
        onLoginSuccess?.(data.user, data.token);
        setShowAuthModal(false);

        // If there was a pending schedule, immediately attend it
        if (pendingSchedForGuest) {
          flashToast(`${data.user.name}님 환영합니다! 일정 참석을 등록합니다.`);
          const targetSched = pendingSchedForGuest;
          setPendingSchedForGuest(null);
          setTimeout(() => {
            handleToggleLobbyAttend(targetSched);
          }, 150);
        }
      }
    } catch (err: any) {
      setLoginError(err.message);
    } finally {
      setLoginLoading(false);
    }
  };

  const handleGuestModalSubmit = async (e: React.FormEvent) => {
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

      accountCache.setItem('dfmc_token', data.token);
      accountCache.setItem('dfmc_user', JSON.stringify(data.user));
      onLoginSuccess?.(data.user, data.token);
      setShowAuthModal(false);

      // If there was a pending schedule, immediately attend it
      if (pendingSchedForGuest) {
        flashToast(`${data.user.name}님 환영합니다! 일정 참석을 등록합니다.`);
        const targetSched = pendingSchedForGuest;
        setPendingSchedForGuest(null);
        setTimeout(() => {
          handleToggleLobbyAttend(targetSched);
        }, 150);
      }
    } catch (err: any) {
      setGuestError(err.message);
    } finally {
      setGuestLoading(false);
    }
  };

  const handleClubScheduleClick = (clubId: number) => {
    if (!user) {
      alert('로그인이 필요합니다.');
      onRequireLogin?.();
      return;
    }
    if (user.role === 'guest') {
      alert('게스트 모드 입니다.');
      return;
    }
    onNavigateClub(clubId, 'schedules');
  };

  const handleClubClick = (club: Club) => {
    if (!user) {
      alert('로그인이 필요합니다.');
      onRequireLogin?.();
      return;
    }
    if (user.role === 'guest') {
      alert('게스트 모드 입니다.');
      return;
    }
    onNavigateClub(club.id, 'talk');
  };

  // Fetch lobby data
  useEffect(() => {
    const token = accountCache.getItem('dfmc_token');

    const cached = accountCache.getItem('dfmc_lobby_cache');
    if (cached) {
      try {
        const data = JSON.parse(cached);
        setNotice(data.notice || null);
        const rawSchedules: ScheduleHighlight[] = data.schedules || data.highlightedSchedules || [];
        const clubMap = new Map<string, ScheduleHighlight>();
        rawSchedules.forEach((s) => {
          const key = String(s.club_id);
          if (!clubMap.has(key)) clubMap.set(key, s);
        });
        setSchedules(Array.from(clubMap.values()));
        setClubs(data.clubs || []);
        setCells(data.cells || []);
        setWelcome(data.welcome || data.welcomeMessage || null);
      } catch (e) { }
    }

    fetch('/api/lobby/data', {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      }
    })
      .then((res) => res.json())
      .then((data) => {
        accountCache.setItem('dfmc_lobby_cache', JSON.stringify(data));
        setNotice(data.notice || null);
        const rawSchedules: ScheduleHighlight[] = data.schedules || data.highlightedSchedules || [];
        const clubMap = new Map<string, ScheduleHighlight>();
        rawSchedules.forEach((s) => {
          const key = String(s.club_id);
          if (!clubMap.has(key)) clubMap.set(key, s);
        });
        setSchedules(Array.from(clubMap.values()));
        setClubs(data.clubs || []);
        setCells(data.cells || []);
        setWelcome(data.welcome || data.welcomeMessage || null);

        // Check if popup should show
        if (data.popup) {
          setPopup(data.popup);
          const hideDate = accountCache.getItem('dfmc_hide_popup_date');
          const todayStr = new Date().toISOString().split('T')[0];
          if (hideDate !== todayStr) {
            setShowPopup(true);
          }
        }
      })
      .catch((err) => console.error('Failed to load lobby data:', err))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={{ padding: '16px 16px 80px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className="animate-fade-in"
          style={{
            position: 'fixed',
            top: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(15, 23, 42, 0.92)',
            color: 'white',
            padding: '10px 20px',
            borderRadius: '9999px',
            fontSize: '13px',
            fontWeight: '700',
            boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            backdropFilter: 'blur(8px)',
            pointerEvents: 'none'
          }}
        >
          <span>{toastMessage}</span>
        </div>
      )}

      {/* 1. Cell Update Modal (Only for regular members if reorganized) */}
      {user && user.role === 'member' && user.cell_verified === 0 && (
        <CellUpdateModal
          user={user}
          cells={cells}
          onCellUpdated={(newCell) => {
            onUpdateUser({ cell_name: newCell, cell_verified: 1 });
          }}
        />
      )}

      {/* 2. Active Popup Modal */}
      {showPopup && popup && (
        <PopupModal popup={popup} onClose={() => setShowPopup(false)} />
      )}

      {/* 3. Welcome Banner */}
      <div style={{
        background: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)',
        borderRadius: 'var(--radius-lg)',
        padding: '18px 20px',
        color: 'white',
        boxShadow: 'var(--shadow-md)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{ position: 'relative', zIndex: 2 }}>
          {welcome?.is_targeted && welcome?.group_name && (
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              background: 'rgba(254, 240, 138, 0.22)',
              color: '#fef08a',
              border: '1px solid rgba(254, 240, 138, 0.45)',
              padding: '2px 8px',
              borderRadius: '20px',
              fontSize: '11px',
              fontWeight: '800',
              marginBottom: '6px',
              letterSpacing: '0.2px'
            }}>
              <span>{welcome.group_name} 맞춤 환영</span>
            </div>
          )}
          {welcome?.welcome_tagline && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', opacity: 0.9, marginBottom: '4px' }}>
              <Sparkles size={14} color="#fde047" />
              <span>{welcome.welcome_tagline}</span>
            </div>
          )}
          <h2 style={{ fontSize: '18px', fontWeight: '800' }}>
            환영합니다{user ? `, ${user.name}님!` : '!'}
          </h2>
          <p style={{ fontSize: '12.5px', opacity: 0.85, marginTop: '2px' }}>
            {user ? (
              <>소속 셀: <strong>{user.cell_name}</strong>{welcome?.welcome_message ? ` | ${welcome.welcome_message}` : ''}</>
            ) : (
              <>{welcome?.welcome_message || '둔산제일교회 성도님들과 함께하는 은혜로운 모영 교제에 초대합니다.'}</>
            )}
          </p>
        </div>
        {/* Subtle decorative circle */}
        <div style={{
          position: 'absolute',
          right: '-20px',
          bottom: '-30px',
          width: '120px',
          height: '120px',
          background: 'rgba(255, 255, 255, 0.08)',
          borderRadius: '50%',
        }} />
      </div>

      {/* 4. Church Whole Notice Card */}
      {notice && (
        <div className="card" style={{
          borderLeft: '4px solid var(--color-primary)',
          background: '#ffffff',
          position: 'relative'
        }}>
          <div
            style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', cursor: 'pointer' }}
            onClick={() => setNoticeExpanded(!noticeExpanded)}
          >
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <div style={{
                width: '34px',
                height: '34px',
                borderRadius: '8px',
                background: 'var(--color-primary-light)',
                color: 'var(--color-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <Megaphone size={18} />
              </div>
              <div>
                <h3 style={{ fontSize: '14.5px', fontWeight: '700', color: 'var(--color-text-main)', lineHeight: 1.3 }}>
                  {notice.title}
                </h3>
              </div>
            </div>

            <button style={{ background: 'transparent', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', padding: '4px' }}>
              {noticeExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </button>
          </div>

          {noticeExpanded && (
            <div className="animate-fade-in" style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--color-border)', fontSize: '13px', color: 'var(--color-text-muted)', lineHeight: 1.6, whiteSpace: 'pre-line' }}>
              {notice.content}
              <div style={{ textAlign: 'right', marginTop: '8px', fontSize: '11px', color: 'var(--color-text-light)' }}>
                작성자: {notice.author_name}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 5. Highlight Schedules Section ("📅 지금 모집 중인 모영 일정" - 모영당 가장 임박한 1개씩 노출) */}
      {schedules.length > 0 && (
        <div id="active-schedules-section" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Calendar size={18} color="#2563eb" />
              <h3 style={{ fontSize: '15px', fontWeight: '800', color: '#1d4ed8' }}>
                지금 모집 중인 모영 일정 ({schedules.length}개)
              </h3>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {schedules.map((sched, idx) => {
              const isImminent = idx === 0;

              return (
                <div
                  key={sched.id}
                  className="card"
                  style={{
                    background: isImminent ? 'linear-gradient(to right, #eff6ff, #dbeafe)' : '#ffffff',
                    border: isImminent ? '1.5px solid #93c5fd' : '1px solid var(--color-border)',
                    boxShadow: 'var(--shadow-sm)',
                    padding: '14px 16px',
                    borderRadius: 'var(--radius-md)'
                  }}
                >
                  {/* 상단 뱃지 및 참석자 수 */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span
                        onClick={() => handleClubScheduleClick(sched.club_id)}
                        className="badge"
                        style={{
                          background: isImminent ? '#1d4ed8' : '#2563eb',
                          color: 'white',
                          fontSize: '11px',
                          fontWeight: '700',
                          cursor: 'pointer'
                        }}
                      >
                        {sched.club_icon ? `${sched.club_icon} ` : ''}{sched.club_name}
                      </span>
                      {isImminent && (
                        <span className="badge" style={{ background: '#fef3c7', color: '#b45309', border: '1px solid #fde68a', fontSize: '10.5px', fontWeight: '800' }}>
                          ⚡ 가장 임박
                        </span>
                      )}
                    </div>
                    <span style={{ fontSize: '12px', color: isImminent ? '#1e40af' : 'var(--color-text-muted)', fontWeight: '700' }}>
                      👥 {sched.attendees_count}명 참석 신청
                    </span>
                  </div>

                  {/* 본문: 좌측 정보 영역 (클릭 시 모영 진입) + 우측 버튼 2개 [바로가기] / [참석하기] */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                    {/* 좌측 정보 영역 (화면의 절반 이상, 탭/클릭 시 모영 진입) */}
                    <div
                      onClick={() => handleClubScheduleClick(sched.club_id)}
                      role="button"
                      tabIndex={0}
                      title="클릭 시 모영 일정으로 이동합니다"
                      style={{
                        flex: 1,
                        minWidth: 0,
                        cursor: 'pointer',
                        padding: '4px 6px 4px 0',
                        borderRadius: '6px',
                        transition: 'opacity 0.15s ease'
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.82')}
                      onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
                    >
                      <h4 style={{ fontSize: '15px', fontWeight: '800', color: isImminent ? '#1e3a8a' : 'var(--color-text-main)', marginBottom: '6px', lineHeight: 1.35 }}>
                        {sched.title}
                      </h4>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', color: 'var(--color-text-muted)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <Clock size={13} color={isImminent ? '#2563eb' : '#64748b'} />
                          <span style={{ fontWeight: '600', color: isImminent ? '#1e40af' : 'var(--color-text-main)' }}>
                            {sched.event_date}
                          </span>
                        </div>
                        {sched.location && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <MapPin size={13} color="#64748b" />
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sched.location}</span>
                          </div>
                        )}
                        {sched.fee_info && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <span style={{ fontSize: '11px' }}>💰</span>
                            <span>회비: {sched.fee_info}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* 우측 수직 버튼 2개: [바로가기], [참석하기/참석취소] */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flexShrink: 0, width: '90px' }}>
                      {/* 1. 바로가기 버튼 */}
                      <button
                        type="button"
                        onClick={() => handleClubScheduleClick(sched.club_id)}
                        className="btn btn-sm"
                        style={{
                          background: '#ffffff',
                          color: '#2563eb',
                          border: '1.5px solid #bfdbfe',
                          padding: '6px 0',
                          fontSize: '11.5px',
                          fontWeight: '700',
                          borderRadius: '8px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '3px',
                          width: '100%',
                          boxShadow: 'var(--shadow-xs)'
                        }}
                      >
                        <span>바로가기</span>
                        <ArrowRight size={12} />
                      </button>

                      {/* 2. 참석하기 / 참석취소 버튼 */}
                      <button
                        type="button"
                        disabled={loadingAttendId === sched.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAttendButtonClick(sched);
                        }}
                        className="btn btn-sm"
                        style={{
                          background: sched.is_attending ? '#fef2f2' : '#2563eb',
                          color: sched.is_attending ? '#dc2626' : '#ffffff',
                          border: sched.is_attending ? '1.5px solid #f87171' : '1.5px solid #1d4ed8',
                          padding: '7px 0',
                          fontSize: '11.5px',
                          fontWeight: '800',
                          borderRadius: '8px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '3px',
                          width: '100%',
                          boxShadow: sched.is_attending ? 'none' : '0 2px 4px rgba(37,99,235,0.25)',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        {loadingAttendId === sched.id ? (
                          <span style={{ fontSize: '11px' }}>처리 중...</span>
                        ) : sched.is_attending ? (
                          <>
                            <Check size={12} />
                            <span>참석취소</span>
                          </>
                        ) : (
                          <>
                            <span>참석하기</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 6. Clubs Section */}
      <div id="clubs-section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: '800', color: 'var(--color-text-main)' }}>
            우리교회 모영 목록 ({clubs.length}개)
          </h3>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {loading && clubs.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 16px', gap: '10px', color: 'var(--color-text-muted)' }}>
              <RefreshCw size={24} className="animate-spin" style={{ color: 'var(--color-primary)' }} />
              <span style={{ fontSize: '13px', fontWeight: '500' }}>모영 목록을 빠르게 불러오는 중...</span>
            </div>
          ) : clubs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '30px 16px', color: 'var(--color-text-muted)', fontSize: '13px' }}>
              등록된 모영이 없습니다.
            </div>
          ) : (
            clubs.map((club) => (
            <div
              key={club.id}
              className="card"
              style={{
                cursor: 'pointer',
                transition: 'var(--transition)',
                display: 'flex',
                alignItems: 'center',
                gap: '14px',
                padding: '14px 16px'
              }}
              onClick={() => handleClubClick(club)}
              onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)')}
              onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.transform = 'translateY(0)')}
            >
              {/* Club Emoji Icon */}
              <div style={{
                width: '46px',
                height: '46px',
                borderRadius: 'var(--radius-md)',
                background: 'var(--color-card-subtle)',
                fontSize: '24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                border: '1px solid var(--color-border)'
              }}>
                {club.icon}
              </div>

              {/* Club Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                  <h4 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--color-text-main)' }}>
                    {club.name}
                  </h4>
                </div>

                <p style={{
                  fontSize: '12.5px',
                  color: 'var(--color-text-muted)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  lineHeight: 1.4,
                  margin: 0
                }}>
                  {club.description}
                </p>
              </div>

              {/* Arrow */}
              <div style={{ color: 'var(--color-text-light)' }}>
                <ArrowRight size={18} />
              </div>
            </div>
          )))}
        </div>
      </div>

      {/* Login & Guest Auth Modal on Lobby Attendance Click */}
      {showAuthModal && (
        <div
          className="modal-overlay"
          style={{
            zIndex: 1000,
            background: 'rgba(0, 0, 0, 0.72)',
            backdropFilter: 'blur(5px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}
          onClick={() => {
            setShowAuthModal(false);
            setPendingSchedForGuest(null);
          }}
        >
          <div
            className="animate-scale-in"
            style={{
              maxWidth: '360px',
              width: '100%',
              padding: '24px 22px',
              background: '#0f172a',
              color: '#ffffff',
              borderRadius: '16px',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.6)',
              border: '1px solid #1e293b',
              position: 'relative',
              boxSizing: 'border-box'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              type="button"
              onClick={() => {
                setShowAuthModal(false);
                setPendingSchedForGuest(null);
              }}
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                background: 'none',
                border: 'none',
                color: '#94a3b8',
                cursor: 'pointer',
                padding: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <X size={18} />
            </button>

            {authModalMode === 'member' ? (
              <>
                <div style={{ textAlign: 'center', marginBottom: '18px' }}>
                  <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#ffffff', margin: '0 0 4px 0' }}>
                    로그인
                  </h3>
                  <p style={{ fontSize: '12px', color: '#94a3b8', margin: 0 }}>
                    모임 참석 신청을 위해 로그인해주세요.
                  </p>
                </div>

                {loginError && (
                  <div style={{
                    padding: '8px 12px',
                    background: 'rgba(239, 68, 68, 0.15)',
                    color: '#f87171',
                    borderRadius: '8px',
                    fontSize: '12px',
                    marginBottom: '14px',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    lineHeight: 1.4
                  }}>
                    {loginError}
                  </div>
                )}

                <form onSubmit={handleMemberLoginSubmit}>
                  <div className="form-group" style={{ marginBottom: '14px' }}>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#ffffff', marginBottom: '6px' }}>
                      아이디
                    </label>
                    <input
                      type="text"
                      inputMode="url"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      className="form-input"
                      style={{
                        background: '#ffffff',
                        border: '1px solid #cbd5e1',
                        color: '#0f172a',
                        fontWeight: '500',
                        fontSize: '14px',
                        padding: '10px 12px',
                        borderRadius: '8px',
                        width: '100%',
                        boxSizing: 'border-box'
                      }}
                      placeholder="아이디를 입력하세요"
                      value={loginUsername}
                      onChange={(e) => setLoginUsername(e.target.value)}
                      autoFocus
                      required
                    />
                  </div>

                  <div className="form-group" style={{ marginBottom: '18px' }}>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#ffffff', marginBottom: '6px' }}>
                      이름 (실명)
                    </label>
                    <input
                      type="text"
                      inputMode="text"
                      spellCheck={false}
                      className="form-input"
                      style={{
                        background: '#ffffff',
                        border: '1px solid #cbd5e1',
                        color: '#0f172a',
                        fontWeight: '500',
                        fontSize: '14px',
                        padding: '10px 12px',
                        borderRadius: '8px',
                        width: '100%',
                        boxSizing: 'border-box'
                      }}
                      placeholder="성도 이름 입력 (예: 홍길동)"
                      value={loginName}
                      onChange={(e) => setLoginName(e.target.value)}
                      required
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
                    <button
                      type="button"
                      onClick={() => {
                        setShowAuthModal(false);
                        setPendingSchedForGuest(null);
                      }}
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
                      disabled={loginLoading}
                      className="btn btn-primary"
                      style={{
                        padding: '10px',
                        fontWeight: '700',
                        fontSize: '13.5px',
                        borderRadius: '8px'
                      }}
                    >
                      {loginLoading ? '확인 중...' : '로그인'}
                    </button>
                  </div>
                </form>

                {/* Divider & Guest Login Button */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  margin: '14px 0 12px',
                  color: '#64748b',
                  fontSize: '11.5px'
                }}>
                  <div style={{ flex: 1, height: '1px', background: '#334155' }} />
                  <span style={{ padding: '0 8px' }}>또는</span>
                  <div style={{ flex: 1, height: '1px', background: '#334155' }} />
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setAuthModalMode('guest');
                    setGuestError('');
                  }}
                  className="btn btn-block"
                  style={{
                    width: '100%',
                    padding: '10px',
                    background: '#1e293b',
                    color: '#f8fafc',
                    border: '1px solid #475569',
                    borderRadius: '8px',
                    fontWeight: '700',
                    fontSize: '13px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px'
                  }}
                >
                  <UserIcon size={14} />
                  <span>게스트로 로그인</span>
                </button>

                <div style={{ textAlign: 'center', marginTop: '12px' }}>
                  <span style={{ fontSize: '11.5px', color: '#94a3b8' }}>
                    아직 회원이 아니신가요?{' '}
                    <button
                      type="button"
                      onClick={() => {
                        setShowAuthModal(false);
                        onRequireLogin?.();
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#60a5fa',
                        fontWeight: '700',
                        cursor: 'pointer',
                        fontSize: '11.5px',
                        padding: 0,
                        textDecoration: 'underline'
                      }}
                    >
                      회원가입
                    </button>
                  </span>
                </div>
              </>
            ) : (
              <>
                <div style={{ textAlign: 'center', marginBottom: '18px' }}>
                  <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#ffffff', margin: '0 0 4px 0' }}>
                    게스트 참석
                  </h3>
                  <p style={{ fontSize: '12px', color: '#94a3b8', margin: 0 }}>
                    성도 계정이 없으신 경우 게스트로 참석할 수 있습니다.
                  </p>
                </div>

                {guestError && (
                  <div style={{
                    padding: '8px 12px',
                    background: 'rgba(239, 68, 68, 0.15)',
                    color: '#f87171',
                    borderRadius: '8px',
                    fontSize: '12px',
                    marginBottom: '14px',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    lineHeight: 1.4
                  }}>
                    {guestError}
                  </div>
                )}

                <form onSubmit={handleGuestModalSubmit}>
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
                        borderRadius: '8px',
                        width: '100%',
                        boxSizing: 'border-box'
                      }}
                      placeholder="이름 입력"
                      value={guestName}
                      onChange={(e) => setGuestName(e.target.value)}
                      autoFocus
                      required
                    />
                  </div>

                  <div className="form-group" style={{ marginBottom: '18px' }}>
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
                        borderRadius: '8px',
                        width: '100%',
                        boxSizing: 'border-box'
                      }}
                      placeholder="지인 이름 입력"
                      value={guestAcquaintance}
                      onChange={(e) => setGuestAcquaintance(e.target.value)}
                      required
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
                    <button
                      type="button"
                      onClick={() => {
                        setShowAuthModal(false);
                        setPendingSchedForGuest(null);
                      }}
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
                      {guestLoading ? '등록 중...' : '참석하기'}
                    </button>
                  </div>
                </form>

                <div style={{ textAlign: 'center', marginTop: '10px' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setAuthModalMode('member');
                      setLoginError('');
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#94a3b8',
                      fontSize: '12.5px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      padding: '6px 10px',
                      textDecoration: 'underline'
                    }}
                  >
                    ← 성도 로그인으로 돌아가기
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
