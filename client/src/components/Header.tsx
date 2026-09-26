import React from 'react';
import { User } from '../types';
import { Server, LogOut, Settings, User as UserIcon } from 'lucide-react';

interface HeaderProps {
  user: User | null;
  currentPage: string;
  onNavigate: (page: string) => void;
  onLogout: () => void;
  onOpenMyInfo: () => void;
}

export const Header: React.FC<HeaderProps> = ({ user, currentPage, onNavigate, onLogout, onOpenMyInfo }) => {
  if (!user) {
    return (
      <header className="app-header">
        <div 
          className="app-brand" 
          style={{ cursor: 'pointer' }} 
          onClick={() => onNavigate('lobby')}
          title="로비로 이동"
        >
          <div className="brand-icon">모</div>
          <div>
            <div style={{ fontSize: '16px', fontWeight: '900', lineHeight: 1.1, color: '#1e3a8a' }}>모영</div>
            <div style={{ fontSize: '10.5px', color: 'var(--color-primary)', fontWeight: '700' }}>둔산제일교회</div>
          </div>
        </div>

        <div className="header-actions">
          <button
            className="btn btn-sm btn-primary"
            onClick={() => onNavigate('login')}
            style={{
              padding: '6px 14px',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: '700',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            로그인
          </button>
        </div>
      </header>
    );
  }

  return (
    <header className="app-header">
      <div 
        className="app-brand" 
        style={{ cursor: 'pointer' }} 
        onClick={() => onNavigate('lobby')}
        title="로비로 이동"
      >
        <div className="brand-icon">모</div>
        <div>
          <div style={{ fontSize: '16px', fontWeight: '900', lineHeight: 1.1, color: '#1e3a8a' }}>모영</div>
          <div style={{ fontSize: '10.5px', color: 'var(--color-primary)', fontWeight: '700' }}>둔산제일교회</div>
        </div>
      </div>

      <div className="header-actions">
        {/* User Badge (Display only - not clickable) */}
        <div 
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', cursor: 'default' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px' }}>
            <span style={{ fontWeight: '800', color: 'var(--color-text-main)', textAlign: 'center', lineHeight: 1.15 }}>
              {user.name}
            </span>
            <span style={{ color: 'var(--color-text-light)', fontSize: '11px', whiteSpace: 'nowrap' }}>({user.cell_name})</span>
          </div>
          
          <div style={{ display: 'flex', gap: '4px' }}>
            {user.role === 'server_admin' && (
              <span className="badge badge-server" style={{ padding: '2px 6px', fontSize: '10px', whiteSpace: 'nowrap' }}>서버관리자</span>
            )}
            {user.role === 'head_admin' && (
              <span className="badge badge-admin" style={{ padding: '2px 6px', fontSize: '10px', whiteSpace: 'nowrap' }}>전체 관리자</span>
            )}
            {user.role === 'media_admin' && (
              <span className="badge" style={{ background: '#ede9fe', color: '#6d28d9', border: '1px solid #ddd6fe', padding: '2px 6px', fontSize: '10px', whiteSpace: 'nowrap' }}>미디어관리자</span>
            )}
            {user.role === 'guest' && (
              <span className="badge" style={{ background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', padding: '2px 6px', fontSize: '10px', fontWeight: '800', whiteSpace: 'nowrap' }}>게스트</span>
            )}
            {user.role === 'member' && user.leader_clubs && user.leader_clubs.length > 0 && (
              <span className="badge" style={{ background: '#0f172a', color: '#ffffff', fontSize: '10px', padding: '2px 6px', borderRadius: '8px', fontWeight: '800', whiteSpace: 'nowrap' }}>
                {user.leader_clubs[0]} 총무
              </span>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {/* My Info (Hidden for Guest) */}
          {user.role !== 'guest' && (
            <button
              className="btn btn-sm btn-secondary"
              onClick={onOpenMyInfo}
              title="내 정보 및 소속 셀 변경"
              style={{
                padding: '5px 8px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px',
                fontSize: '11.5px',
                fontWeight: '700',
                background: '#f8fafc',
                border: '1px solid var(--color-border)',
                whiteSpace: 'nowrap'
              }}
            >
              <UserIcon size={14} color="var(--color-primary)" />
              <span>내 정보</span>
            </button>
          )}

          {/* Head Admin & Media Admin Button */}
          {(user.role === 'head_admin' || user.role === 'media_admin') && (
            <button
              className={`btn btn-sm ${currentPage === 'head-admin' ? 'btn-secondary' : 'btn-admin'}`}
              onClick={() => onNavigate(currentPage === 'head-admin' ? 'lobby' : 'head-admin')}
              title="관리 창"
              style={{ padding: '5px 10px', borderRadius: '8px', whiteSpace: 'nowrap' }}
            >
              <Settings size={14} />
              <span>{currentPage === 'head-admin' ? '로비로' : '관리'}</span>
            </button>
          )}

          {/* Server Admin Button */}
          {user.role === 'server_admin' && (
            <button
              className={`btn btn-sm ${currentPage === 'server-admin' ? 'btn-secondary' : 'btn-primary'}`}
              onClick={() => onNavigate(currentPage === 'server-admin' ? 'lobby' : 'server-admin')}
              style={{ padding: '5px 9px', borderRadius: '8px', whiteSpace: 'nowrap' }}
            >
              <Server size={14} />
              <span>{currentPage === 'server-admin' ? '로비' : '서버창'}</span>
            </button>
          )}
        </div>

        {/* Logout Button */}
        <button
          className="btn btn-sm btn-secondary"
          onClick={onLogout}
          title="로그아웃"
          style={{ padding: '6px 8px', color: 'var(--color-text-muted)', border: 'none', background: 'transparent' }}
        >
          <LogOut size={16} />
        </button>
      </div>
    </header>
  );
};
