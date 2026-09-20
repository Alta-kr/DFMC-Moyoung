import React from 'react';
import { Home, Users, Vote, Shield } from 'lucide-react';
import { User } from '../types';

interface MobileBottomNavProps {
  currentPage: string;
  user: User;
  onNavigate: (page: string) => void;
  onOpenClubs?: () => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  currentPage,
  user,
  onNavigate,
  onOpenClubs,
}) => {
  const isAdmin = user.role === 'head_admin' || user.role === 'media_admin';
  const isServerAdmin = user.role === 'server_admin';

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

      {/* 3. Votes (Quick poll access) */}
      <button
        type="button"
        className="bottom-nav-item"
        onClick={() => {
          onNavigate('lobby');
          setTimeout(() => {
            const el = document.getElementById('active-polls-section');
            if (el) el.scrollIntoView({ behavior: 'smooth' });
          }, 100);
        }}
      >
        <Vote size={19} />
        <span>투표</span>
      </button>

      {/* 4. Admin / Management or My Info */}
      {isAdmin || isServerAdmin ? (
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
