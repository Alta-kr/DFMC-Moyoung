import { clearAccountCaches } from './firebase/accountCache';
import React, { useState, useEffect, useRef } from 'react';
import { User, UserRole } from './types';
import { Header } from './components/Header';
import { MyInfoModal } from './components/MyInfoModal';
import { LoginPage } from './pages/LoginPage';
import { LobbyPage } from './pages/LobbyPage';
import { ServerAdminPage } from './pages/ServerAdminPage';
import { HeadAdminPage } from './pages/HeadAdminPage';
import { ClubDetailPage } from './pages/ClubDetailPage';

interface RouteState {
  page: 'login' | 'lobby' | 'club-detail' | 'head-admin' | 'server-admin';
  clubId?: number | null;
  clubTab?: 'talk' | 'polls' | 'posts' | 'schedules' | 'photos';
  modal?: string | null;
}

const parseRouteFromUrl = (): { page: string; clubId: number | null; tab: 'talk' | 'polls' | 'posts' | 'schedules' | 'photos' } => {
  const params = new URLSearchParams(window.location.search);
  const clubParam = params.get('club');
  const clubId = clubParam ? Number(clubParam) : null;
  const pageParam = params.get('page');
  const tabParam = params.get('tab');
  const validTabs = ['talk', 'polls', 'posts', 'schedules', 'photos'];
  const tab = validTabs.includes(tabParam || '') ? (tabParam as any) : 'talk';

  if (clubId && !isNaN(clubId)) {
    return { page: 'club-detail', clubId, tab };
  }
  if (pageParam === 'head-admin' || pageParam === 'server-admin') {
    return { page: pageParam, clubId: null, tab: 'talk' };
  }
  return { page: 'lobby', clubId: null, tab: 'talk' };
};

const buildUrl = (page: string, clubId?: number | null, tab?: string): string => {
  const pathname = window.location.pathname;
  if (page === 'club-detail' && clubId) {
    return `${pathname}?club=${clubId}${tab && tab !== 'talk' ? `&tab=${tab}` : ''}`;
  }
  if (page === 'head-admin') {
    return `${pathname}?page=head-admin`;
  }
  if (page === 'server-admin') {
    return `${pathname}?page=server-admin`;
  }
  return pathname;
};

