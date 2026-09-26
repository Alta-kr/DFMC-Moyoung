import React from 'react';
import { Home, Users, Calendar, Shield, LogIn } from 'lucide-react';
import { User } from '../types';

interface MobileBottomNavProps {
  currentPage: string;
  user: User | null;
  onNavigate: (page: string) => void;
  onOpenClubs?: () => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  currentPage,
  user,
  onNavigate,
  onOpenClubs,
}) => {
  const isAdmin = user && (user.role === 'head_admin' || user.role === 'media_admin');
  const isServerAdmin = user && user.role === 'server_admin';

  return (
    <nav className="mobile-bottom-nav">
      {/* 1. Lobby */}
      <button
        type="button"
        className={`bottom-nav-item ${currentPage === 'lobby' ? 'active' : ''}`}
        onClick={() => onNavigate('lobby')}
      >
        <Home size={19} />
        <span>로비</span>
      </button>

      {/* 2. Moyoung (Clubs) */}
      <button
        type="button"
        className={`bottom-nav-item ${currentPage === 'club-detail' ? 'active' : ''}`}
        onClick={() => {
          if (onOpenClubs) {
            onOpenClubs();
          } else {
            onNavigate('lobby');
            setTimeout(() => {
              const el = document.getElementById('clubs-section');
              if (el) el.scrollIntoView({ behavior: 'smooth' });
            }, 100);
          }
        }}
      >
        <Users size={19} />
        <span>모영</span>
      </button>

      {/* 3. Schedules (Quick schedule access) */}
      <button
        type="button"
        className="bottom-nav-item"
        onClick={() => {
          onNavigate('lobby');
          setTimeout(() => {
            const el = document.getElementById('active-schedules-section');
            if (el) el.scrollIntoView({ behavior: 'smooth' });
          }, 100);
        }}
      >
        <Calendar size={19} />
        <span>일정</span>
      </button>

      {/* 4. Login, Guest, Admin, or My Info */}
      {!user ? (
        <button
          type="button"
          className={`bottom-nav-item ${currentPage === 'login' ? 'active' : ''}`}
          onClick={() => onNavigate('login')}
        >
          <LogIn size={19} />
          <span>로그인</span>
        </button>
      ) : user.role === 'guest' ? (
        <button
          type="button"
          className="bottom-nav-item"
          onClick={() => {
            alert('게스트 모드 입니다.');
          }}
        >
          <Shield size={19} />
          <span>게스트</span>
        </button>
      ) : isAdmin || isServerAdmin ? (
        <button
          type="button"
          className={`bottom-nav-item ${currentPage === 'head-admin' || currentPage === 'server-admin' ? 'active' : ''}`}
          onClick={() => onNavigate(isServerAdmin ? 'server-admin' : 'head-admin')}
        >
          <Shield size={19} />
          <span>관리</span>
        </button>
      ) : (
        <button
          type="button"
          className="bottom-nav-item"
          onClick={() => {
            alert(`[${user.name}] 성도님\n소속: ${user.cell_name}\n권한: 일반 성도\n\n원하시는 모든 모영에 자유롭게 방문하여 투표 및 소통에 참여하실 수 있습니다. 🙏`);
          }}
        >
          <Shield size={19} />
          <span>내 정보</span>
        </button>
      )}
    </nav>
  );
};
