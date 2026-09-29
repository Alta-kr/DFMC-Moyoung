import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

// Must match CONSENT_VERSION/CONSENT_ITEMS in functions/src/legacyAuth.js. Bump both when the text changes.
export const CONSENT_VERSION = '2026-09-29';
// Pressing the signup/guest button counts as agreeing to every item below.
export const FULL_CONSENTS = { terms: true, privacy: true, age14: true };

interface Doc { title: string; sections: [string, string][] }

const TERMS: Doc = {
  title: '이용약관',
  sections: [
    ['제1조 목적', '이 약관은 둔산제일교회 모영(이하 "모영") 커뮤니티 웹사이트(이하 "서비스")의 이용 조건과 절차, 이용자와 운영진의 권리·의무를 정합니다.'],
    ['제2조 이용 대상', '서비스는 둔산제일교회 교인과 교인의 지인을 위한 비영리 교회 동호회 공간입니다. 가입 시 입력한 소속 셀 또는 지인 정보로 교인 여부를 확인하며, 확인되지 않거나 사실과 다른 경우 이용이 제한될 수 있습니다.'],
    ['제3조 계정', '회원은 본인의 실명과 아이디로 가입하고 로그인합니다. 타인의 이름이나 아이디를 사용하거나 사칭해서는 안 됩니다. 계정 관리 책임은 회원 본인에게 있습니다.'],
    ['제4조 이용자의 의무', '회원은 다음 행위를 해서는 안 됩니다.\n1. 타인을 비방하거나 명예를 훼손하는 행위\n2. 음란물, 광고, 영리 목적의 홍보물 게시\n3. 다른 사람의 개인정보(연락처, 사진 등)를 동의 없이 게시하는 행위\n4. 서비스 운영을 방해하거나 비정상적인 방법으로 접근하는 행위\n5. 그 밖에 법령이나 교회 공동체 질서에 어긋나는 행위'],
    ['제5조 게시물', '게시물의 권리와 책임은 작성자에게 있습니다. 운영진은 제4조를 위반한 게시물을 사전 통지 없이 숨기거나 삭제할 수 있습니다. 회원은 신고 기능으로 문제 게시물을 알릴 수 있습니다.'],
    ['제6조 이용 제한', '운영진은 이 약관을 위반한 회원의 서비스 이용을 일시 정지하거나 계정을 삭제할 수 있습니다.'],
    ['제7조 서비스 변경과 중단', '서비스는 무료로 제공되며, 운영상 필요에 따라 기능을 변경하거나 중단할 수 있습니다.'],
    ['제8조 책임의 제한', '운영진은 고의 또는 중대한 과실이 없는 한 서비스 이용과 관련하여 회원에게 발생한 손해에 대해 책임지지 않습니다. 회원 간 분쟁은 당사자가 해결하는 것을 원칙으로 합니다.'],
    ['제9조 약관 변경', '약관을 변경할 때는 시행 7일 전부터 서비스에 공지합니다. 회원에게 불리한 변경은 시행 30일 전부터 공지하고, 필요한 경우 다시 동의를 받습니다.'],
    ['부칙', `이 약관은 ${CONSENT_VERSION}부터 시행합니다.`],
  ],
};

