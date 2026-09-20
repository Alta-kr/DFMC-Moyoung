import React, { useState, useEffect } from 'react';
import { User, CellItem } from '../types';
import { User as UserIcon, X, Check, RefreshCw, Shield, Users, AlertCircle } from 'lucide-react';

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
  const [cells, setCells] = useState<CellItem[]>([]);
  const [selectedCell, setSelectedCell] = useState(user.cell_name);
  const [customInput, setCustomInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Fetch church registered cells list
  useEffect(() => {
    fetch('/api/lobby/data')
      .then((res) => res.json())
      .then((data) => {
        if (data.cells) {
          setCells(data.cells);
        }
      })
      .catch((err) => console.error('Failed to load cells:', err));
  }, []);

  const handleCellChange = async (e: React.FormEvent) => {
    e.preventDefault();
    const cellValue = selectedCell === 'custom' ? customInput.trim() : selectedCell.trim();

    if (!cellValue) {
      setError('변경하실 소속 셀을 선택하거나 입력해주세요.');
      return;
    }

    if (cellValue === user.cell_name) {
      setError('현재 소속 셀과 동일합니다.');
      return;
    }

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

      setSuccessMsg(`소속 셀이 [${resData.cell_name}] (으)로 변경되었습니다! 🎉`);
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
      }, 1500);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getRoleBadge = () => {
    switch (user.role) {
      case 'server_admin':
        return <span className="badge badge-server">서버관리자</span>;
      case 'head_admin':
        return <span className="badge badge-admin">전체 관리자</span>;
      case 'media_admin':
        return (
          <span className="badge" style={{ background: '#ede9fe', color: '#6d28d9', border: '1px solid #ddd6fe' }}>
            미디어관리자
          </span>
        );
      default:
        return <span className="badge" style={{ background: '#f1f5f9', color: '#475569' }}>일반 성도</span>;
    }
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

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12.5px', color: 'var(--color-text-muted)', fontWeight: '600' }}>현재 권한</span>
            <div>{getRoleBadge()}</div>
          </div>

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

        {/* Change Cell Form */}
        <form onSubmit={handleCellChange} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label className="form-label" style={{ margin: 0, fontWeight: '800', fontSize: '13px' }}>
                소속 셀 변경하기
              </label>
              <span style={{ fontSize: '11px', color: 'var(--color-text-light)' }}>
                이동하신 새 셀을 선택하세요
              </span>
            </div>

            <select
              className="form-select"
              value={selectedCell}
              onChange={(e) => setSelectedCell(e.target.value)}
              style={{ fontSize: '13px' }}
              required
            >
              <option value="">-- 소속 셀을 선택하세요 --</option>
              {cells.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name} {c.name === user.cell_name ? '(현재 소속)' : ''}
                </option>
              ))}
              <option value="custom">직접 입력 (새 셀 또는 지인/인도자 실명)</option>
            </select>
          </div>

          {selectedCell === 'custom' && (
            <div>
              <label className="form-label" style={{ fontSize: '12px' }}>
                직접 입력 (공식 셀 명칭 또는 교회 지인 성도 실명)
              </label>
              <input
                type="text"
                className="form-input"
                placeholder="예: 2청년부 3셀 또는 김철수"
                value={customInput}
                onChange={(e) => setCustomInput(e.target.value)}
                required
                style={{ fontSize: '13px' }}
              />
            </div>
          )}

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
      </div>
    </div>
  );
};
