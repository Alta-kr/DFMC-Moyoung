import React, { useState, useEffect } from 'react';
import { X, Check, Link as LinkIcon } from 'lucide-react';

interface ShareButtonProps {
  url?: string;
  title?: string;
}

export const ShareButton: React.FC<ShareButtonProps> = ({
  url: propUrl,
  title = '둔산제일교회 동호회 (DFMC 모영)'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // 공유할 URL 계산 (로컬 환경일 경우 실제 서비스 주소 반영)
  const getShareUrl = (): string => {
    if (propUrl) return propUrl;
    if (typeof window === 'undefined') return 'https://dfmc-moyoung.com';
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (isLocal) {
      return `https://dfmc-moyoung.com${window.location.search || ''}`;
    }
    return window.location.href;
  };

  const shareUrl = getShareUrl();

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  const handleCopyUrl = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(shareUrl);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = shareUrl;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopied(true);
      showToast('링크가 복사되었습니다.');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      showToast('링크 복사에 실패했습니다.');
    }
  };

  // 모달 오픈 시 배경 스크롤 방지
  useEffect(() => {
    if (!isOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen]);

  const encodedUrl = encodeURIComponent(shareUrl);
  const encodedTitle = encodeURIComponent(title);

  const handleKakaoShare = () => {
    if (navigator.share) {
      navigator.share({
        title,
        text: `${title}\n${shareUrl}`,
        url: shareUrl,
      }).catch(() => {
        handleCopyUrl();
      });
    } else {
      // 카카오톡 웹 공유 또는 링크 복사 폴백
      window.open(`https://story.kakao.com/s/share?url=${encodedUrl}&text=${encodedTitle}`, '_blank');
      handleCopyUrl();
    }
  };

  const handleMessageShare = () => {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const separator = isIOS ? '&' : '?';
    window.location.href = `sms:${separator}body=${encodeURIComponent(`${title}\n${shareUrl}`)}`;
  };

  return (
    <>
      {/* 1. 플로팅 공유 버튼 (우측 하단 원형 버튼) */}
      <button
        type="button"
        className="floating-share-btn"
        onClick={() => setIsOpen(true)}
        aria-label="공유하기"
        title="공유하기"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M15 3h6v6" />
          <path d="M10 14L21 3" />
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
        </svg>
      </button>

      {/* 2. 공유하기 모달 */}
      {isOpen && (
        <div className="share-modal-overlay" onClick={() => setIsOpen(false)}>
          <div
            className="share-modal-card animate-fade-in"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label="공유하기"
          >
            {/* 상단 헤더 */}
            <div className="share-modal-header">
              <h3 className="share-modal-title">공유하기</h3>
              <button
                type="button"
                className="share-modal-close"
                onClick={() => setIsOpen(false)}
                aria-label="닫기"
              >
                <X size={20} />
              </button>
            </div>

            {/* 3개 채널: 카카오톡, 메시지, 링크 */}
            <div className="share-channel-row">
              {/* 1. 카카오톡 */}
              <button
                type="button"
                className="share-channel-item"
                onClick={handleKakaoShare}
              >
                <div className="share-icon-wrap kakao-filled">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="#3C1E1E">
                    <path d="M12 3C6.477 3 2 6.477 2 10.767c0 2.76 1.87 5.178 4.708 6.486l-1.196 4.417c-.105.388.337.697.666.467l5.244-3.52c.191.018.384.027.578.027 5.523 0 10-3.477 10-7.767C22 6.477 17.523 3 12 3z" />
                  </svg>
                </div>
                <span className="share-channel-label">카카오톡</span>
              </button>

              {/* 2. 메시지 */}
              <button
                type="button"
                className="share-channel-item"
                onClick={handleMessageShare}
              >
                <div className="share-icon-wrap message-filled">
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                  </svg>
                </div>
                <span className="share-channel-label">메시지</span>
              </button>

              {/* 3. 링크 */}
              <button
                type="button"
                className="share-channel-item"
                onClick={handleCopyUrl}
              >
                <div className={`share-icon-wrap link-filled ${copied ? 'is-copied' : ''}`}>
                  {copied ? (
                    <Check size={24} color="#ffffff" strokeWidth={2.8} />
                  ) : (
                    <LinkIcon size={24} color="#ffffff" strokeWidth={2.4} />
                  )}
                </div>
                <span className="share-channel-label">
                  {copied ? '복사완료' : '링크'}
                </span>
              </button>
            </div>

            {/* 하단 URL 복사 영역 */}
            <div className="share-url-container">
              <span className="share-url-text">{shareUrl}</span>
              <button
                type="button"
                className={`share-url-copy-btn ${copied ? 'is-copied' : ''}`}
                onClick={handleCopyUrl}
              >
                {copied ? (
                  <>
                    <Check size={14} style={{ marginRight: '4px' }} />
                    복사완료
                  </>
                ) : (
                  'URL복사'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 토스트 알림 */}
      {toastMessage && (
        <div className="share-toast animate-fade-in">
          {toastMessage}
        </div>
      )}
    </>
  );
};
