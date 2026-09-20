import React, { useState } from 'react';
import { CellItem, User } from '../types';
import { RefreshCw, CheckCircle2 } from 'lucide-react';

interface CellUpdateModalProps {
  user: User;
  cells: CellItem[];
  onCellUpdated: (newCell: string) => void;
}

export const CellUpdateModal: React.FC<CellUpdateModalProps> = ({ user, cells, onCellUpdated }) => {
  const [selectedCell, setSelectedCell] = useState('');
  const [customInput, setCustomInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cellValue = selectedCell === 'custom' ? customInput.trim() : selectedCell;

    if (!cellValue) {
      setError('소속 셀을 선택하거나 입력해주세요.');
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
      <div className="modal-content animate-fade-in" style={{ padding: '24px' }}>
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
          <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginTop: '4px' }}>
            {user.name} 성도님, 교회 셀 개편이 진행되었습니다.<br />
            현재 소속되신 새로운 셀을 확인 및 설정해주세요.
          </p>
        </div>

        {error && (
          <div style={{ padding: '10px 14px', background: 'var(--color-danger-light)', color: 'var(--color-danger)', borderRadius: 'var(--radius-md)', fontSize: '13px', marginBottom: '14px' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">새 소속 셀 선택</label>
            <select 
              className="form-select"
              value={selectedCell}
              onChange={(e) => setSelectedCell(e.target.value)}
              required
            >
              <option value="">-- 소속 셀을 선택하세요 --</option>
              {cells.map((c) => (
                <option key={c.id} value={c.name}>{c.name}</option>
              ))}
              <option value="custom">직접 입력 (새 셀 or 인도자/성도 이름)</option>
            </select>
          </div>

          {selectedCell === 'custom' && (
            <div className="form-group">
              <label className="form-label">셀 또는 인도자/성도 이름</label>
              <input
                type="text"
                className="form-input"
                placeholder="예: 3청년부 1셀 또는 인도자 이름"
                value={customInput}
                onChange={(e) => setCustomInput(e.target.value)}
                required
              />
            </div>
          )}

          <button 
            type="submit" 
            className="btn btn-primary btn-block" 
            disabled={loading}
            style={{ marginTop: '8px' }}
          >
            {loading ? '확인 중...' : '새 소속 셀 저장 및 로비 입장'}
          </button>
        </form>
      </div>
    </div>
  );
};
