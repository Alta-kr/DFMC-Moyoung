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
  if (!user) return null;

  return (
    <header className="app-header">
      <div 
        className="app-brand" 
        style={{ cursor: 'pointer' }} 
        onClick={() => onNavigate(user.role === 'server_admin' ? 'server-admin' : 'lobby')}
      >
        <div className="brand-icon">모</div>
        <div>
          <div style={{ fontSize: '16px', fontWeight: '900', lineHeight: 1.1, color: '#1e3a8a' }}>모영</div>
          <div style={{ fontSize: '10.5px', color: 'var(--color-primary)', fontWeight: '700' }}>둔산제일교회</div>
        </div>
      </div>

      <div className="header-actions">
        {/* User Badge (Clickable to open My Info) */}
        <div 
          onClick={onOpenMyInfo}
          style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', cursor: 'pointer' }}
          title="클릭하여 내 정보 및 소속 셀 변경"
        >
          <span style={{ fontWeight: '700', color: 'var(--color-text-main)' }}>{user.name}</span>
          <span style={{ color: 'var(--color-text-light)', fontSize: '11px' }}>({user.cell_name})</span>
          
          {user.role === 'server_admin' && (
            <span className="badge badge-server">서버관리자</span>
          )}
          {user.role === 'head_admin' && (
            <span className="badge badge-admin">전체 관리자</span>
          )}
          {user.role === 'media_admin' && (
            <span className="badge" style={{ background: '#ede9fe', color: '#6d28d9', border: '1px solid #ddd6fe' }}>미디어관리자</span>
          )}
        </div>

        {/* My Info Button */}
        <button
          className="btn btn-sm btn-secondary"
          onClick={onOpenMyInfo}
          title="내 정보 및 소속 셀 변경"
          style={{
            padding: '5px 8px',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: '11.5px',
            fontWeight: '700',
            background: '#f8fafc',
            border: '1px solid var(--color-border)'
          }}
        >
          <UserIcon size={14} color="var(--color-primary)" />
          <span>내 정보</span>
        </button>

        {/* Head Admin & Media Admin Button */}
        {(user.role === 'head_admin' || user.role === 'media_admin') && (
          <button
            className={`btn btn-sm ${currentPage === 'head-admin' ? 'btn-secondary' : 'btn-admin'}`}
            onClick={() => onNavigate(currentPage === 'head-admin' ? 'lobby' : 'head-admin')}
            title="관리 창"
            style={{ padding: '5px 10px', borderRadius: '8px' }}
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
            style={{ padding: '5px 9px', borderRadius: '8px' }}
          >
            <Server size={14} />
            <span>{currentPage === 'server-admin' ? '로비' : '서버창'}</span>
          </button>
        )}

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