export function App() {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const savedUser = localStorage.getItem('dfmc_user');
      return savedUser ? JSON.parse(savedUser) : null;
    } catch {
      return null;
    }
  });
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('dfmc_token'));
  
  // URL 파싱으로 초기 페이지 즉각 결정 (디폴트: lobby)
  const initialRoute = useRef(parseRouteFromUrl());
  const [currentPage, setCurrentPage] = useState<string>(() => initialRoute.current.page || 'lobby');
  const [selectedClubId, setSelectedClubId] = useState<number | null>(() => initialRoute.current.clubId || null);
  const [selectedClubTab, setSelectedClubTab] = useState<'talk' | 'polls' | 'posts' | 'schedules' | 'photos'>(
    () => initialRoute.current.tab || 'talk'
  );
  const [showMyInfoModal, setShowMyInfoModal] = useState<boolean>(false);

  // References to access latest values in popstate callback
  const userRef = useRef(user);
  userRef.current = user;
  const currentPageRef = useRef(currentPage);
  currentPageRef.current = currentPage;
  const showMyInfoModalRef = useRef(showMyInfoModal);
  showMyInfoModalRef.current = showMyInfoModal;

  // popstate (Browser / Smartphone Hardware Back Button) listener
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      const state = event.state as RouteState | null;

      // 1. If "My Info" modal is open, close modal only
      if (showMyInfoModalRef.current) {
        setShowMyInfoModal(false);
        if (state && !state.modal && state.page === currentPageRef.current) {
          return;
        }
      }

      // 2. Synchronize view according to history state
      if (state && state.page) {
        if (state.page === 'club-detail' && state.clubId) {
          setSelectedClubId(state.clubId);
          if (state.clubTab) setSelectedClubTab(state.clubTab);
          setCurrentPage('club-detail');
        } else if (state.page === 'head-admin') {
          setSelectedClubId(null);
          setCurrentPage('head-admin');
        } else if (state.page === 'server-admin') {
          setSelectedClubId(null);
          setCurrentPage('server-admin');
        } else if (state.page === 'lobby') {
          setSelectedClubId(null);
          setCurrentPage('lobby');
        } else if (state.page === 'login') {
          setSelectedClubId(null);
          setCurrentPage('login');
        }
      } else {
        // Fallback: parse current URL query params
        const parsed = parseRouteFromUrl();
        if (parsed.clubId) {
          setSelectedClubId(parsed.clubId);
          setSelectedClubTab(parsed.tab);
          setCurrentPage('club-detail');
        } else if (parsed.page === 'head-admin') {
          setSelectedClubId(null);
          setCurrentPage('head-admin');
        } else if (parsed.page === 'server-admin') {
          setSelectedClubId(null);
          setCurrentPage('server-admin');
        } else {
          setSelectedClubId(null);
          setCurrentPage('lobby');
        }
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Restore authenticated session in background & synchronize history stack
  useEffect(() => {
    const savedToken = localStorage.getItem('dfmc_token');
    const initR = initialRoute.current;

    // 초기 history state 설정 (뒤로가기 스택 보장)
    if (!window.history.state) {
      if (initR.page === 'club-detail' && initR.clubId) {
        window.history.replaceState({ page: 'lobby' }, '', window.location.pathname);
        window.history.pushState(
          { page: 'club-detail', clubId: initR.clubId, clubTab: initR.tab },
          '',
          buildUrl('club-detail', initR.clubId, initR.tab)
        );
      } else if (initR.page && initR.page !== 'lobby') {
        // 관리 화면으로 바로 들어와도 [로비로]가 앱 안의 로비로 돌아가도록 로비 기록을 먼저 둔다.
        window.history.replaceState({ page: 'lobby' }, '', window.location.pathname);
        window.history.pushState({ page: initR.page }, '', buildUrl(initR.page));
      } else {
        window.history.replaceState({ page: 'lobby' }, '', buildUrl('lobby'));
      }
    }

    if (savedToken) {
      // 백그라운드에서 세션 유효성 검증 (화면을 블로킹하지 않음)
      fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${savedToken}` },
      })
        .then((res) => {
          if (res.ok) return res.json();
          throw new Error('Invalid session');
        })
        .then((data) => {
          setUser(data.user);
          localStorage.setItem('dfmc_user', JSON.stringify(data.user));
          setToken(savedToken);

          if (initR.page === 'club-detail' && initR.clubId) {
            setSelectedClubId(initR.clubId);
            setSelectedClubTab(initR.tab);
            setCurrentPage('club-detail');
          } else if (initR.page === 'head-admin' && (data.user.role === 'head_admin' || data.user.role === 'media_admin')) {
            setCurrentPage('head-admin');
          } else if (data.user.role === 'server_admin' && initR.page === 'server-admin') {
            setCurrentPage('server-admin');
          }
        })
        .catch(() => {
          clearAccountCaches();
    localStorage.removeItem('dfmc_token');
          localStorage.removeItem('dfmc_user');
          setUser(null);
          setToken(null);
        });
    }
  }, []);

  const handleLoginSuccess = (newUser: User, newToken: string) => {
    setUser(newUser);
    setToken(newToken);
    localStorage.setItem('dfmc_user', JSON.stringify(newUser));
    // 로그인 완료 후 항상 홈(로비) 화면으로 이동
    window.history.replaceState({ page: 'lobby' }, '', window.location.pathname);
    setCurrentPage('lobby');
  };

  const handleLogout = () => {
    void fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    clearAccountCaches();
    localStorage.removeItem('dfmc_token');
    localStorage.removeItem('dfmc_user');
    setUser(null);
    setToken(null);
    setSelectedClubId(null);
    window.history.replaceState({ page: 'lobby' }, '', window.location.pathname);
    setCurrentPage('lobby');
  };

  const handleUpdateUser = (updated: Partial<User>) => {
    if (user) {
      const updatedUser = { ...user, ...updated };
      setUser(updatedUser);
      localStorage.setItem('dfmc_user', JSON.stringify(updatedUser));
    }
  };

  // Navigating into a Club Detail view (Guarded against guests and unauthenticated users)
  const handleNavigateClub = (clubId: number, initialTab: 'talk' | 'polls' | 'posts' | 'schedules' | 'photos' = 'talk') => {
    if (!user) {
      alert('로그인이 필요합니다.');
      setCurrentPage('login');
      return;
    }
    if (user.role === 'guest') {
      alert('게스트 모드 입니다.');
      return;
    }

    setSelectedClubId(clubId);
    setSelectedClubTab(initialTab);
    setCurrentPage('club-detail');
    window.history.pushState(
      { page: 'club-detail', clubId, clubTab: initialTab },
      '',
      buildUrl('club-detail', clubId, initialTab)
    );
  };

  // Returning to Lobby via in-app back arrow or brand logo
  const handleBackToLobby = () => {
    if (window.history.state && window.history.state.page && window.history.state.page !== 'lobby') {
      window.history.back();
      // Safety fallback in case popstate doesn't fire immediately
      setTimeout(() => {
        if (currentPageRef.current !== 'lobby') {
          window.history.replaceState({ page: 'lobby' }, '', window.location.pathname);
          setSelectedClubId(null);
          setCurrentPage('lobby');
        }
      }, 120);
    } else {
      window.history.replaceState({ page: 'lobby' }, '', window.location.pathname);
      setSelectedClubId(null);
      setCurrentPage('lobby');
    }
  };

  // Navigation from Header
  const handleNavigate = (page: string) => {
    if (page === currentPage) return;

    if (page === 'lobby') {
      handleBackToLobby();
    } else {
      window.history.pushState({ page }, '', buildUrl(page));
      setSelectedClubId(null);
      setCurrentPage(page);
    }
  };

  // My Info Modal open/close with history push
  const handleOpenMyInfo = () => {
    setShowMyInfoModal(true);
    const currentState = window.history.state || {
      page: currentPage,
      clubId: selectedClubId,
      clubTab: selectedClubTab
    };
    window.history.pushState({ ...currentState, modal: 'my-info' }, '', window.location.href);
  };

  const handleCloseMyInfo = () => {
    setShowMyInfoModal(false);
    if (window.history.state && window.history.state.modal === 'my-info') {
      window.history.back();
    }
  };

  const isServerAdminView = currentPage === 'server-admin';
  const isClubDetailView = currentPage === 'club-detail';

  return (
    <div className={`app-container ${isServerAdminView ? 'full-width' : ''} ${isClubDetailView ? 'threads-full-view' : ''}`}>
      {/* Top Header for all non-login pages */}
      {currentPage !== 'login' && (
        <Header
          user={user}
          currentPage={currentPage}
          onNavigate={handleNavigate}
          onLogout={handleLogout}
          onOpenMyInfo={handleOpenMyInfo}
        />
      )}

      {/* Main Page Routing */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {currentPage === 'login' ? (
          <LoginPage onLoginSuccess={handleLoginSuccess} onNavigateHome={() => setCurrentPage('lobby')} />
        ) : currentPage === 'server-admin' && user?.role === 'server_admin' ? (
          <ServerAdminPage onNavigateLobby={handleBackToLobby} />
        ) : currentPage === 'head-admin' && user && (user.role === 'head_admin' || user.role === 'media_admin') ? (
          <HeadAdminPage user={user} onBackToLobby={handleBackToLobby} />
        ) : currentPage === 'club-detail' && selectedClubId && user && user.role !== 'guest' ? (
          <ClubDetailPage key={(user?.username || '') + ':' + selectedClubId}
            clubId={selectedClubId}
            user={user}
            initialTab={selectedClubTab}
            onBackToLobby={handleBackToLobby}
          />
        ) : (
          <LobbyPage key={user?.username || 'anonymous'}
            user={user}
            onUpdateUser={handleUpdateUser}
            onNavigateClub={handleNavigateClub}
            onRequireLogin={() => setCurrentPage('login')}
            onLoginSuccess={handleLoginSuccess}
          />
        )}
      </main>

      {/* My Info & Cell Change Modal */}
      {showMyInfoModal && user && (
        <MyInfoModal
          user={user}
          onClose={handleCloseMyInfo}
          onUserUpdated={(updatedUser, newToken) => {
            setUser(updatedUser);
            if (newToken) setToken(newToken);
          }}
        />
      )}

    </div>
  );
}

export default App;
