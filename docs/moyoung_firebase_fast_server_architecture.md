## 최신 구현 상태

로컬 홈·피드 조회와 관리자 멤버십 Functions까지 구현했다. [상세 범위와 검증](FEED_AND_MEMBERSHIP.md)을 먼저 읽는다. 아래의 현재 구현 표는 운영 경로와 초기 분석 시점의 기록이다.

## 2026-09-27 이메일 인증 1단계 구현

- client/src/firebase/emailAuth.ts: Firebase 이메일 가입/로그인, 인증 메일, 비밀번호 재설정, 로그아웃, 세션 관찰, uid 프로필 생성/복구.
- client/src/pages/EmailAuthPage.tsx: 기존 CSS를 사용하는 인증 화면. 오류/처리 중/미인증/프로필 복구 상태 제공.
- main.tsx: 개발 auth-preview 모드에서만 새 화면을 로드한다. 이 모드에서는 기존 인터셉터와 운영 시드 로직을 로드하지 않는다.
- firebase.auth-preview.json 및 firestore.auth-preview.rules: demo-moyoung 로컬 Auth/Firestore 전용. 자기 프로필만 조회/생성하며 역할 상승과 임의 필드 추가는 거부한다.
- client/tests/emailAuth.test.ts: 계정 흐름·프로필 복구·접근 거부 통합 테스트.

기존 운영 Auth/Rules를 교체하지 않았다. 기존 계정 소유권/숫자 ID 연결, 게스트 인증, 관리자 추가 인증, 앱 전체 Rules/Functions, 홈 summary와 피드는 다음 단계다. 이 구현을 운영 인증 전환 완료로 취급하지 않는다.
# Moyoung Firebase 서버 아키텍처

## 상태

2026-09-27 현재 코드와 사용자 요청을 비교한 목표 설계다. 이전 첨부 원문은 확보하지 못해 요청과 대화의 원칙을 재구성했다. 아래 비교표의 현재 열은 초기 운영 코드 기준이다. 이후 Auth·홈/피드·관리자 멤버십·참여·피드 후처리를 auth-preview에 구현했다. 운영 이전은 하지 않았다. 최신 범위는 [참여/후처리](PARTICIPATION_AND_PROJECTION.md)와 [홈/멤버십](FEED_AND_MEMBERSHIP.md)을 따른다.

| 영역 | 현재 | 목표 |
| --- | --- | --- |
| 인증 | 아이디/실명, dfmc_token 문자열에서 사용자 해석 | Firebase 이메일/비밀번호, auth uid |
| 초기화 | App/Firestore/Storage | Auth 상태 복원 추가 |
| 홈 | /api/lobby/data에서 여러 컬렉션과 전체 club_schedules 조회 | summary 중심 최소 조회 |
| 피드 | 상세 요청에서 다수 컬렉션 조회 후 UI 병합 | 모임별 통합 feed |
| pagination | feedTimeline.slice로 표시 제한 | 쿼리 limit(10) + cursor |
| 권한 | 로컬 firestore.rules의 allow read, write: if true | uid/멤버십 기반 Rules |
| 관리자 | 브라우저에서 관리 데이터 직접 변경 | Cloud Functions 검증 |
| 식별자 | username users, clubs/club_*, 숫자 id | 기존 ID 매핑을 보존하는 uid 모델 |

근거: client/src/firebase/config.ts, apiInterceptor.ts, client/src/pages/ClubDetailPage.tsx, firestore.rules, firebase.json. 실제 배포된 Rules는 조회하지 않았다. 현재 ‘서버리스’가 서버 권한 검증 완료를 뜻하지 않는다.

## 홈과 통합 feed

Auth 복원 → 최소 프로필/멤버십 → 홈 summary 순서로 빠르게 표시한다. 전체 회원·일정·피드를 선행 조회하지 않는다. 기존 캐시 즉시 표시 흐름을 유지하되 캐시는 권한 근거가 아니며 사용자 전환 시 캐시/구독을 정리한다.

모임별 feed는 카드용 최소 데이터와 원본 참조를 갖는다. 최초 최대 10개, 다음 페이지도 최대 10개이며 마지막 문서를 기준으로 cursor pagination한다. 전체 조회 후 slice하거나 offset을 사용하지 않는다.

고정 공지 100, 진행 일정 90, 진행 투표 80, 일반/종료 글 10으로 정렬한다. 우선순위 내 시간과 동률 ID 기준을 스키마에 명시하고 커서에도 동일한 정렬을 적용한다. 기존 고정 일반 글/일정과의 정책 충돌은 구현 전 매핑하며 일반 글을 자동으로 공지로 승격하지 않는다.

종료 상태/우선순위 전환은 서버 후처리 또는 예약 처리 책임으로 두고 실패 복구를 갖춘다. 페이지 간 순위 변경에 대해 ID 중복 제거와 새로고침 정책을 마련한다. 쿼리와 인덱스를 함께 관리하고 댓글/참여자 목록은 상세 조회로 분리한다.

## 데이터와 계정 매핑

목표 users/{uid}는 프로필, groups/{groupId}/members/{uid}는 멤버십/역할의 논리 모델이다. 기존 clubs를 groups로 무단 변경하라는 지시가 아니다. 실제 경로는 호환성과 이전 비용을 확인해 결정한다.

