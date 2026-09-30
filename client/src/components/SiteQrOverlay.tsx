import React, { useEffect, useRef, useState } from 'react';

// 홈 아래에 붙은 별도 QR 화면. 홈 맨 아래에서 일정 거리 이상 더 당겼다가 놓으면 튕기듯 올라와 화면을 꽉 채우고,
// QR 화면에서 위로 올리면(아래로 끌어내리면) 홈으로 돌아간다. QR이 반쯤 보이는 상태는 없다.
const PULL_TO_OPEN = 110;   // 이만큼 당기고 놓으면 연다
const PULL_TO_CLOSE = 90;   // QR 화면에서 이만큼 끌어내리면 닫는다
const RELEASE_MS = 140;     // 휠이 이 시간 동안 멈추면 "놓은" 것으로 본다

interface Props {
  // 당기는 동안 홈 화면을 살짝 끌어올려 보여 줄 대상
  pageRef: React.RefObject<HTMLElement | null>;
}

export const SiteQrOverlay: React.FC<Props> = ({ pageRef }) => {
  const [phase, setPhase] = useState<'closed' | 'open' | 'closing'>('closed');
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  useEffect(() => {
    const atBottom = () => window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
    let pull = 0, touchY: number | null = null, releaseTimer = 0;
    const nudge = (value: number) => {
      const el = pageRef.current;
      if (!el) return;
      el.style.transition = value ? 'none' : 'transform 0.3s cubic-bezier(0.22, 1, 0.36, 1)';
      // 고무줄처럼 당길수록 덜 움직인다
      el.style.transform = value ? `translateY(${-Math.min(60, value * 0.35)}px)` : '';
    };
    const release = () => {
      const state = phaseRef.current;
      if (state === 'closed' && pull >= PULL_TO_OPEN) setPhase('open');
      if (state === 'open' && pull >= PULL_TO_CLOSE) {
        setPhase('closing');
        window.setTimeout(() => setPhase('closed'), 320);
      }
      pull = 0;
      nudge(0);
    };
    // delta > 0: 아래로 내리는 동작(콘텐츠를 위로), delta < 0: 위로 올리는 동작
    const move = (delta: number) => {
      const state = phaseRef.current;
      if (state === 'closed') {
        if (!atBottom() || delta <= 0) { if (pull) { pull = 0; nudge(0); } return; }
        pull += delta;
        nudge(pull);
      } else if (state === 'open') {
        if (delta >= 0) { pull = 0; return; }
        pull += -delta;
      }
    };
    const onWheel = (e: WheelEvent) => {
      move(e.deltaY);
      window.clearTimeout(releaseTimer);
      releaseTimer = window.setTimeout(release, RELEASE_MS);
    };
    const onTouchStart = (e: TouchEvent) => { touchY = e.touches[0]?.clientY ?? null; pull = 0; };
    const onTouchMove = (e: TouchEvent) => {
      const y = e.touches[0]?.clientY;
      if (touchY === null || y === undefined) return;
      move(touchY - y);
      touchY = y;
    };
    const onTouchEnd = () => { touchY = null; release(); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && phaseRef.current === 'open') { pull = PULL_TO_CLOSE; release(); } };
    window.addEventListener('wheel', onWheel, { passive: true });
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onTouchEnd, { passive: true });
    window.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(releaseTimer);
      nudge(0);
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('keydown', onKey);
    };
  }, [pageRef]);

  // QR 화면이 떠 있는 동안 뒤의 홈이 스크롤되지 않게 한다.
  useEffect(() => {
    if (phase === 'closed') return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, [phase]);

  if (phase === 'closed') return null;
  return (
    <div className={`site-qr-page ${phase === 'closing' ? 'is-closing' : 'is-open'}`} role="dialog" aria-label="사이트 주소 QR">
      <img src="/site-qr.svg" alt="dfmc-moyoung.com QR 코드" className="site-qr-page-code" />
      <strong className="site-qr-page-url">dfmc-moyoung.com</strong>
      <button type="button" className="site-qr-page-back" onClick={() => { setPhase('closing'); window.setTimeout(() => setPhase('closed'), 320); }}>
        위로 올리면 홈으로
      </button>
    </div>
  );
};
