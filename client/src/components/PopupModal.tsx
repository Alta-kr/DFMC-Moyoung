import React, { useState } from 'react';
import { PopupItem } from '../types';
import { X } from 'lucide-react';

interface PopupModalProps {
  popup: PopupItem;
  onClose: () => void;
}

export const PopupModal: React.FC<PopupModalProps> = ({ popup, onClose }) => {
  const [dontShowToday, setDontShowToday] = useState(false);

  const handleClose = () => {
    if (dontShowToday) {
      const todayStr = new Date().toISOString().split('T')[0];
      localStorage.setItem('dfmc_hide_popup_date', todayStr);
    }
    onClose();
  };

  const hasContentText = Boolean(popup.content_text && popup.content_text.trim());
  const hasImage = Boolean(popup.image_url && popup.image_url.trim());

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div 
        className="modal-content animate-fade-in" 
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '400px',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: 'var(--radius-xl)',
          overflow: 'hidden',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
          background: 'white',
        }}
      >
        {/* 1. Image-Only Mode: Photo completely fills the popup window edge-to-edge */}
        {hasImage && !hasContentText && (
          <div style={{
            position: 'relative',
            width: '100%',
            background: '#090d16',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
          }}>
            <img 
              src={popup.image_url} 
              alt={popup.title} 
              style={{
                width: '100%',
                height: 'auto',
                maxHeight: '72vh',
                objectFit: 'contain',
                display: 'block',
              }}
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
            {/* Floating close button */}
            <button
              onClick={handleClose}
              style={{
                position: 'absolute',
                top: '12px',
                right: '12px',
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: 'rgba(0, 0, 0, 0.65)',
                backdropFilter: 'blur(4px)',
                color: 'white',
                border: '1px solid rgba(255, 255, 255, 0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
                zIndex: 10,
              }}
              title="닫기"
            >
              <X size={18} />
            </button>
          </div>
        )}

        {/* 2. Photo + Text Mode: Image at top, Text box below */}
        {hasImage && hasContentText && (
          <div style={{ position: 'relative', width: '100%', maxHeight: '240px', overflow: 'hidden', backgroundColor: '#f1f5f9' }}>
            <img 
              src={popup.image_url} 
              alt={popup.title} 
              style={{ width: '100%', height: '100%', maxHeight: '240px', objectFit: 'cover', display: 'block' }}
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
            <button
              onClick={handleClose}
              style={{
                position: 'absolute',
                top: '12px',
                right: '12px',
                width: '30px',
                height: '30px',
                borderRadius: '50%',
                background: 'rgba(0, 0, 0, 0.6)',
                color: 'white',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                zIndex: 10,
              }}
              title="닫기"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {/* 3. Text Section (Rendered only when text content exists or when there's NO image at all) */}
        {(hasContentText || !hasImage) && (
          <div style={{ padding: '20px', overflowY: 'auto' }}>
            {!hasImage && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span className="badge badge-primary">교회 특별 공지</span>
                <button 
                  onClick={handleClose}
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)' }}
                >
                  <X size={18} />
                </button>
              </div>
            )}

            <h3 style={{ fontSize: '17px', fontWeight: '800', color: 'var(--color-text-main)', marginBottom: hasContentText ? '10px' : '0', lineHeight: 1.3 }}>
              {popup.title}
            </h3>

            {hasContentText && (
              <p style={{ fontSize: '13.5px', color: 'var(--color-text-muted)', lineHeight: 1.6, whiteSpace: 'pre-line' }}>
                {popup.content_text}
              </p>
            )}
          </div>
        )}

        {/* 4. Footer with Today Checkbox & Close */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between', 
          padding: '12px 18px', 
          background: 'var(--color-card-subtle)',
          borderTop: '1px solid var(--color-border)',
          flexShrink: 0
        }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer', color: 'var(--color-text-muted)', userSelect: 'none' }}>
            <input 
              type="checkbox" 
              checked={dontShowToday} 
              onChange={(e) => setDontShowToday(e.target.checked)} 
              style={{ accentColor: 'var(--color-primary)', cursor: 'pointer' }}
            />
            오늘 하루 보지 않기
          </label>

          <button 
            className="btn btn-sm btn-secondary" 
            onClick={handleClose}
            style={{ fontWeight: '700', padding: '6px 14px' }}
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
};
