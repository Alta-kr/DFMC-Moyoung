import { accountCache, cacheForAccount } from '../firebase/accountCache';
import React, { useState, useEffect } from 'react';
import { User, ServerMetrics } from '../types';
import { Server, HardDrive, Activity, Users, ShieldAlert, CheckCircle, RefreshCw, Search, ChevronDown, BarChart3, Eye, Trash2, UserX } from 'lucide-react';
import { ClubAnalyticsModal } from '../components/ClubAnalyticsModal';

interface ServerAdminPageProps {
  onNavigateLobby: () => void;
}

export const ServerAdminPage: React.FC<ServerAdminPageProps> = ({ onNavigateLobby }) => {
  const accountCache = cacheForAccount(JSON.parse(localStorage.getItem('dfmc_user') || 'null')?.username || 'anonymous');
  const [metrics, setMetrics] = useState<ServerMetrics | null>(() => {
    try {
      const cached = accountCache.getItem('dfmc_sa_metrics_cache');
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });
  const [users, setUsers] = useState<User[]>(() => {
    try {
      const cached = accountCache.getItem('dfmc_sa_users_cache');
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [guestSearchTerm, setGuestSearchTerm] = useState('');
  const [loading, setLoading] = useState<boolean>(() => {
    try {
      const cached = accountCache.getItem('dfmc_sa_users_cache');
      return !cached || JSON.parse(cached).length === 0;
    } catch {
      return true;
    }
  });
  const [actionMessage, setActionMessage] = useState('');
  const [actionError, setActionError] = useState('');
  const [showAnalyticsModal, setShowAnalyticsModal] = useState(false);
  const [reports, setReports] = useState<any[]>(() => {
    try {
      const cached = accountCache.getItem('dfmc_sa_reports_cache');
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });
  const [activeTab, setActiveTab] = useState<'users' | 'guests' | 'reports'>('users');

  const token = accountCache.getItem('dfmc_token');

  // Load metrics and users
  const loadData = async () => {
    try {
      const [metricsRes, usersRes, reportsRes] = await Promise.all([
        fetch('/api/server-admin/metrics', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/server-admin/users', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/server-admin/reports', { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      if (metricsRes.ok) {
        const mData = await metricsRes.json();
        setMetrics(mData);
        try { accountCache.setItem('dfmc_sa_metrics_cache', JSON.stringify(mData)); } catch {}
      }
      if (usersRes.ok) {
        const uData = await usersRes.json();
        const uList = Array.isArray(uData) ? uData : (uData.users || []);
        setUsers(uList);
        try { accountCache.setItem('dfmc_sa_users_cache', JSON.stringify(uList)); } catch {}
      }
      if (reportsRes.ok) {
        const rData = await reportsRes.json();
        const rList = rData.reports || [];
        setReports(rList);
        try { accountCache.setItem('dfmc_sa_reports_cache', JSON.stringify(rList)); } catch {}
      }
    } catch (err) {
      console.error('Failed to load server admin data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000); // Live poll every 5s
    return () => clearInterval(interval);
  }, []);

  const handleResolveReport = async (id: number) => {
    try {
      const res = await fetch(`/api/server-admin/reports/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: 'resolved' })
      });
      if (res.ok) {
        setActionMessage('버그 처리가 완료되었습니다.');
        loadData();
      }
    } catch (err: any) {
      setActionError(err.message);
    }
  };

  // Delete Guest Account
  const handleDeleteGuest = async (identifier: string | number, name: string) => {
    if (!confirm(`'${name}' 게스트 계정을 완전히 삭제하시겠습니까?\n(일정 참석 데이터 및 임시 접속 기록이 초기화됩니다)`)) {
      return;
    }
    try {
      const res = await fetch(`/api/server-admin/guests/${identifier}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '게스트 삭제 실패');
      setActionMessage(data.message || '게스트 계정이 삭제되었습니다.');
      loadData();
    } catch (err: any) {
      setActionError(err.message);
    }
  };

  // Format ISO Date to Korean Format
  const formatDateTime = (iso?: string) => {
    if (!iso) return '-';
    try {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return iso;
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const hh = String(d.getHours()).padStart(2, '0');
      const min = String(d.getMinutes()).padStart(2, '0');
      return `${yyyy}.${mm}.${dd} ${hh}:${min}`;
    } catch {
      return iso;
    }
  };

  // Set User Role via Dropdown (Only for regular members)
  const handleSetRole = async (userId: number, role: 'head_admin' | 'member' | 'media_admin', userName: string) => {
    setActionMessage('');
    setActionError('');

    const roleLabel = role === 'head_admin' ? '전체 관리자' : role === 'media_admin' ? '미디어관리자' : '일반회원';
    if (!confirm(`'${userName}' 성도의 권한을 [${roleLabel}](으)로 변경하시겠습니까?`)) {
      loadData();
      return;
    }

    try {
      const res = await fetch('/api/server-admin/set-role', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ userId, role }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || '역할 변경 실패');
      }

      setActionMessage(data.message);
      loadData();
    } catch (err: any) {
      setActionError(err.message);
      loadData();
    }
  };

  // Reset 2FA Security Lock
  const handleResetSecurity = async () => {
    if (!confirm('2FA 실패 횟수 및 잠금 상태를 초기화하시겠습니까?')) return;
    try {
      const res = await fetch('/api/server-admin/reset-security', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setActionMessage(data.message);
      loadData();
    } catch (err: any) {
      setActionError(err.message);
    }
  };

  // Role priority: 전체(1) -> 미디어(2) -> 서버(3) -> 총무(4) -> 일반(5)
  const getRolePriority = (u: User): number => {
    if (u.role === 'head_admin') return 1;    // 전체
    if (u.role === 'media_admin') return 2;   // 미디어
    if (u.role === 'server_admin') return 3;  // 서버
    if (u.is_leader) return 4;               // 총무
    return 5;                                // 일반
  };

  // Separate regular members from guests
  const regularUsers = (users || []).filter((u) => u.role !== 'guest' && !u.is_guest);
  const guestUsers = (users || []).filter((u) => u.role === 'guest' || u.is_guest);

  // Filtered regular church members
  const filteredUsers = regularUsers
    .filter((u) =>
      (u.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.username || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.cell_name || '').toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      const rankA = getRolePriority(a);
      const rankB = getRolePriority(b);
      if (rankA !== rankB) {
        return rankA - rankB;
      }
      return (a.name || '').localeCompare(b.name || '', 'ko');
    });

  // Filtered guest visitors
  const filteredGuests = guestUsers
    .filter((g) => {
      const term = guestSearchTerm.toLowerCase();
      const acqu = (g.acquaintance_name || g.cell_name || '').toLowerCase();
      return (
        (g.name || '').toLowerCase().includes(term) ||
        (g.username || '').toLowerCase().includes(term) ||
        acqu.includes(term)
      );
    })
    .sort((a, b) => {
      const dateA = a.created_at ? new Date(a.created_at).getTime() : a.id;
      const dateB = b.created_at ? new Date(b.created_at).getTime() : b.id;
      return dateB - dateA;
    });

  return (
    <div style={{
      background: '#090d16',
      minHeight: '100vh',
      color: '#f1f5f9',
      padding: '24px 20px 80px',
      fontFamily: 'var(--font-family)',
    }}>
      {/* Top Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingBottom: '20px',
        borderBottom: '1px solid #1e293b',
        marginBottom: '24px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #6366f1, #4338ca)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white'
          }}>
            <Server size={22} />
          </div>
          <div>
            <h1 style={{ fontSize: '18px', fontWeight: '800', letterSpacing: '-0.3px', margin: 0 }}>
              서버 관리자 콘솔
            </h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginTop: '2px' }}>
              <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                DFMC System Master Controller (dfmc8470)
              </span>
              <span style={{ color: '#475569', fontSize: '10px' }}>•</span>
              <span style={{
                fontSize: '11px',
                color: '#fbbf24',
                background: 'rgba(251, 191, 36, 0.12)',
                border: '1px solid rgba(251, 191, 36, 0.3)',
                padding: '1px 8px',
                borderRadius: '5px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                📌 <span>도메인 관리: 고대디. 26.11.30 이후 가비아로 이전해야함</span>
              </span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            className="btn btn-sm btn-secondary"
            onClick={loadData}
            style={{ background: '#1e293b', color: '#cbd5e1', border: '1px solid #334155' }}
            title="새로고침"
          >
            <RefreshCw size={14} />
          </button>
          <button
            className="btn btn-sm btn-primary"
            onClick={onNavigateLobby}
            style={{ fontSize: '12px', padding: '6px 12px' }}
          >
            일반 로비 보기
          </button>
        </div>
      </div>

      {actionMessage && (
        <div style={{
          padding: '12px 16px',
          background: 'rgba(16, 185, 129, 0.15)',
          border: '1px solid rgba(16, 185, 129, 0.4)',
          borderRadius: 'var(--radius-md)',
          color: '#34d399',
          fontSize: '13px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <CheckCircle size={16} />
          {actionMessage}
        </div>
      )}

      {actionError && (
        <div style={{
          padding: '12px 16px',
          background: 'rgba(239, 68, 68, 0.15)',
          border: '1px solid rgba(239, 68, 68, 0.4)',
          borderRadius: 'var(--radius-md)',
          color: '#f87171',
          fontSize: '13px',
          marginBottom: '20px'
        }}>
          {actionError}
        </div>
      )}

      {/* Real-time Metrics Dashboard */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '16px',
        marginBottom: '28px'
      }}>
        {/* 1. Traffic Card */}
        <div style={{
          background: '#111827',
          border: '1px solid #1f2937',
          borderRadius: 'var(--radius-lg)',
          padding: '18px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#9ca3af', marginBottom: '10px' }}>
            <span style={{ fontSize: '12px', fontWeight: '600' }}>실시간 트래픽</span>
            <Activity size={18} color="#38bdf8" />
          </div>
          <div style={{ fontSize: '26px', fontWeight: '800', color: '#38bdf8' }}>
            {metrics?.traffic?.today ?? 0} <span style={{ fontSize: '13px', color: '#6b7280', fontWeight: 'normal' }}>요청 (오늘)</span>
          </div>
          <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px' }}>
            누적 전체 요청: {metrics?.traffic?.total ?? 0}회
          </div>
        </div>

        {/* 2. 1GB Storage Gauge Card */}
        <div style={{
          background: '#111827',
          border: '1px solid #1f2937',
          borderRadius: 'var(--radius-lg)',
          padding: '18px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#9ca3af', marginBottom: '10px' }}>
            <span style={{ fontSize: '12px', fontWeight: '600' }}>1GB 무료 스토리지</span>
            <HardDrive size={18} color="#10b981" />
          </div>
          <div style={{ fontSize: '22px', fontWeight: '800', color: '#10b981' }}>
            {metrics?.storage?.used_mb ?? '0'} <span style={{ fontSize: '13px', color: '#6b7280', fontWeight: 'normal' }}>/ 1,024 MB</span>
          </div>
          
          {/* Progress bar */}
          <div style={{ width: '100%', height: '8px', background: '#1f2937', borderRadius: '999px', margin: '8px 0 4px', overflow: 'hidden' }}>
            <div style={{
              width: `${Math.max(1, Math.min(100, parseFloat(metrics?.storage?.percentage || '0.1')))}%`,
              height: '100%',
              background: 'linear-gradient(90deg, #10b981, #059669)',
              borderRadius: '999px'
            }} />
          </div>
          <div style={{ fontSize: '11px', color: '#6b7280', display: 'flex', justifyContent: 'space-between' }}>
            <span>사용률: {metrics?.storage?.percentage ?? 0}%</span>
            <span>여유: {(1024 - parseFloat(metrics?.storage?.used_mb || '0')).toFixed(2)} MB</span>
          </div>
        </div>

        {/* 3. Total Members Card */}
        <div style={{
          background: '#111827',
          border: '1px solid #1f2937',
          borderRadius: 'var(--radius-lg)',
          padding: '18px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#9ca3af', marginBottom: '10px' }}>
            <span style={{ fontSize: '12px', fontWeight: '600' }}>가입 성도 수</span>
            <Users size={18} color="#a855f7" />
          </div>
          <div style={{ fontSize: '26px', fontWeight: '800', color: '#c084fc' }}>
            {regularUsers.length} <span style={{ fontSize: '13px', color: '#6b7280', fontWeight: 'normal' }}>명</span>
          </div>
          <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>정식 성도: {regularUsers.length}명</span>
            <span style={{
              background: 'rgba(234, 179, 8, 0.15)',
              color: '#facc15',
              border: '1px solid rgba(234, 179, 8, 0.3)',
              padding: '1px 6px',
              borderRadius: '4px',
              fontWeight: '700'
            }}>
              게스트: {guestUsers.length}명
            </span>
          </div>
        </div>

        {/* 4. Security Status Card */}
        <div style={{
          background: '#111827',
          border: metrics?.security?.is_locked ? '1px solid #ef4444' : '1px solid #1f2937',
          borderRadius: 'var(--radius-lg)',
          padding: '18px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#9ca3af', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: '600' }}>2FA 보안 상태</span>
            <ShieldAlert size={18} color={metrics?.security?.is_locked ? '#ef4444' : '#f59e0b'} />
          </div>
          <div style={{ fontSize: '16px', fontWeight: '700', color: metrics?.security?.is_locked ? '#ef4444' : '#fcd34d' }}>
            {metrics?.security?.is_locked ? '🚨 시스템 잠금 중' : '정상 작동 중'}
          </div>
          <div style={{ fontSize: '11px', color: '#9ca3af', margin: '4px 0 10px' }}>
            실패 횟수: {metrics?.security?.fail_count ?? 0}/5회
          </div>
          <button
            onClick={handleResetSecurity}
            className="btn btn-sm"
            style={{
              background: '#374151',
              color: '#f3f4f6',
              fontSize: '11px',
              padding: '4px 10px',
              width: '100%'
            }}
          >
            보안 카운터 / 락 초기화
          </button>
        </div>

        {/* 5. Moyoung View Analytics Card */}
        <div style={{
          background: 'linear-gradient(135deg, #1e1b4b 0%, #111827 100%)',
          border: '1px solid #4338ca',
          borderRadius: 'var(--radius-lg)',
          padding: '18px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#a5b4fc', marginBottom: '8px' }}>
              <span style={{ fontSize: '12px', fontWeight: '700' }}>모영 접속 통계</span>
              <BarChart3 size={18} color="#818cf8" />
            </div>
            <div style={{ fontSize: '18px', fontWeight: '800', color: '#ffffff' }}>
              일·주·월별 조회수 분석
            </div>
            <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>
              서버 관리자 & 전체 관리자 전용
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowAnalyticsModal(true)}
            className="btn btn-sm btn-primary"
            style={{
              marginTop: '12px',
              fontSize: '11.5px',
              fontWeight: '700',
              padding: '6px 10px',
              background: '#4f46e5',
              borderColor: '#6366f1',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}
          >
            <BarChart3 size={13} />
            <span>상세 분석 차트 열기</span>
          </button>
        </div>
      </div>

      {/* User Management Section (Head Admin Appointment) */}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '20px' }}>
        <button
          onClick={() => setActiveTab('users')}
          style={{
            padding: '12px', borderRadius: '12px',
            background: activeTab === 'users' ? '#3b82f6' : '#1f2937',
            color: activeTab === 'users' ? 'white' : '#9ca3af',
            fontWeight: 'bold', border: activeTab === 'users' ? '1px solid #60a5fa' : '1px solid #374151',
            cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px'
          }}
        >
          <span>성도 명단</span>
          <span style={{
            background: activeTab === 'users' ? 'rgba(255,255,255,0.25)' : '#374151',
            padding: '2px 8px', borderRadius: '10px', fontSize: '11px', color: 'white'
          }}>
            {regularUsers.length}명
          </span>
        </button>

        <button
          onClick={() => setActiveTab('guests')}
          style={{
            padding: '12px', borderRadius: '12px',
            background: activeTab === 'guests' ? '#d97706' : '#1f2937',
            color: activeTab === 'guests' ? 'white' : '#9ca3af',
            fontWeight: 'bold', border: activeTab === 'guests' ? '1px solid #f59e0b' : '1px solid #374151',
            cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px'
          }}
        >
          <span>게스트 접속 명단</span>
          <span style={{
            background: activeTab === 'guests' ? 'rgba(255,255,255,0.25)' : 'rgba(217, 119, 6, 0.2)',
            color: activeTab === 'guests' ? 'white' : '#fbbf24',
            padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: '700'
          }}>
            {guestUsers.length}명
          </span>
        </button>

        <button
          onClick={() => setActiveTab('reports')}
          style={{
            padding: '12px', borderRadius: '12px',
            background: activeTab === 'reports' ? '#3b82f6' : '#1f2937',
            color: activeTab === 'reports' ? 'white' : '#9ca3af',
            fontWeight: 'bold', border: activeTab === 'reports' ? '1px solid #60a5fa' : '1px solid #374151',
            cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px'
          }}
        >
          <span>버그 제보함</span>
          {reports.filter(r => r.status === 'pending').length > 0 && (
            <span style={{ background: '#ef4444', color: 'white', padding: '2px 8px', borderRadius: '12px', fontSize: '11px' }}>
              {reports.filter(r => r.status === 'pending').length}
            </span>
          )}
        </button>
      </div>

      <div style={{
        background: '#111827',
        border: '1px solid #1f2937',
        borderRadius: 'var(--radius-lg)',
        padding: '20px'
      }}>
        {activeTab === 'users' ? (
          <>
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              marginBottom: '16px'
            }}>
              <div>
                <h2 style={{ fontSize: '16px', fontWeight: '800', margin: 0 }}>
                  정식 성도 명단
                </h2>
                <p style={{ fontSize: '12px', color: '#9ca3af', margin: '4px 0 0 0' }}>
                  정렬: 전체 관리자 → 미디어관리자 → 서버관리자 → 총무 → 일반 성도 (동일 권한 시 이름 가나다순)
                </p>
              </div>

              <div style={{ position: 'relative', minWidth: '220px' }}>
                <Search size={14} style={{ position: 'absolute', left: '10px', top: '10px', color: '#6b7280' }} />
                <input
                  type="text"
                  placeholder="이름 / 아이디 / 셀 검색"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '6px 12px 6px 30px',
                    fontSize: '12px',
                    background: '#1f2937',
                    border: '1px solid #374151',
                    borderRadius: 'var(--radius-md)',
                    color: 'white',
                    outline: 'none'
                  }}
                />
              </div>
            </div>

            {/* User Table */}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #374151', color: '#9ca3af', fontSize: '12px' }}>
                    <th style={{ padding: '10px 12px' }}>이름</th>
                    <th style={{ padding: '10px 12px' }}>아이디</th>
                    <th style={{ padding: '10px 12px' }}>소속 셀</th>
                    <th style={{ padding: '10px 12px' }}>현재 권한 (변경)</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && users.length === 0 ? (
                    <tr>
                      <td colSpan={4} style={{ textAlign: 'center', padding: '40px 12px', color: '#9ca3af' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                          <RefreshCw size={24} className="animate-spin" style={{ color: '#38bdf8' }} />
                          <span style={{ fontSize: '13px', fontWeight: '500' }}>성도 명단을 빠르게 불러오는 중...</span>
                        </div>
                      </td>
                    </tr>
                  ) : filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={4} style={{ textAlign: 'center', padding: '30px 12px', color: '#6b7280' }}>
                        {searchTerm ? '검색 결과가 없습니다.' : '등록된 성도가 없습니다.'}
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((u) => (
                    <tr key={u.id} style={{ borderBottom: '1px solid #1f2937' }}>
                      <td style={{ padding: '12px', fontWeight: '700', color: '#f3f4f6' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span>{u.name}</span>
                          {u.is_leader && (
                            <span
                              style={{
                                fontSize: '11px',
                                fontWeight: '700',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                background: 'rgba(59, 130, 246, 0.2)',
                                color: '#60a5fa',
                                border: '1px solid rgba(59, 130, 246, 0.35)',
                              }}
                              title={u.leader_clubs?.length ? `${u.leader_clubs.join(', ')} 총무` : '모영 총무'}
                            >
                              총무
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: '12px', color: '#9ca3af', fontFamily: 'monospace' }}>
                        {u.username}
                      </td>
                      <td style={{ padding: '12px', color: '#cbd5e1' }}>
                        {u.cell_name}
                      </td>
                      <td style={{ padding: '12px' }}>
                        {u.role === 'server_admin' ? (
                          <span className="badge badge-server" style={{ fontSize: '12px', padding: '6px 12px' }}>
                            서버관리자 (고정)
                          </span>
                        ) : (
                          <div style={{ position: 'relative', display: 'inline-block' }}>
                            <select
                              value={u.role}
                              onChange={(e) => handleSetRole(u.id, e.target.value as 'member' | 'head_admin' | 'media_admin', u.name)}
                              style={{
                                appearance: 'none',
                                WebkitAppearance: 'none',
                                padding: '6px 30px 6px 12px',
                                fontSize: '12.5px',
                                fontWeight: '700',
                                borderRadius: '8px',
                                border: u.role === 'head_admin'
                                  ? '1.5px solid #f59e0b'
                                  : u.role === 'media_admin'
                                  ? '1.5px solid #8b5cf6'
                                  : '1.5px solid #374151',
                                background: u.role === 'head_admin'
                                  ? 'rgba(245, 158, 11, 0.15)'
                                  : u.role === 'media_admin'
                                  ? 'rgba(139, 92, 246, 0.15)'
                                  : '#1f2937',
                                color: u.role === 'head_admin'
                                  ? '#fbbf24'
                                  : u.role === 'media_admin'
                                  ? '#c084fc'
                                  : '#d1d5db',
                                cursor: 'pointer',
                                outline: 'none',
                                transition: 'all 0.2s ease',
                              }}
                            >
                              <option value="member" style={{ background: '#111827', color: '#e5e7eb' }}>
                                {u.is_leader ? '일반회원 (모영 총무)' : '일반회원'}
                              </option>
                              <option value="media_admin" style={{ background: '#111827', color: '#c084fc' }}>
                                미디어관리자
                              </option>
                              <option
                                value="head_admin"
                                disabled={u.cell_name !== '둔산제일교회'}
                                style={{
                                  background: '#111827',
                                  color: u.cell_name === '둔산제일교회' ? '#fbbf24' : '#6b7280',
                                }}
                              >
                                전체 관리자 {u.cell_name !== '둔산제일교회' ? '(소속: 둔산제일교회 전용)' : ''}
                              </option>
                            </select>
                            <ChevronDown
                              size={14}
                              style={{
                                position: 'absolute',
                                right: '10px',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                pointerEvents: 'none',
                                color: u.role === 'head_admin' ? '#fbbf24' : u.role === 'media_admin' ? '#c084fc' : '#9ca3af',
                              }}
                            />
                          </div>
                        )}
                      </td>
                    </tr>
                  )))}
                </tbody>
              </table>
            </div>
          </>
        ) : activeTab === 'guests' ? (
          <>
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              marginBottom: '16px'
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h2 style={{ fontSize: '16px', fontWeight: '800', margin: 0, color: '#f3f4f6' }}>
                    게스트 접속자 관리
                  </h2>
                  <span style={{
                    fontSize: '11px',
                    fontWeight: '700',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    background: 'rgba(234, 179, 8, 0.15)',
                    color: '#facc15',
                    border: '1px solid rgba(234, 179, 8, 0.3)'
                  }}>
                    참석 신청 전용
                  </span>
                </div>
                <p style={{ fontSize: '12px', color: '#9ca3af', margin: '4px 0 0 0' }}>
                  정식 성도가 아니므로 관리자(미디어/총무 등) 권한을 가질 수 없으며, 모든 성도 검색 및 명단에서 자동 격리됩니다.
                </p>
              </div>

              <div style={{ position: 'relative', minWidth: '240px' }}>
                <Search size={14} style={{ position: 'absolute', left: '10px', top: '10px', color: '#6b7280' }} />
                <input
                  type="text"
                  placeholder="게스트 성명 / 지인 이름 / 임시 ID"
                  value={guestSearchTerm}
                  onChange={(e) => setGuestSearchTerm(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '6px 12px 6px 30px',
                    fontSize: '12px',
                    background: '#1f2937',
                    border: '1px solid #374151',
                    borderRadius: 'var(--radius-md)',
                    color: 'white',
                    outline: 'none'
                  }}
                />
              </div>
            </div>

            {/* Guest Table */}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #374151', color: '#9ca3af', fontSize: '12px' }}>
                    <th style={{ padding: '10px 12px' }}>게스트 성명</th>
                    <th style={{ padding: '10px 12px' }}>교회 지인 (인도자)</th>
                    <th style={{ padding: '10px 12px' }}>임시 계정 ID</th>
                    <th style={{ padding: '10px 12px' }}>접속/생성 일시</th>
                    <th style={{ padding: '10px 12px' }}>권한 상태</th>
                    <th style={{ padding: '10px 12px', textAlign: 'center' }}>계정 관리</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && users.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '40px 12px', color: '#9ca3af' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                          <RefreshCw size={24} className="animate-spin" style={{ color: '#f59e0b' }} />
                          <span style={{ fontSize: '13px', fontWeight: '500' }}>게스트 명단을 빠르게 불러오는 중...</span>
                        </div>
                      </td>
                    </tr>
                  ) : filteredGuests.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '36px', color: '#9ca3af', fontSize: '13px' }}>
                        {guestSearchTerm ? '검색 조건과 일치하는 게스트가 없습니다.' : '현재 접속/등록된 게스트가 없습니다.'}
                      </td>
                    </tr>
                  ) : (
                    filteredGuests.map((g) => {
                      const acquaintance = g.acquaintance_name || (g.cell_name ? g.cell_name.replace('지인: ', '') : '-');
                      return (
                        <tr key={g.id || g.username} style={{ borderBottom: '1px solid #1f2937' }}>
                          <td style={{ padding: '12px', fontWeight: '700', color: '#f3f4f6' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span>{g.name}</span>
                              <span style={{
                                fontSize: '10.5px',
                                fontWeight: '700',
                                padding: '1px 6px',
                                borderRadius: '4px',
                                background: 'rgba(234, 179, 8, 0.15)',
                                color: '#facc15',
                                border: '1px solid rgba(234, 179, 8, 0.3)'
                              }}>
                                게스트
                              </span>
                            </div>
                          </td>
                          <td style={{ padding: '12px', color: '#93c5fd', fontWeight: '600' }}>
                            {acquaintance}
                          </td>
                          <td style={{ padding: '12px', color: '#9ca3af', fontFamily: 'monospace', fontSize: '12px' }}>
                            {g.username}
                          </td>
                          <td style={{ padding: '12px', color: '#cbd5e1', fontSize: '12px' }}>
                            {formatDateTime(g.created_at)}
                          </td>
                          <td style={{ padding: '12px' }}>
                            <span style={{
                              fontSize: '11px',
                              padding: '3px 8px',
                              borderRadius: '4px',
                              background: '#1e293b',
                              color: '#94a3b8',
                              border: '1px solid #334155',
                              display: 'inline-block'
                            }}>
                              일정 참석 전용 (관리자 불가)
                            </span>
                          </td>
                          <td style={{ padding: '12px', textAlign: 'center' }}>
                            <button
                              type="button"
                              onClick={() => handleDeleteGuest(g.username || g.id, g.name)}
                              style={{
                                background: 'rgba(239, 68, 68, 0.15)',
                                border: '1px solid rgba(239, 68, 68, 0.35)',
                                color: '#f87171',
                                padding: '4px 10px',
                                borderRadius: '6px',
                                fontSize: '11.5px',
                                fontWeight: '600',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                transition: 'all 0.15s ease'
                              }}
                              onMouseOver={(e) => (e.currentTarget.style.background = 'rgba(239, 68, 68, 0.25)')}
                              onMouseOut={(e) => (e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)')}
                              title="게스트 계정 및 기록 삭제"
                            >
                              <Trash2 size={13} />
                              <span>삭제</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div>
            <h2 style={{ fontSize: '16px', fontWeight: '800', margin: '0 0 16px 0', color: '#f3f4f6' }}>버그 제보함</h2>
            {loading && reports.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 12px', gap: '10px', color: '#9ca3af' }}>
                <RefreshCw size={24} className="animate-spin" style={{ color: '#3b82f6' }} />
                <span style={{ fontSize: '13px', fontWeight: '500' }}>버그 제보 목록을 불러오는 중...</span>
              </div>
            ) : reports.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px', color: '#9ca3af', fontSize: '13px' }}>
                접수된 버그 제보가 없습니다.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {reports.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).map(r => (
                  <div key={r.id} style={{ background: '#1f2937', border: '1px solid #374151', borderRadius: '8px', padding: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                      <div>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '4px' }}>
                          <span style={{
                            fontSize: '11px', fontWeight: 'bold', padding: '2px 8px', borderRadius: '4px',
                            background: r.status === 'pending' ? '#fef3c7' : '#dcfce3',
                            color: r.status === 'pending' ? '#b45309' : '#166534'
                          }}>
                            {r.status === 'pending' ? '대기 중' : '처리 완료'}
                          </span>
                          <span style={{ fontSize: '12px', color: '#9ca3af' }}>{new Date(r.created_at).toLocaleString()}</span>
                        </div>
                        <h3 style={{ fontSize: '14.5px', fontWeight: '800', margin: '0 0 4px 0', color: '#f3f4f6' }}>{r.title}</h3>
                        <div style={{ fontSize: '12px', color: '#60a5fa' }}>제보자: {r.user_name} ({r.user_cell})</div>
                      </div>
                      {r.status === 'pending' && (
                        <button
                          onClick={() => handleResolveReport(r.id)}
                          className="btn btn-sm btn-primary"
                          style={{ fontSize: '11px', padding: '4px 10px', background: '#3b82f6', border: 'none', borderRadius: '4px', color: 'white', cursor: 'pointer' }}
                        >
                          처리 완료
                        </button>
                      )}
                    </div>
                    <div style={{ fontSize: '13px', color: '#d1d5db', whiteSpace: 'pre-wrap', background: '#111827', padding: '12px', borderRadius: '6px' }}>
                      {r.content}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Club View Analytics Modal (Server Admin) */}
      {showAnalyticsModal && (
        <ClubAnalyticsModal
          onClose={() => setShowAnalyticsModal(false)}
        />
      )}
    </div>
  );
};
