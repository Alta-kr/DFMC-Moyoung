import React, { useState, useEffect } from 'react';
import { X, Check } from 'lucide-react';

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
      showToast('URL이 복사되었습니다.');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      showToast('URL 복사에 실패했습니다.');
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

  const handleChannelClick = (channel: string) => {
    switch (channel) {
      case 'blog':
        window.open(`https://share.naver.com/web/shareView.nhn?url=${encodedUrl}&title=${encodedTitle}`, '_blank');
        break;
      case 'cafe':
        window.open(`https://share.naver.com/web/shareView.nhn?serviceCode=cafe&url=${encodedUrl}&title=${encodedTitle}`, '_blank');
        break;
      case 'keep':
        window.open(`https://share.naver.com/web/shareView.nhn?serviceCode=keep&url=${encodedUrl}&title=${encodedTitle}`, '_blank');
        break;
      case 'band':
        window.open(`https://band.us/plugin/share?body=${encodedTitle}%0A${encodedUrl}&route=${encodedUrl}`, '_blank');
        break;
      case 'line':
        window.open(`https://social-plugins.line.me/lineit/share?url=${encodedUrl}`, '_blank');
        break;
      case 'friends':
        // 문자 또는 시스템 네이티브 공유
        if (navigator.share) {
          navigator.share({ title, text: title, url: shareUrl }).catch(() => {});
        } else {
          window.location.href = `sms:?&body=${encodedTitle}%20${encodedUrl}`;
        }
        break;
      case 'kakaotalk':
        if (navigator.share) {
          navigator.share({ title, text: title, url: shareUrl }).catch(() => {
            handleCopyUrl();
          });
        } else {
          handleCopyUrl();
        }
        break;
      case 'kakaostory':
        window.open(`https://story.kakao.com/s/share?url=${encodedUrl}&text=${encodedTitle}`, '_blank');
        break;
      case 'twitter':
        window.open(`https://twitter.com/intent/tweet?text=${encodedTitle}&url=${encodedUrl}`, '_blank');
        break;
      case 'facebook':
        window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`, '_blank');
        break;
      case 'mail':
        window.location.href = `mailto:?subject=${encodedTitle}&body=${encodedUrl}`;
        break;
      default:
        break;
    }
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

            {/* 공유 채널 그리드 (네이버/SNS 채널) */}
            <div className="share-channel-grid">
              {/* 1. 블로그 */}
              <button
                type="button"
                className="share-channel-item"
                onClick={() => handleChannelClick('blog')}
              >
                <div className="share-icon-wrap naver-outline">
                  <span style={{ color: '#03c75a', fontWeight: '800', fontSize: '20px', fontFamily: 'sans-serif' }}>b</span>
                </div>
                <span className="share-channel-label">블로그</span>
              </button>

              {/* 2. 카페 */}
              <button
                type="button"
                className="share-channel-item"
                onClick={() => handleChannelClick('cafe')}
              >
                <div className="share-icon-wrap naver-outline">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#03c75a" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 8h1a4 4 0 0 1 0 8h-1" />
                    <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" />
                    <line x1="6" y1="1" x2="6" y2="4" />
                    <line x1="10" y1="1" x2="10" y2="4" />
                    <line x1="14" y1="1" x2="14" y2="4" />
                  </svg>
                </div>
                <span className="share-channel-label">카페</span>
              </button>

              {/* 3. Keep */}
              <button
                type="button"
                className="share-channel-item"
                onClick={() => handleChannelClick('keep')}
              >
                <div className="share-icon-wrap naver-outline">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="#03c75a" stroke="#03c75a" strokeWidth="1">
                    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                  </svg>
                </div>
                <span className="share-channel-label">Keep</span>
              </button>

              {/* 4. 밴드 */}
              <button
                type="button"
                className="share-channel-item"
                onClick={() => handleChannelClick('band')}
              >
                <div className="share-icon-wrap band-filled">
                  <span style={{ color: '#ffffff', fontWeight: '900', fontSize: '20px', fontFamily: 'sans-serif' }}>b</span>
                </div>
                <span className="share-channel-label">밴드</span>
              </button>

              {/* 5. 라인 */}
              <button
                type="button"
                className="share-channel-item"
                onClick={() => handleChannelClick('line')}
              >
                <div className="share-icon-wrap line-filled">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="#ffffff">
                    <path d="M12 2C6.48 2 2 5.92 2 10.75c0 3.12 1.9 5.86 4.77 7.29-.21.78-.76 2.83-.87 3.27-.14.54.2.53.42.39.29-.19 3.99-2.65 4.58-3.05.7.1 1.4.15 2.1.15 5.52 0 10-3.92 10-8.75S17.52 2 12 2z" />
                  </svg>
                </div>
                <span className="share-channel-label">라인</span>
              </button>

              {/* 6. 친구 */}
              <button
                type="button"
                className="share-channel-item"
                onClick={() => handleChannelClick('friends')}
              >
                <div className="share-icon-wrap naver-outline">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="#03c75a">
                    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                  </svg>
                </div>
                <span className="share-channel-label">친구</span>
              </button>

              {/* 7. 카카오톡 */}
              <button
                type="button"
                className="share-channel-item"
                onClick={() => handleChannelClick('kakaotalk')}
              >
                <div className="share-icon-wrap kakao-filled">
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="#3C1E1E">
                    <path d="M12 3C6.477 3 2 6.477 2 10.767c0 2.76 1.87 5.178 4.708 6.486l-1.196 4.417c-.105.388.337.697.666.467l5.244-3.52c.191.018.384.027.578.027 5.523 0 10-3.477 10-7.767C22 6.477 17.523 3 12 3z" />
                  </svg>
                </div>
                <span className="share-channel-label">카카오톡</span>
              </button>

              {/* 8. 카카오스토리 */}
              <button
                type="button"
                className="share-channel-item"
                onClick={() => handleChannelClick('kakaostory')}
              >
                <div className="share-icon-wrap kakaostory-filled">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="#ffffff">
                    <path d="M18.8 8.4h-5.2c-.4 0-.8-.4-.8-.8V2.4c0-.4-.4-.8-.8-.8H8.4C6 1.6 4 3.6 4 6v12c0 2.4 2 4.4 4.4 4.4h11.2c.4 0 .8-.4.8-.8V9.2c0-.4-.4-.8-.8-.8z" />
                  </svg>
                </div>
                <span className="share-channel-label">카카오스토리</span>
              </button>

              {/* 9. X (트위터) */}
              <button
                type="button"
                className="share-channel-item"
                onClick={() => handleChannelClick('twitter')}
              >
                <div className="share-icon-wrap twitter-filled">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="#ffffff">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                </div>
                <span className="share-channel-label">X</span>
              </button>

              {/* 10. 페이스북 */}
              <button
                type="button"
                className="share-channel-item"
                onClick={() => handleChannelClick('facebook')}
              >
                <div className="share-icon-wrap facebook-filled">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="#ffffff">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                  </svg>
                </div>
                <span className="share-channel-label">페이스북</span>
              </button>

              {/* 11. 메일 */}
              <button
                type="button"
                className="share-channel-item"
                onClick={() => handleChannelClick('mail')}
              >
                <div className="share-icon-wrap naver-outline">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#03c75a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="4" width="20" height="16" rx="2" />
                    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                  </svg>
                </div>
                <span className="share-channel-label">메일</span>
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