const PRIVACY: Doc = {
  title: '개인정보 수집·이용 동의',
  sections: [
    ['수집 항목', '· 회원: 아이디, 이름(실명), 소속 셀 또는 교회 지인 이름\n· 게스트: 이름, 교회 지인 이름\n· 서비스 이용 중 생성: 회원 번호, 가입 일시, 약관 동의 일시, 로그인 세션 기록, 작성한 게시글·댓글·채팅, 일정 참석과 투표 기록, 올린 사진, 신고 내용\n· 자동 수집: 접속 IP 주소(과도한 요청 차단용, 암호화하여 짧게 보관)'],
    ['수집·이용 목적', '회원 식별과 로그인, 교인·지인 여부 확인, 모영 활동(피드·일정·투표·채팅) 제공, 부정 이용 방지와 신고 처리'],
    ['보유·이용 기간', '회원 탈퇴 또는 계정 삭제 시까지 보관하고, 이후 지체 없이 파기합니다. 로그인 세션 기록(최대 24시간 유효)과 요청 차단용 기록(10분 유효)은 만료 후 자동 삭제됩니다. 탈퇴와 삭제는 운영진에게 요청할 수 있습니다.'],
    ['지인 정보 안내', '가입 시 입력하는 지인 이름은 교인 확인 용도로만 사용합니다. 지인의 이름을 입력하기 전에 가능하면 본인에게 알려 주세요.'],
    ['개인정보 처리 위탁과 국외 이전', '서비스는 Google LLC의 Firebase를 이용해 운영됩니다.\n· 이전받는 자: Google LLC (Firebase 문의: firebase.google.com/support)\n· 이전 국가: 미국 (데이터 저장), 대한민국 (서버 처리)\n· 이전 항목: 위 수집 항목 전부\n· 이전 시기와 방법: 서비스 이용 시 네트워크를 통해 수시로 전송\n· 이용 목적: 데이터 저장과 서버 운영\n· 보유 기간: 위 보유·이용 기간과 같음'],
    ['이용자의 권리', '언제든지 본인 개인정보의 열람, 정정, 삭제, 처리 정지를 운영진에게 요구할 수 있습니다. 사이트의 신고·문의 기능이나 교회 사무실을 통해 요청해 주세요.'],
    ['민감정보', '서비스는 종교, 건강 등 민감정보를 수집하지 않습니다.'],
    ['동의를 거부할 권리', '개인정보 수집·이용에 동의하지 않을 수 있습니다. 다만 위 항목은 서비스 제공에 꼭 필요한 정보이므로, 동의하지 않으면 회원가입과 게스트 참여를 할 수 없습니다.'],
  ],
};

const AGE: Doc = {
  title: '만 14세 이상 확인',
  sections: [
    ['안내', '만 14세 미만 아동의 개인정보를 처리하려면 법정대리인의 동의가 필요합니다. 만 14세 미만은 이 화면에서 가입할 수 없으니 보호자와 함께 운영진에게 문의해 주세요.'],
  ],
};

const LINKS: { label: string; doc: Doc }[] = [
  { label: '이용약관', doc: TERMS },
  { label: '개인정보 수집·이용', doc: PRIVACY },
];

interface SignupConsentProps {
  action: string;
  dark?: boolean;
}

export const SignupConsent: React.FC<SignupConsentProps> = ({ action, dark }) => {
  const [openDoc, setOpenDoc] = useState<Doc | null>(null);
  const link = (label: string, doc: Doc) => (
    <button
      type="button"
      onClick={() => setOpenDoc(doc)}
      style={{ background: 'transparent', border: 'none', padding: 0, font: 'inherit', color: dark ? '#93c5fd' : 'var(--color-primary)', textDecoration: 'underline', cursor: 'pointer' }}
    >
      {label}
    </button>
  );

  return (
    <p style={{ fontSize: '11.5px', lineHeight: 1.6, color: dark ? '#94a3b8' : 'var(--color-text-muted)', margin: '0 0 12px' }}>
      {action} 버튼을 누르면 {LINKS.map((item, i) => <React.Fragment key={item.label}>{i > 0 && ', '}{link(item.label, item.doc)}</React.Fragment>)}에 모두 동의하고 {link('만 14세 이상', AGE)}임을 확인한 것으로 간주합니다.
      {openDoc && createPortal(
        <div className="modal-overlay" style={{ zIndex: 10000 }} onClick={() => setOpenDoc(null)}>
          <div className="modal-content animate-fade-in" style={{ maxWidth: '420px', maxHeight: '80vh', margin: '0 16px' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 18px', borderBottom: '1px solid var(--color-border)' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '800', color: 'var(--color-text-main)', margin: 0 }}>{openDoc.title}</h3>
              <button type="button" onClick={() => setOpenDoc(null)} title="닫기" style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', display: 'flex' }}>
                <X size={20} />
              </button>
            </div>
            <div style={{ padding: '14px 18px 18px', overflowY: 'auto', fontSize: '13px', lineHeight: 1.6, color: 'var(--color-text-main)' }}>
              {openDoc.sections.map(([heading, body]) => (
                <div key={heading} style={{ marginBottom: '12px' }}>
                  <div style={{ fontWeight: '700', marginBottom: '2px' }}>{heading}</div>
                  <div style={{ whiteSpace: 'pre-line', color: 'var(--color-text-muted)' }}>{body}</div>
                </div>
              ))}
            </div>
          </div>
        </div>,
        document.body
      )}
    </p>
  );
};
