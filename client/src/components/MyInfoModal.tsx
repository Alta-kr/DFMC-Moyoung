import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { User as UserIcon, X, Check, RefreshCw, AlertCircle } from 'lucide-react';

interface MyInfoModalProps {
  user: User;
  onClose: () => void;
  onUserUpdated: (updatedUser: User, newToken?: string) => void;
}

export const MyInfoModal: React.FC<MyInfoModalProps> = ({
  user,
  onClose,
  onUserUpdated,
}) => {
  const [cellInput, setCellInput] = useState(user.cell_name);
  const [availableCells, setAvailableCells] = useState<{ id: number; name: string }[]>([]);
  const [leaderClubs, setLeaderClubs] = useState<string[]>(user.leader_clubs || []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const [showBugReport, setShowBugReport] = useState(false);
  const [bugTitle, setBugTitle] = useState('');
  const [bugContent, setBugContent] = useState('');
  const [bugLoading, setBugLoading] = useState(false);

  const handleBugSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bugTitle.trim() || !bugContent.trim()) return;
    setBugLoading(true);
    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: bugTitle,
          content: bugContent,
          user_id: user.id,
          user_name: user.name,
          user_cell: user.cell_name
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      alert('버그 제보가 성공적으로 접수되었습니다. 감사합니다!');
      setShowBugReport(false);
      setBugTitle('');
      setBugContent('');
    } catch (err: any) {
      alert(err.message);
    } finally {
      setBugLoading(false);
    }
  };

  // Fetch church clubs & cells to validate registered cells in real-time
  useEffect(() => {
    fetch('/api/lobby/data')
      .then((res) => res.json())
      .then((data) => {
        if (data.cells) {
          setAvailableCells(data.cells);
        }
        if (data.clubs) {
          const myClubs: string[] = [];
          data.clubs.forEach((c: any) => {
            const managers = (c.manager_names || '').split(',').map((s: string) => s.trim());
            if (managers.includes(user.name.trim())) {
              myClubs.push(c.name);
            }
          });
          setLeaderClubs(myClubs);
        }
      })
      .catch((err) => console.error('Failed to load lobby data for my-info:', err));
  }, [user.name]);

  const handleCellChange = async (e: React.FormEvent) => {
    e.preventDefault();
    const cellValue = cellInput.trim();

    if (!cellValue) {
      setError('소속 셀 이름을 입력해주세요.');
      return;
    }

    // 셀 목록에 존재하는지 확인 (없으면 디나이)
    if (availableCells.length > 0) {
      const match = availableCells.find(c => c.name.trim() === cellValue);
      if (!match) {
        setError(`등록된 교회 셀 목록에 [${cellValue}] 셀이 존재하지 않습니다. 등록된 셀 명단을 확인해주세요.`);
        return;
      }
    }

    // 기존 셀과 동일하더라도 경고/에러 문구를 띄우지 않고 저장
    setLoading(true);
    setError('');
    setSuccessMsg('');

    try {
      const token = localStorage.getItem('dfmc_token');
      const res = await fetch('/api/lobby/update-cell', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ cell_name: cellValue }),
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error || '소속 셀 변경에 실패했습니다.');
      }

      setSuccessMsg(`소속 셀이 [${resData.cell_name}] (으)로 저장되었습니다!`);
      if (resData.token) {
        localStorage.setItem('dfmc_token', resData.token);
      }
      if (resData.user) {
        onUserUpdated(resData.user, resData.token);
      } else {
        onUserUpdated({ ...user, cell_name: resData.cell_name }, resData.token);
      }

      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // 일반 성도인지 여부 (관리자가 아니고 총무도 아닌 경우)
  const isPlainMember = user.role === 'member' && (!leaderClubs || leaderClubs.length === 0);

  const renderRoleBadge = () => {
    if (user.role === 'server_admin') {
      return <span className="badge badge-server">서버관리자</span>;
    }
    if (user.role === 'head_admin') {
      return <span className="badge badge-admin">전체 관리자</span>;
    }
    if (user.role === 'media_admin') {
      return (
        <span className="badge" style={{ background: '#ede9fe', color: '#6d28d9', border: '1px solid #ddd6fe' }}>
          미디어관리자
        </span>
      );
    }
    if (user.role === 'guest') {
      return (
        <span className="badge" style={{ background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', fontWeight: '800' }}>
          게스트
        </span>
      );
    }
    if (leaderClubs && leaderClubs.length > 0) {
      return (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', justifyContent: 'flex-end' }}>
          {leaderClubs.map((clubName) => (
            <span
              key={clubName}
              className="badge"
              style={{
                background: '#0f172a',
                color: '#ffffff',
                fontWeight: '800',
                fontSize: '11px',
                padding: '2px 8px',
                borderRadius: '6px'
              }}
            >
              {clubName.endsWith('모영') ? `${clubName} 총무` : `${clubName} 모영 총무`}
            </span>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content animate-fade-in"
        style={{ maxWidth: '420px', padding: '22px' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              background: 'var(--color-primary-light)',
              color: 'var(--color-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <UserIcon size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: '16.5px', fontWeight: '800', margin: 0 }}>내 정보</h3>
              <p style={{ fontSize: '11.5px', color: 'var(--color-text-muted)', margin: 0 }}>
                성도 기본 정보 및 소속 셀 관리
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Feedback Alert */}
        {error && (
          <div style={{
            padding: '10px 14px',
            background: 'var(--color-danger-light)',
            color: 'var(--color-danger)',
            borderRadius: 'var(--radius-md)',
            fontSize: '12.5px',
            marginBottom: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            <AlertCircle size={15} />
            {error}
          </div>
        )}

        {successMsg && (
          <div style={{
            padding: '10px 14px',
            background: 'var(--color-success-light)',
            color: 'var(--color-success)',
            borderRadius: 'var(--radius-md)',
            fontSize: '12.5px',
            marginBottom: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontWeight: '700'
          }}>
            <Check size={15} />
            {successMsg}
          </div>
        )}

        {/* User Info Details Card */}
        <div style={{
          background: '#f8fafc',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-md)',
          padding: '14px',
          marginBottom: '18px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12.5px', color: 'var(--color-text-muted)', fontWeight: '600' }}>성도 실명</span>
            <span style={{ fontSize: '13.5px', fontWeight: '800', color: 'var(--color-text-main)' }}>{user.name} 님</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12.5px', color: 'var(--color-text-muted)', fontWeight: '600' }}>로그인 아이디</span>
            <span style={{ fontSize: '13px', color: '#475569', fontFamily: 'monospace' }}>{user.username}</span>
          </div>

          {/* 현재 권한: 일반 성도(비총무)에게는 항목 자체를 숨김, 총무는 '풋살 모영 총무' 등 표시, 관리자는 관리자 뱃지 표시 */}
          {!isPlainMember && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12.5px', color: 'var(--color-text-muted)', fontWeight: '600' }}>현재 권한</span>
              <div>{renderRoleBadge()}</div>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12.5px', color: 'var(--color-text-muted)', fontWeight: '600' }}>현재 소속 셀</span>
            <span style={{
              fontSize: '12.5px',
              fontWeight: '700',
              color: 'var(--color-primary)',
              background: '#eff6ff',
              padding: '2px 8px',
              borderRadius: '6px'
            }}>
              {user.cell_name}
            </span>
          </div>
        </div>

        {/* Change Cell Form (수기 직접 작성) */}
        <form onSubmit={handleCellChange} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label className="form-label" style={{ margin: 0, fontWeight: '800', fontSize: '13px' }}>
                소속 셀 변경하기
              </label>
              <span style={{ fontSize: '11px', color: 'var(--color-text-light)' }}>
                새 소속 셀을 수기로 직접 입력하세요
              </span>
            </div>

            <input
              type="text"
              className="form-input"
              placeholder="예: 1청년부 1셀, 2청년부 3셀 등"
              value={cellInput}
              onChange={(e) => setCellInput(e.target.value)}
              required
              style={{ fontSize: '13px' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '6px' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              style={{ padding: '7px 14px', fontSize: '12.5px' }}
            >
              닫기
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
              style={{ padding: '7px 16px', fontSize: '12.5px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '5px' }}
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
              소속 셀 변경 저장
            </button>
          </div>
        </form>

        <div style={{ marginTop: '20px', borderTop: '1px solid #e2e8f0', paddingTop: '15px' }}>
          <button
            onClick={() => setShowBugReport(!showBugReport)}
            style={{
              background: 'none', border: 'none', color: '#64748b', fontSize: '12px',
              textDecoration: 'underline', cursor: 'pointer', padding: 0
            }}
          >
            고객센터 / 버그 제보하기
          </button>

          {showBugReport && (
            <form onSubmit={handleBugSubmit} style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px', background: '#f8fafc', padding: '10px', borderRadius: '8px' }}>
              <input
                type="text"
                placeholder="제목 (예: 일정 오류, 로그인 안됨 등)"
                value={bugTitle}
                onChange={e => setBugTitle(e.target.value)}
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '12px' }}
                required
              />
              <textarea
                placeholder="어떤 문제가 발생했나요? 자세히 적어주시면 해결에 큰 도움이 됩니다."
                value={bugContent}
                onChange={e => setBugContent(e.target.value)}
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '12px', minHeight: '60px', resize: 'vertical' }}
                required
              />
              <button
                type="submit"
                disabled={bugLoading}
                className="btn btn-primary"
                style={{ alignSelf: 'flex-end', padding: '6px 12px', fontSize: '11.5px' }}
              >
                {bugLoading ? '전송 중...' : '제보하기'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
