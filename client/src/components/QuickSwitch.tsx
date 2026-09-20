import React from 'react';
import { UserRole } from '../types';

interface QuickSwitchProps {
  currentRole?: UserRole;
  onSwitch: (role: UserRole) => void;
}

export const QuickSwitch: React.FC<QuickSwitchProps> = ({ currentRole, onSwitch }) => {
  return (
    <div className="quick-switch-bar">
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span style={{ color: '#94a3b8', fontSize: '11px' }}>⚡ 빠른 테스트:</span>
      </div>
      <div className="quick-switch-btns">
        <button
          onClick={() => onSwitch('server_admin')}
          className={`btn btn-sm ${currentRole === 'server_admin' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ padding: '3px 7px', fontSize: '11px', borderRadius: '4px' }}
        >
          서버관리자
        </button>
        <button
          onClick={() => onSwitch('head_admin')}
          className={`btn btn-sm ${currentRole === 'head_admin' ? 'btn-admin' : 'btn-secondary'}`}
          style={{ padding: '3px 7px', fontSize: '11px', borderRadius: '4px' }}
        >
          전체 관리자
        </button>
        <button
          onClick={() => onSwitch('media_admin')}
          className={`btn btn-sm ${currentRole === 'media_admin' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ padding: '3px 7px', fontSize: '11px', borderRadius: '4px', background: currentRole === 'media_admin' ? '#7c3aed' : undefined, color: currentRole === 'media_admin' ? '#fff' : undefined }}
        >
          미디어관리자
        </button>
        <button
          onClick={() => onSwitch('member')}
          className={`btn btn-sm ${currentRole === 'member' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ padding: '3px 7px', fontSize: '11px', borderRadius: '4px' }}
        >
          회원(홍길동)
        </button>
      </div>
    </div>
  );
};
