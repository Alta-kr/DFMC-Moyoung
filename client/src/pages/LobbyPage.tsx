import React, { useState, useEffect } from 'react';
import { User, Club, Notice, PollHighlight, PopupItem, CellItem, WelcomeSettings } from '../types';
import { PopupModal } from '../components/PopupModal';
import { CellUpdateModal } from '../components/CellUpdateModal';
import { Megaphone, Flame, Users, Calendar, ArrowRight, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';

interface LobbyPageProps {
  user: User;
  onUpdateUser: (updated: Partial<User>) => void;
  onNavigateClub: (clubId: number, initialTab?: 'talk' | 'polls' | 'posts' | 'schedules' | 'photos') => void;
}

export const LobbyPage: React.FC<LobbyPageProps> = ({ user, onUpdateUser, onNavigateClub }) => {
  const [notice, setNotice] = useState<Notice | null>(null);
  const [polls, setPolls] = useState<PollHighlight[]>([]);
  const [clubs, setClubs] = useState<Club[]>([]);
  const [popup, setPopup] = useState<PopupItem | null>(null);
  const [cells, setCells] = useState<CellItem[]>([]);
  const [welcome, setWelcome] = useState<WelcomeSettings | null>(null);
  const [showPopup, setShowPopup] = useState(false);
  const [noticeExpanded, setNoticeExpanded] = useState(false);
  const [loading, setLoading] = useState(true);

  // Fetch lobby data
  useEffect(() => {
    fetch('/api/lobby/data')
      .then((res) => res.json())
      .then((data) => {
        setNotice(data.notice || null);
        setPolls(data.polls || (data.pollHighlight ? [data.pollHighlight] : []));
        setClubs(data.clubs || []);
        setCells(data.cells || []);
        setWelcome(data.welcome || null);

        // Check if popup should show
        if (data.popup) {
          setPopup(data.popup);
          const hideDate = localStorage.getItem('dfmc_hide_popup_date');
          const todayStr = new Date().toISOString().split('T')[0];
          if (hideDate !== todayStr) {
            setShowPopup(true);
          }
        }
      })
      .catch((err) => console.error('Failed to load lobby data:', err))
      .finally(() => setLoading(false));
  }, []);

  const handleClubClick = (club: Club) => {
    onNavigateClub(club.id, 'talk');
  };

  return (
    <div style={{ padding: '16px 16px 80px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* 1. Cell Update Modal (Only for regular members if reorganized) */}
      {user.role === 'member' && user.cell_verified === 0 && (
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', opacity: 0.9, marginBottom: '4px' }}>
            <Sparkles size={14} color="#fde047" />
            <span>{welcome?.welcome_tagline || '은혜와 교제가 넘치는 둔산제일교회 모영'}</span>
          </div>
          <h2 style={{ fontSize: '18px', fontWeight: '800' }}>
            환영합니다, {user.name}님! 🙏
          </h2>
          <p style={{ fontSize: '12.5px', opacity: 0.85, marginTop: '2px' }}>
            소속 셀: <strong>{user.cell_name}</strong> | {welcome?.welcome_message || '이번 주에도 모영에서 기쁨의 교제 함께해요.'}
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
                <span className="badge badge-admin" style={{ fontSize: '10px', padding: '2px 6px', marginBottom: '3px' }}>
                  교회 전체 공지
                </span>
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

      {/* 5. Highlight Polls Section ("🔥 지금 투표 진행 중인 모영" - 마감 임박순 정렬) */}
      {polls.length > 0 && (
        <div id="active-polls-section" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Flame size={18} color="#ea580c" />
              <h3 style={{ fontSize: '15px', fontWeight: '800', color: '#c2410c' }}>
                지금 투표 진행 중인 모영 ({polls.length}개)
              </h3>
            </div>
            <span style={{ fontSize: '11px', color: '#9a3412', fontWeight: '600' }}>
              마감 임박순
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {polls.map((poll, idx) => {
              const deadline = new Date(poll.end_date);
              const isImminent = idx === 0;

              return (
                <div
                  key={poll.id}
                  className="card"
                  style={{
                    background: isImminent ? 'linear-gradient(to right, #fff7ed, #ffedd5)' : '#ffffff',
                    border: isImminent ? '1.5px solid #fed7aa' : '1px solid var(--color-border)',
                    boxShadow: 'var(--shadow-sm)',
                    padding: '14px 16px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span className="badge" style={{ background: isImminent ? '#ea580c' : '#2563eb', color: 'white', fontSize: '11px', fontWeight: '700' }}>
                        {poll.club_name}
                      </span>
                      {isImminent && (
                        <span className="badge" style={{ background: '#fef3c7', color: '#b45309', border: '1px solid #fde68a', fontSize: '10.5px', fontWeight: '800' }}>
                          ⚡ 마감 임박
                        </span>
                      )}
                    </div>
                    <span style={{ fontSize: '11.5px', color: isImminent ? '#9a3412' : 'var(--color-text-muted)', fontWeight: '600' }}>
                      👥 {poll.voters_count}명 참여 중
                    </span>
                  </div>

                  <h4 style={{ fontSize: '14px', fontWeight: '700', color: isImminent ? '#7c2d12' : 'var(--color-text-main)', marginBottom: '10px', lineHeight: 1.4 }}>
                    {poll.poll_title}
                  </h4>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '11.5px', color: isImminent ? '#9a3412' : 'var(--color-text-muted)' }}>
                      마감: {deadline.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })} {deadline.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <button
                      onClick={() => onNavigateClub(poll.club_id, 'polls')}
                      className="btn btn-sm"
                      style={{
                        background: isImminent ? '#ea580c' : 'var(--color-primary)',
                        color: 'white',
                        padding: '5px 12px',
                        fontSize: '11.5px',
                        fontWeight: '700',
                        borderRadius: '6px'
                      }}
                    >
                      투표 참여하기
                      <ArrowRight size={12} />
                    </button>
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
          <span style={{ fontSize: '12px', color: 'var(--color-text-light)' }}>
            상세/채팅방 입장
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {clubs.map((club) => (
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
                  lineHeight: 1.4
                }}>
                  {club.description}
                </p>

                <div style={{ fontSize: '11px', color: 'var(--color-text-light)', marginTop: '4px' }}>
                  총무: <span style={{ color: 'var(--color-text-main)', fontWeight: '600' }}>{club.manager_names || '미지정'}</span>
                </div>
              </div>

              {/* Arrow */}
              <div style={{ color: 'var(--color-text-light)' }}>
                <ArrowRight size={18} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