기존 username users, 숫자 user_id, clubs, club_posts, club_polls, club_schedules, club_comments, club_reactions와 uid/feed/summary 간 매핑을 먼저 기록한다. 이름/이메일 일치만으로 계정 병합이나 권한 부여를 하지 않는다. groupIds 등 편의 필드의 자가 수정으로 권한이 생기지 않아야 한다.

## Firebase Authentication

- 이름·이메일·비밀번호로 가입하고 Firebase uid로 허용된 프로필 필드만 생성한다.
- 비밀번호를 Firestore에 저장하거나 자체 비밀번호/JWT 서버를 추가하지 않는다.
- Auth 가입과 프로필 생성은 원자 작업이 아니므로 프로필 생성 실패 후 안전한 재시도를 지원한다.
- 이메일 인증, 비밀번호 재설정, 로그인 상태 복원, 로그아웃을 제공한다.
- 이메일 변경은 SDK의 재인증/새 주소 검증 흐름을 적용한다. 복제 이메일은 권한 기준이 아니다.
- 인증 전 기능, 게스트 신원, 관리자 추가 인증을 먼저 확정한다. 게스트가 무인증 임의 쓰기 허용을 뜻하지 않는다.
- Auth는 신원, Rules는 접근 권한, App Check는 앱 요청 검증을 담당한다. App Check는 권한 검증을 대체하지 않는다.

## 일반 사용자 쓰기

참석·투표·댓글·하트/기존 반응은 optimistic UI → 직접 Firestore write → 확정 흐름이다. 거부/실패 시 복구와 재시도, pending 표시, 중복 입력 방지를 제공한다. 전체 재조회로 화면을 깜빡이지 않는다.

Rules는 auth uid, 멤버십, 작성자 일치, 대상 상태, 허용 필드/타입/변경 범위를 검증한다. 타인 데이터 변경, 마감 후 참여, 역할/집계/우선순위 조작을 차단한다. 게스트는 허용된 홈 일정 참석만 접근한다.

참여 원본은 즉시 검증하고 feed/summary 집계·알림은 Functions 후처리로 분리한다. 식별자와 트랜잭션/배치 필요성을 검토해 중복 참여/재시도에 안전하게 한다. 직접 쓰기로 보장할 수 없는 업무 제약은 서버 경유 예외의 이유를 문서화한다.

## 관리자와 후처리

역할 변경·총무 민감 작업·권한 관련 멤버십 변경·탈퇴 정리는 Cloud Functions에서 처리한다. 서버 SDK가 Rules를 자동 적용한다고 가정하지 말고 호출자 인증/권한과 입력을 서버에서도 검증한다.

일반 참여에 선행 Functions 왕복을 추가하지 않는다. 집계/피드 동기화는 중복 이벤트와 재시도에 안전하게 하며 중복 집계 증가를 막고 원본에서 재계산/복구할 경로를 마련한다.

탈퇴는 Auth, 프로필, 멤버십, 참여 데이터, 작성물/집계의 삭제·보존·익명화 정책을 먼저 정하고 부분 실패 후 재시도 가능하게 한다.

## 단계적 전환

1. 계정 소유권/uid, 게스트/추가 인증 정책, 컬렉션 매핑을 확정한다.
2. 격리된 Emulator에서 Auth·프로필·멤버십·Rules를 함께 구현하고 기존 화면 계약을 유지한다.
3. 민감 작업을 Functions로 옮기고 클라이언트 직접 권한 변경을 차단한다.
4. summary/feed를 재실행 안전하게 백필하고 원본 대비 개수·참조·정렬을 검증한다. 롤백 계획을 갖춘다.
5. 홈/피드 조회를 단계적으로 전환한다. Auth 준비 없이 Rules만 잠가 기존 사용자를 차단하지 않고, 공개 Rules를 목표로 유지하지 않는다.
6. 명시적 배포 요청과 기존 운영 절차를 따른다. Hosting·Rules·Functions·인덱스의 의존 순서를 계획한다.

## 구현 시 검증

최초/추가 조회 10개 제한, 동률 커서·중복·종료 전환, 느린 네트워크 첫 화면, 쓰기 거부 UI 복구, 가입 중 프로필 실패를 검증한다. Rules 테스트는 미인증/비회원/타인 데이터/권한 상승/게스트 피드 접근 거부를 포함한다. Functions는 무권한 호출과 중복 이벤트를 검증한다. 로컬 구현 검증 범위와 실행 명령은 위 구현 문서에 기록한다.

## 홈 요약 구현 갱신
원본 일정→피드→모임 요약→회원 홈 전파와 홈 한 문서 구독을 로컬 구현했다. [홈 요약 구현](HOME_SUMMARY_IMPLEMENTATION.md)에 선택 정책·경합 보호·재시도·검증과 운영 전환 제한을 기록한다.

## 2026-09-27 운영 배포 범위
기존 UI Hosting만 배포 완료했다. 이 문서의 신규 Auth/Rules/통합 feed/Functions 설계가 운영에 전환된 것은 아니다. 기존 화면 스타일을 유지한 기능 통합과 계정·데이터 이전이 남아 있다. [최신 구현·배포·검증 상태](README.md)를 기준으로 완료 범위를 판단한다.
