import React, { useState, useEffect } from 'react';
import { User, ServerMetrics } from '../types';
import { Server, HardDrive, Activity, Users, ShieldAlert, CheckCircle, RefreshCw, Search, ChevronDown } from 'lucide-react';

interface ServerAdminPageProps {
  onNavigateLobby: () => void;
}

export const ServerAdminPage: React.FC<ServerAdminPageProps> = ({ onNavigateLobby }) => {
  const [metrics, setMetrics] = useState<ServerMetrics | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [actionMessage, setActionMessage] = useState('');
  const [actionError, setActionError] = useState('');

  const token = localStorage.getItem('dfmc_token');

  // Load metrics and users
  const loadData = async () => {
    try {
      const [metricsRes, usersRes] = await Promise.all([
        fetch('/api/server-admin/metrics', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/server-admin/users', { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      if (metricsRes.ok) {
        const mData = await metricsRes.json();
        setMetrics(mData);
      }
      if (usersRes.ok) {
        const uData = await usersRes.json();
        setUsers(uData.users);
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

  // Set User Role via Dropdown
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

  const filteredUsers = users
    .filter((u) =>
      u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.cell_name.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      const rankA = getRolePriority(a);
      const rankB = getRolePriority(b);
      if (rankA !== rankB) {
        return rankA - rankB;
      }
      return a.name.localeCompare(b.name, 'ko');
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
            <span style={{ fontSize: '11px', color: '#94a3b8' }}>
              DFMC System Master Controller (dfmc8470)
            </span>
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
            {metrics?.traffic.today ?? 0} <span style={{ fontSize: '13px', color: '#6b7280', fontWeight: 'normal' }}>요청 (오늘)</span>
          </div>
          <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px' }}>
            누적 전체 요청: {metrics?.traffic.total ?? 0}회
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
            {metrics?.storage.used_mb ?? 0} <span style={{ fontSize: '13px', color: '#6b7280', fontWeight: 'normal' }}>/ 1,024 MB</span>
          </div>
          
          {/* Progress bar */}
          <div style={{ width: '100%', height: '8px', background: '#1f2937', borderRadius: '999px', margin: '8px 0 4px', overflow: 'hidden' }}>
            <div style={{
              width: `${Math.max(1, Math.min(100, parseFloat(metrics?.storage.percentage || '0.1')))}%`,
              height: '100%',
              background: 'linear-gradient(90deg, #10b981, #059669)',
              borderRadius: '999px'
            }} />
          </div>
          <div style={{ fontSize: '11px', color: '#6b7280', display: 'flex', justifyContent: 'space-between' }}>
            <span>사용률: {metrics?.storage.percentage ?? 0}%</span>
            <span>여유: {(1024 - parseFloat(metrics?.storage.used_mb || '0')).toFixed(2)} MB</span>
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
            {metrics?.total_members ?? 0} <span style={{ fontSize: '13px', color: '#6b7280', fontWeight: 'normal' }}>명</span>
          </div>
          <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px' }}>
            전체 관리자 대상 (소속: 둔산제일교회): {users.filter(u => u.cell_name === '둔산제일교회' && u.role !== 'server_admin' && u.role !== 'head_admin').length}명
          </div>
        </div>

        {/* 4. Security Status Card */}
        <div style={{
          background: '#111827',
          border: metrics?.security.is_locked ? '1px solid #ef4444' : '1px solid #1f2937',
          borderRadius: 'var(--radius-lg)',
          padding: '18px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#9ca3af', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: '600' }}>2FA 보안 상태</span>
            <ShieldAlert size={18} color={metrics?.security.is_locked ? '#ef4444' : '#f59e0b'} />
          </div>
          <div style={{ fontSize: '16px', fontWeight: '700', color: metrics?.security.is_locked ? '#ef4444' : '#fcd34d' }}>
            {metrics?.security.is_locked ? '🚨 시스템 잠금 중' : '정상 작동 중'}
          </div>
          <div style={{ fontSize: '11px', color: '#9ca3af', margin: '4px 0 10px' }}>
            실패 횟수: {metrics?.security.fail_count ?? 0}/5회
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
      </div>

      {/* User Management Section (Head Admin Appointment) */}
      <div style={{
        background: '#111827',
        border: '1px solid #1f2937',
        borderRadius: 'var(--radius-lg)',
        padding: '20px'
      }}>
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
              명단
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
              {filteredUsers.map((u) => (
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
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
