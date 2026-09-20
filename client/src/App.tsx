import React, { useState, useEffect } from 'react';
import { User, UserRole } from './types';
import { Header } from './components/Header';
import { QuickSwitch } from './components/QuickSwitch';
import { LoginPage } from './pages/LoginPage';
import { LobbyPage } from './pages/LobbyPage';
import { ServerAdminPage } from './pages/ServerAdminPage';
import { HeadAdminPage } from './pages/HeadAdminPage';
import { ClubDetailPage } from './pages/ClubDetailPage';

export function App() {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('dfmc_token'));
  const [currentPage, setCurrentPage] = useState<string>('login');
  const [selectedClubId, setSelectedClubId] = useState<number | null>(null);
  const [selectedClubTab, setSelectedClubTab] = useState<'polls' | 'posts' | 'schedules' | 'photos'>('polls');
  const [loading, setLoading] = useState<boolean>(true);

  // Restore authenticated session
  useEffect(() => {
    const savedToken = localStorage.getItem('dfmc_token');
    if (savedToken) {
      fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${savedToken}` },
      })
        .then((res) => {
          if (res.ok) return res.json();
          throw new Error('Invalid session');
        })
        .then((data) => {
          setUser(data.user);
          setToken(savedToken);
          if (data.user.role === 'server_admin') {
            setCurrentPage('server-admin');
          } else {
            setCurrentPage('lobby');
          }
        })
        .catch(() => {
          localStorage.removeItem('dfmc_token');
          setUser(null);
          setToken(null);
          setCurrentPage('login');
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
      setCurrentPage('login');
    }
  }, []);

  const handleLoginSuccess = (newUser: User, newToken: string) => {
    setUser(newUser);
    setToken(newToken);
    if (newUser.role === 'server_admin') {
      setCurrentPage('server-admin');
    } else {
      setCurrentPage('lobby');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('dfmc_token');
    setUser(null);
    setToken(null);
    setCurrentPage('login');
  };

  const handleQuickSwitch = async (role: UserRole) => {
    try {
      const res = await fetch('/api/auth/quick-switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetRole: role }),
      });

      const data = await res.json();
      if (res.ok) {
        localStorage.setItem('dfmc_token', data.token);
        setUser(data.user);
        setToken(data.token);

        if (data.user.role === 'server_admin') {
          setCurrentPage('server-admin');
        } else if (data.user.role === 'head_admin') {
          setCurrentPage('lobby');
        } else {
          setCurrentPage('lobby');
        }
      }
    } catch (err) {
      console.error('Quick switch failed:', err);
    }
  };

  const handleUpdateUser = (updated: Partial<User>) => {
    if (user) {
      setUser({ ...user, ...updated });
    }
  };

  const handleNavigateClub = (clubId: number, initialTab: 'polls' | 'posts' | 'schedules' | 'photos' = 'polls') => {
    setSelectedClubId(clubId);
    setSelectedClubTab(initialTab);
    setCurrentPage('club-detail');
  };

  if (loading) {
    return (
      <div style={{
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f8fafc',
        color: '#64748b',
        fontSize: '14px',
        fontWeight: '600'
      }}>
        둔산제일교회 모영 로딩 중...
      </div>
    );
  }

  const isServerAdminView = currentPage === 'server-admin';

  return (
    <div className={`app-container ${isServerAdminView ? 'full-width' : ''}`}>
      {/* Top Header for non-server-admin full pages or server admin toggle */}
      {user && currentPage !== 'login' && (
        <Header
          user={user}
          currentPage={currentPage}
          onNavigate={(page) => setCurrentPage(page)}
          onLogout={handleLogout}
        />
      )}

      {/* Main Page Routing */}
      <main style={{ flex: 1 }}>
        {!user || currentPage === 'login' ? (
          <LoginPage onLoginSuccess={handleLoginSuccess} />
        ) : currentPage === 'server-admin' ? (
          <ServerAdminPage onNavigateLobby={() => setCurrentPage('lobby')} />
        ) : currentPage === 'head-admin' ? (
          <HeadAdminPage user={user} onBackToLobby={() => setCurrentPage('lobby')} />
        ) : currentPage === 'club-detail' && selectedClubId ? (
          <ClubDetailPage
            clubId={selectedClubId}
            user={user}
            initialTab={selectedClubTab}
            onBackToLobby={() => setCurrentPage('lobby')}
          />
        ) : (
          <LobbyPage
            user={user}
            onUpdateUser={handleUpdateUser}
            onNavigateClub={handleNavigateClub}
          />
        )}
      </main>

      {/* Dev Quick Switch Bar */}
      <QuickSwitch currentRole={user?.role} onSwitch={handleQuickSwitch} />
    </div>
  );
}

export default App;
