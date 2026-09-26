import React, { useState } from 'react';
import { CellItem, User } from '../types';
import { RefreshCw, CheckCircle2 } from 'lucide-react';

interface CellUpdateModalProps {
  user: User;
  cells?: CellItem[];
  onCellUpdated: (newCell: string) => void;
}

export const CellUpdateModal: React.FC<CellUpdateModalProps> = ({ user, onCellUpdated }) => {
  const [cellInput, setCellInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cellValue = cellInput.trim();

    if (!cellValue) {
      setError('새 소속 셀 이름을 입력해주세요.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('dfmc_token');
      const res = await fetch('/api/lobby/update-cell', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ cell_name: cellValue }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || '셀 정보 갱신에 실패했습니다.');
      }

      onCellUpdated(data.cell_name);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content animate-fade-in" style={{ padding: '24px', maxWidth: '420px', width: '90%' }}>
        <div style={{ textAlign: 'center', marginBottom: '16px' }}>
          <div style={{ 
            width: '48px', 
            height: '48px', 
            borderRadius: '50%', 
            background: 'var(--color-accent-light)', 
            color: 'var(--color-accent)', 
            display: 'inline-flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            marginBottom: '10px'
          }}>
            <RefreshCw size={24} />
          </div>
          <h3 style={{ fontSize: '18px', fontWeight: '800' }}>새학기/연말 셀 개편 안내</h3>
          <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginTop: '4px', lineHeight: 1.5 }}>
            <strong>{user.name}</strong> 성도님, 교회 셀 개편이 진행되었습니다.<br />
            배정받으신 새로운 소속 셀 이름을 직접 작성해주세요.
          </p>
        </div>

        {error && (
          <div style={{ padding: '10px 14px', background: 'var(--color-danger-light)', color: 'var(--color-danger)', borderRadius: 'var(--radius-md)', fontSize: '12.5px', marginBottom: '14px', lineHeight: 1.4 }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" style={{ fontWeight: '700', fontSize: '13px' }}>
              새 소속 셀 이름 (직접 작성)
            </label>
            <input
              type="text"
              className="form-input"
              placeholder="예: 1청년부 2셀, 장년 1셀 등"
              value={cellInput}
              onChange={(e) => setCellInput(e.target.value)}
              autoFocus
              required
              style={{ fontSize: '14px', padding: '10px 12px' }}
            />
            <p style={{ fontSize: '11.5px', color: 'var(--color-text-light)', marginTop: '6px' }}>
              * 교회에 등록된 셀 이름을 정확히 입력하셔야 성도 인증이 완료됩니다.
            </p>
          </div>

          <button 
            type="submit" 
            className="btn btn-primary btn-block" 
            disabled={loading || !cellInput.trim()}
            style={{ marginTop: '12px', padding: '10px', fontSize: '14px', fontWeight: '800' }}
          >
            {loading ? '성도 셀 검증 중...' : '새 소속 셀 확인 및 로비 입장'}
          </button>
        </form>
      </div>
    </div>
  );
};
