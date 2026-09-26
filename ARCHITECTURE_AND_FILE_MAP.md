## 2026-09-27 홈·피드 및 관리자 멤버십 구현

로컬 auth-preview에서 로그인 → 홈 요약 → 모임 피드 10개씩 조회를 연결했다. setClubMembership Callable Function으로 관리자 가입/해제·총무 지정과 3명 제한, 변경 기록, 홈 요약 동시 갱신을 구현했다. 상세 실행 방법·변경 파일 책임·남은 범위는 [구현 안내](docs/FEED_AND_MEMBERSHIP.md)를 따른다.

운영 계정 이전·일반 참여 쓰기 통합·feed/summary 원본 동기화·운영 Rules 교체와 배포는 아직 하지 않았다. 아래 이전 단계 설명은 해당 시점 기록이다.
## 2026-09-27 이메일 인증 1단계 구현

- client/src/firebase/emailAuth.ts: Firebase 이메일 가입/로그인, 인증 메일, 비밀번호 재설정, 로그아웃, 세션 관찰, uid 프로필 생성/복구.
- client/src/pages/EmailAuthPage.tsx: 기존 CSS를 사용하는 인증 화면. 오류/처리 중/미인증/프로필 복구 상태 제공.
- main.tsx: 개발 auth-preview 모드에서만 새 화면을 로드한다. 이 모드에서는 기존 인터셉터와 운영 시드 로직을 로드하지 않는다.
- firebase.auth-preview.json 및 firestore.auth-preview.rules: demo-moyoung 로컬 Auth/Firestore 전용. 자기 프로필만 조회/생성하며 역할 상승과 임의 필드 추가는 거부한다.
- client/tests/emailAuth.test.ts: 계정 흐름·프로필 복구·접근 거부 통합 테스트.

기존 운영 Auth/Rules를 교체하지 않았다. 기존 계정 소유권/숫자 ID 연결, 게스트 인증, 관리자 추가 인증, 앱 전체 Rules/Functions, 홈 summary와 피드는 다음 단계다. 이 구현을 운영 인증 전환 완료로 취급하지 않는다.
> 2026-09-27: 이 파일은 현재 구현 지도다. [docs/README.md](docs/README.md)와 [목표 아키텍처](docs/moyoung_firebase_fast_server_architecture.md)를 함께 읽는다. Auth·summary·통합 feed cursor·Rules·Functions는 아직 전환 목표다. 아래 인터셉터 전담 설명은 목표 Functions 분리를 금지하지 않는다. 배포 명령은 명시적 사용자 요청이 있을 때만 실행한다.

# 🗺️ DFMC 모영(Moyoung) 파일 구조 및 기능별 코드 수정 가이드

> **🤖 AI 어시스턴트 필독 주의사항 (CRITICAL ARCHITECTURE NOTE)**
> 1. 본 프로젝트의 프로덕션 환경([https://moyoung-abd47.web.app](https://moyoung-abd47.web.app))은 **Firebase Hosting 기반의 정적 Single Page Application(SPA)**으로 구동됩니다.
> 2. `server/` 디렉토리는 과거 로컬 Node.js/SQLite 환경용 레거시 코드이며, **프로덕션 런타임에는 전혀 실행되지 않습니다.**
> 3. 모든 API 요청(`/api/*`)은 **`client/src/firebase/apiInterceptor.ts`**가 브라우저의 `window.fetch`를 가로채(Monkey-patching) **Google Cloud Firestore 및 Firebase Storage와 직접 통신**하여 처리합니다.
> 4. **따라서 백엔드 API, 데이터베이스 로직, 비즈니스 규칙을 수정할 때는 `server/`가 아니라 반드시 `client/src/firebase/apiInterceptor.ts`를 수정해야 배포 시 프로덕션에 정상 반영됩니다.**
> 5. 수정 후 배포 명령어: `cmd /c "npm run build && npx firebase deploy --only hosting"`

---

## 📁 1. 전체 디렉토리 구조 트리

```text
DFMC_Moyoung/
├── client/                          # [프로덕션 프론트엔드 + 서버리스 엔진]
│   ├── src/
│   │   ├── components/              # 재사용 공통 모달 및 레이아웃 컴포넌트
│   │   │   ├── CellUpdateModal.tsx     # 셀 정보 수정/개편 팝업
│   │   │   ├── ClubAnalyticsModal.tsx  # 모영 방문 통계 대시보드 (일/주/월/랭킹)
│   │   │   ├── Header.tsx              # 상단 네비게이션 및 로고
│   │   │   ├── MobileBottomNav.tsx     # 모바일 하단 탭 바
│   │   │   ├── MyInfoModal.tsx         # 내 정보 보기 및 [버그 제보] 팝업
│   │   │   ├── PopupModal.tsx          # 공지 팝업
│   │   │   └── QuickSwitch.tsx         # 빠른 유저 전환 위젯 (개발용)
│   │   │
│   │   ├── firebase/                # [핵심] Firebase 설정 및 가짜 백엔드 인터셉터
│   │   │   ├── apiInterceptor.ts       # ★ 프로덕션 백엔드 엔진 (모든 /api/* 라우트 처리 및 Firestore CRUD)
│   │   │   ├── config.ts               # Firebase App, Firestore, Storage 초기화
│   │   │   ├── firebaseService.ts      # 시드 데이터 로드, 이미지 압축 & Storage 업로드 유틸
│   │   │   └── setupFirebase.ts        # 앱 시작 시 인터셉터 등록 엔트리포인트
│   │   │
│   │   ├── pages/                   # 주요 화면 페이지 단위 컴포넌트
│   │   │   ├── ClubDetailPage.tsx      # ★ 모영 상세 페이지 (피드, 글, 댓글, 이모지, 일정, 투표 전체 관리)
│   │   │   ├── HeadAdminPage.tsx       # 전체 관리자 대시보드 (모영 관리, 셀 일괄 개편, 공지, 총무 선임)
│   │   │   ├── LobbyPage.tsx           # 메인 로비 화면 (전체 모영 목록, 진행 중인 투표/일정 피드)
│   │   │   ├── LoginPage.tsx           # 로그인 화면 (아이디/실명 입력, 2차 이메일 OTP 인증 모달)
│   │   │   └── ServerAdminPage.tsx     # 서버 관리자 페이지 (도메인 메모, 버그 제보함, 시스템 통계)
│   │   │
│   │   ├── types.ts                 # TypeScript 공통 인터페이스 (User, Club, Post, Poll, Schedule 등)
│   │   ├── App.tsx                  # 전역 라우팅, 인증 세션 검증, 테마 및 상태 관리
│   │   ├── main.tsx                 # React 루트 렌더러 (setupFirebase 실행)
│   │   └── index.css / App.css      # 전역 스타일 및 반응형 모바일 디자인 시스템
│   │
│   ├── dist/                        # `npm run build` 결과물 (Firebase Hosting 배포 타겟)
│   └── package.json                 # 클라이언트 의존성 및 Vite 빌드 스크립트
│
├── server/                          # [참고용/레거시] 로컬 개발용 Express + SQLite 서버
│   └── src/                         # 프로덕션에서는 사용되지 않음
│
├── firebase.json                    # Firebase Hosting 및 리라이트 라우팅 규칙 정의
├── firestore.rules                  # Firestore 보안 규칙 (읽기/쓰기 권한)
├── storage.rules                    # Firebase Storage 보안 규칙
├── FULL_CHANGELOG.md                # 전체 개발 및 수정 내역 종합 기록서
└── package.json                     # 프로젝트 루트 스크립트 (`npm run build`)
```

---

## 🎯 2. 기능별 코드 수정 가이드 (Feature-to-File Map)

수정하고자 하는 기능이 있을 때, 아래 매핑 테이블을 확인하여 해당 파일들을 수정하면 됩니다.

---

### 🗳️ (1) 투표(Poll) 기능 수정
모영 피드 내 투표 개설, 투표 참여, 실시간 투표율 계산, 투표 마감 처리 등의 기능을 수정할 때:

| 수정 목적 | 수정해야 할 파일 | 상세 위치 및 주요 코드 |
|---|---|---|
| **투표 UI / 생성 / 참여 / 마감** | `client/src/pages/ClubDetailPage.tsx` | • 투표 생성 폼 모달 (`showPollModal`, `handleCreatePoll`)<br>• 투표 참여 및 옵션 선택 (`handleVote`)<br>• 관리자 수동 투표 마감 버튼 (`handleClosePoll`)<br>• 진행 중인 투표 렌더링 (`activePolls.map`) |
| **투표 백엔드 API & DB 로직** | `client/src/firebase/apiInterceptor.ts` | • `POST /api/clubs/:id/polls` (투표 생성)<br>• `POST /api/clubs/:id/polls/:pollId/vote` (투표 참여/변경)<br>• `POST /api/clubs/:id/polls/:pollId/close` (투표 마감)<br>• `GET /api/clubs/:id` 내 polls 데이터 매핑 (득표수 집계, 마감 판별) |
| **투표 데이터 타입** | `client/src/types.ts` | • `interface Poll`, `interface Vote` 타입 정의 |
| **Firestore 컬렉션** | Cloud Firestore | • 컬렉션명: **`club_polls`** (문서 ID: `poll_{id}`) |

---

### 📅 (2) 일정(Schedule) & 참석/취소 기능 수정
모임 일정 등록, 달력/시간/회비 설정, 참석 신청 및 참석 취소 토글, 로비 화면 임박 일정 노출 등을 수정할 때:

| 수정 목적 | 수정해야 할 파일 | 상세 위치 및 주요 코드 |
|---|---|---|
| **일정 UI / 참석 토글 버튼** | `client/src/pages/ClubDetailPage.tsx` | • 일정 등록 모달 (`handleCreateSchedule`, 달력/시간/회비 기본값)<br>• 참석 토글 핸들러 (`handleToggleAttendance`)<br>• 버튼 디자인: `🙋‍♂️ 참석 신청` ↔ `❌ 참석 취소` 조건부 렌더링<br>• 참석자 명단 리스트 렌더링 |
| **로비 화면 노출 정책** | `client/src/pages/LobbyPage.tsx`<br>`client/src/components/MobileBottomNav.tsx` | • 메인 홈 화면의 '모집 중인 모영 일정' 렌더링 (각 모영당 가장 임박한 1개 일정 노출)<br>• 하단 탭 바의 '일정' 탭 클릭 시 해당 섹션으로 부드러운 스크롤 이동 |
| **일정 백엔드 API & 로비 집계** | `client/src/firebase/apiInterceptor.ts` | • `GET /api/lobby/data` (각 모영별 다가오는 일정 중 가장 임박한 1개씩 선별 및 날짜순 정렬)<br>• `POST /api/clubs/:id/schedules` (일정 생성)<br>• `POST /api/clubs/:id/schedules/:schedId/attend` (참석 신청/취소 토글 & 중복 차단)<br>• `DELETE /api/clubs/:id/schedules/:schedId` (일정 삭제)<br>• `PUT /api/clubs/:id/schedules/:schedId/pin` (일정 상단 고정) |
| **일정 데이터 타입** | `client/src/types.ts` | • `interface Schedule`, `interface Attendee`, `interface ScheduleHighlight` 타입 정의 |
| **Firestore 컬렉션** | Cloud Firestore | • 컬렉션명: **`club_schedules`** (문서 ID: `sched_{id}`) |

---

### 📸 (3) 사진 첨부, 피드 게시글 & 압축 수정
사진 업로드 시 캔버스 압축, Firebase Storage 업로드, 피드 글 작성/수정/삭제/상단 고정 등을 수정할 때:

| 수정 목적 | 수정해야 할 파일 | 상세 위치 및 주요 코드 |
|---|---|---|
| **피드 글 작성/수정/삭제 UI** | `client/src/pages/ClubDetailPage.tsx` | • 새 글 작성 영역 (`handleCreatePost`)<br>• 글 수정/삭제 (`handleUpdatePost`, `handleDeletePost`)<br>• 사진 파일 선택기 (`fileInputRef`, 이미지 미리보기)<br>• 글 상단 고정 토글 (`handleTogglePinPost`) |
| **이미지 압축 & Storage 업로드** | `client/src/firebase/firebaseService.ts` | • `uploadImageFile(file: File)`: 5초 타임아웃, Base64 fallback<br>• `compressImage(file, maxDim, quality)`: Canvas 기반 1200px 리사이징 & JPEG 75% 압축 |
| **게시글 백엔드 API & DB 로직** | `client/src/firebase/apiInterceptor.ts` | • `POST /api/clubs/upload-image` (FormData 이미지 수신 및 업로드)<br>• `POST /api/clubs/:id/posts` (글 생성, `imageUrl` & `image_url` 호환)<br>• `PUT /api/clubs/:id/posts/:postId` (글 수정)<br>• `DELETE /api/clubs/:id/posts/:postId` (글 삭제) |
| **게시글 데이터 타입** | `client/src/types.ts` | • `interface Post` 타입 정의 |
| **Firestore & Storage** | Cloud Firestore / Storage | • 컬렉션명: **`club_posts`** (문서 ID: `post_{id}`)<br>• 스토리지 경로: `uploads/{timestamp}_{random}.jpg` |

---

### 💬 (4) 댓글 및 이모지 반응(Reaction) 기능 수정
게시글 및 일정에 달리는 댓글과 6종 이모지 반응(좋아요, 하트, 축하 등) 및 낙관적 UI를 수정할 때:

| 수정 목적 | 수정해야 할 파일 | 상세 위치 및 주요 코드 |
|---|---|---|
| **댓글/이모지 UI (낙관적 UI)** | `client/src/pages/ClubDetailPage.tsx` | • 이모지 클릭 핸들러 (`handleToggleReaction` - 0ms 즉각 반응)<br>• 댓글 작성/삭제 핸들러 (`handleAddComment`, `handleDeleteComment`)<br>• 댓글 리스트 및 이모지 카운트 렌더링 |
| **댓글/이모지 백엔드 API** | `client/src/firebase/apiInterceptor.ts` | • `POST /api/clubs/:id/reactions` (이모지 토글)<br>• `POST /api/clubs/:id/comments` (댓글 작성)<br>• `DELETE /api/clubs/:id/comments/:commentId` (댓글 삭제)<br>• Map 해시 매칭을 통한 O(1) 댓글/반응 사전 정렬 |
| **댓글/반응 데이터 타입** | `client/src/types.ts` | • `interface Comment`, `interface Reaction` |
| **Firestore 컬렉션** | Cloud Firestore | • 컬렉션명: **`club_comments`**, **`club_reactions`** |

---

### 🔐 (5) 회원가입, 로그인, 게스트 모드 및 2단계 OTP 수정
성도 로그인, 소속 셀 입력 회원가입, 게스트 모드(로그인 없이 일정 참석), 관리자 2단계 OTP 인증 등을 수정할 때:

| 수정 목적 | 수정해야 할 파일 | 상세 위치 및 주요 코드 |
|---|---|---|
| **로그인 / 게스트 진입 화면** | `client/src/pages/LoginPage.tsx` | • 아이디 & 실명 로그인 폼<br>• 로그인 버튼 하단 **[게스트로 참여하기]** 버튼 & 입력 모달 (이름, 지인 이름)<br>• 서버 관리자 2단계 이메일 OTP 입력 팝업 |
| **비로그인 & 게스트 권한 가드** | `client/src/App.tsx`<br>`client/src/pages/LobbyPage.tsx`<br>`client/src/components/Header.tsx`<br>`client/src/components/MobileBottomNav.tsx` | • 로그인 없이도 기본 홈(로비) 화면 접근 허용<br>• 게스트의 유일한 권한: **홈화면에서 일정 참석하기/취소**<br>• 게스트 및 비로그인 유저의 모영 피드 진입 차단 가드<br>• 상단 헤더 관리자 직책 위치에 **`게스트`** 뱃지 렌더링 |
| **회원가입 화면** | `client/src/pages/RegisterPage.tsx` | • 소속 셀 직접 입력 검증 폼 (`cellName`) |
| **인증 & 게스트 백엔드 API** | `client/src/firebase/apiInterceptor.ts` | • `POST /api/auth/guest-login` (게스트 유저 생성 & 토큰 발급)<br>• `POST /api/auth/login` (유저 조회, 관리자 판별 및 OTP 코드 생성)<br>• `POST /api/auth/verify-otp` (OTP 대조 및 토큰 발급)<br>• `POST /api/auth/register` (신규 성도 Firestore 등록) |
| **Firestore 컬렉션** | Cloud Firestore | • 컬렉션명: **`users`** (문서 ID: 유저 username), **`church_members`** |

---

### 🏛️ (6) 셀(Cell) 관리 및 개편 기능 수정
단일 셀 추가, 전체 셀 일괄 개편(엔터키 추가, 전체 삭제), 모바일 셀 목록 렌더링 등을 수정할 때:

| 수정 목적 | 수정해야 할 파일 | 상세 위치 및 주요 코드 |
|---|---|---|
| **셀 관리 팝업 & 모바일 UI** | `client/src/pages/HeadAdminPage.tsx`<br>`client/src/components/CellUpdateModal.tsx` | • 단일 셀 추가 폼 및 즉시 반영 리스트<br>• 일괄 개편 모달 (엔터키 자동 다음 줄, 전체 삭제 버튼)<br>• 셀 목록 접기/펼치기 아코디언 및 폰트 레이아웃 |
| **셀 백엔드 API** | `client/src/firebase/apiInterceptor.ts` | • `GET /api/cells` (전체 셀 조회)<br>• `POST /api/cells` (단일 셀 추가)<br>• `POST /api/cells/batch` (일괄 개편 및 유저 셀 정보 동기화)<br>• `DELETE /api/cells/:id` (셀 삭제) |
| **Firestore 컬렉션** | Cloud Firestore | • 컬렉션명: **`cells`** (문서 ID: 셀 id) |

---

### 📊 (7) 모영 방문 통계(Analytics) & 조회수 수정
피드 방문 시 세션 카운팅, 일자/주/월/랭킹 조회수 차트 대시보드를 수정할 때:

| 수정 목적 | 수정해야 할 파일 | 상세 위치 및 주요 코드 |
|---|---|---|
| **통계 대시보드 팝업 UI** | `client/src/components/ClubAnalyticsModal.tsx` | • 일자별/주별/월별/랭킹 탭 전환<br>• 막대 차트 및 방문 지표 렌더링 |
| **방문 카운팅 트리거** | `client/src/pages/ClubDetailPage.tsx` | • 모영 진입 시 1회 카운트 (`POST /api/clubs/:id/visit`) |
| **통계 백엔드 집계 API** | `client/src/firebase/apiInterceptor.ts` | • `POST /api/clubs/:id/visit` (일자별 방문수 증가 및 누적 저장)<br>• `GET /api/admin/club-analytics` (일자/주/월/모영별 랭킹 데이터 산출) |
| **Firestore 컬렉션** | Cloud Firestore | • 컬렉션명: **`club_views`** (문서 ID: `{clubId}_{YYYY-MM-DD}`), **`clubs`** |

---

### 🧰 (8) 고객센터 & 버그 제보함 수정
성도가 버그/문의를 제보하고 서버 관리자가 이를 조회/관리하는 기능을 수정할 때:

| 수정 목적 | 수정해야 할 파일 | 상세 위치 및 주요 코드 |
|---|---|---|
| **성도 버그 제보 팝업 UI** | `client/src/components/MyInfoModal.tsx` | • 내 정보 모달 내 '버그 제보' 버튼 및 작성 모달 (`showBugModal`) |
| **관리자 제보함 조회 UI** | `client/src/pages/ServerAdminPage.tsx` | • 접수된 버그 제보 목록 테이블 및 처리 상태 |
| **버그 제보 백엔드 API** | `client/src/firebase/apiInterceptor.ts` | • `POST /api/feedback` (버그 제보 등록)<br>• `GET /api/admin/feedbacks` (관리자 제보 목록 조회) |
| **Firestore 컬렉션** | Cloud Firestore | • 컬렉션명: **`feedbacks`** |

---

## 🛠️ 3. 개발 및 배포 표준 절차 (Cheatsheet)

### 1) 로컬 개발 서버 실행
```powershell
# 클라이언트 Vite 개발 서버 실행
cd d:\Project\DFMC_Moyoung\client
npm run dev
```

### 2) 코드 수정 후 빌드 검증 및 프로덕션 배포
```powershell
# 프로젝트 루트에서 한 번에 빌드 및 배포
cd d:\Project\DFMC_Moyoung
cmd /c "npm run build && npx firebase deploy --only hosting"
```

### 3) 코드 수정 시 반드시 지켜야 할 3대 원칙
1. **API 수정 시**: `server/`를 건드리지 말고 반드시 **`client/src/firebase/apiInterceptor.ts`**에 라우트를 추가/수정할 것.
2. **새 필드 추가 시**: `apiInterceptor.ts`에서 읽을 때 카멜케이스(`imageUrl`)와 스네이크케이스(`image_url`)를 둘 다 방어적으로 지원할 것.
3. **사용자 인터랙션 구현 시**: 불필요한 전체 새로고침(`loadClubData()`)을 호출해 화면이 깜빡이지 않도록, 상태 업데이트 함수(`setData`)를 사용해 **0ms 낙관적 UI(Optimistic UI)**로 먼저 화면에 반영할 것.

## 2026-09-27 로컬 참여·피드 후처리
참여 UI와 직접 write, Rules, 참여 집계 트리거, 원본→피드 동기화 및 예약 종료를 추가했다. 파일별 책임과 검증: [참여/후처리](docs/PARTICIPATION_AND_PROJECTION.md). 기존 운영 apiInterceptor와 레거시 server는 이 단계에서 바꾸지 않았다.

## 2026-09-27 홈 요약 자동 갱신
functions/src/homeProjection.js·homeTriggers.js가 일정 변경과 시간 경과를 회원 홈으로 전파한다. feedReader.ts/MemberHomePage.tsx가 한 문서 구독으로 화면을 갱신한다. [설계·파일 목록·검증](docs/HOME_SUMMARY_IMPLEMENTATION.md).

## 2026-09-27 데이터 이전 미리보기
functions/src/migrationPreview.js와 scripts/previewMigration.mjs가 로컬 JSON의 원본·모임·계정 연결을 검사한다. 기존 앱 경로에는 연결하지 않는다. [입력·출력·제한](docs/MIGRATION_PREVIEW.md).

## 2026-09-27 로컬 백필 리허설
functions/src/localBackfill.js가 기존 피드/홈 후처리를 재사용하고, scripts/rehearseBackfill.mjs가 입력·보고서를 처리한다. 고정된 별도 에뮬레이터 DB만 사용한다. [파일·검증](docs/LOCAL_BACKFILL.md).

기본 로컬 실행: START_MOYOUNG_PREVIEW.cmd → ui-preview → 기존 App/화면. config.ts의 개발 모드 분기로 demo-moyoung-ui의 Firestore 8082/Storage 9198을 사용한다. auth-preview는 별도 기술 검증 실행으로 유지한다.

## 2026-09-27 배포 후 상태
기존 App/화면이 Hosting에 배포되었다. main.tsx의 DEV 모드 분리로 auth-preview는 운영 진입점이 아니다. 새 인증·summary/feed·참여·Functions/Rules는 로컬 검증 단계다. prepareUiRoles.mjs는 demo-moyoung-ui의 로컬 전체관리자/풋살 총무만 만든다. [누적 파일·상태](docs/README.md).
