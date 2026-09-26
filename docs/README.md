# Moyoung 개발 문서

2026-09-27 실제 저장소 D:/Project/DFMC_Moyoung의 코드와 문서를 확인해 작성했다. 초기 문서 정리 후 로컬 인증·홈·피드·관리자 멤버십·후처리·이전 검증을 구현했다. 이후 기존 UI를 Hosting에 배포했다. 신규 구조의 운영 통합과 데이터 이전은 아직 하지 않았다.

이전 대화와 현재 요청의 원칙을 반영했다. 이전 대화의 동명 Markdown 첨부 본문은 확보되지 않았으므로 서버 문서는 원본 복사본이 아닌 원칙의 재구성이다.

## 현재 상태 — 2026-09-27 배포 후

**기존 UI의 Hosting 배포는 완료했다. 신규 Firebase 인증·통합 피드 구조는 로컬 검증 단계이며 기존 운영 화면과의 통합은 미완료다.**

| 범위 | 구현/검증 상태 | 운영 반영 |
| --- | --- | --- |
| 기존 App·로그인·로비·모임 상세와 CSS | 사용자 파일을 UI 기준으로 유지 | Hosting 배포 완료 |
| Firebase 이메일/비밀번호·프로필 복구·인증 상태 | auth-preview 구현/검증 | 미전환 |
| 홈 summary 한 문서 구독·통합 feed 10개 cursor | auth-preview 구현/검증 | 미전환 |
| 참석·투표·댓글·하트 직접 쓰기/즉시 반영/실패 복구 | auth-preview 구현/검증 | 미전환 |
| 관리자 멤버십·총무 3명 제한·감사 기록 | Callable Functions 구현/검증 | Functions 미배포 |
| 참여 집계·원본 피드 동기화·종료 처리 | 중복/재시도·삭제·마감 검증 | Functions 미배포 |
| 일정 변경→모임/회원 홈 전파·예약 교체 | 경합 보호·구독 검증 | Functions 미배포 |
| uid·멤버십 기반 Rules/쿼리 인덱스 | 로컬 전용 파일로 검증 | 미배포 |
| 이전 미리보기·백필/피드/홈 대조 | 로컬 JSON·별도 에뮬레이터 검증 | 운영 이전 없음 |

### 이번 배포

- 대상: moyoung-abd47, [운영 사이트](https://moyoung-abd47.web.app).
- 명령: firebase deploy --only hosting --project moyoung-abd47 --non-interactive.
- 결과: release complete / Deploy complete 확인. 운영 HTTP 200 및 배포 번들 index-Bm3qO0-d.js 일치 확인.
- 배포 전 전체 npm run build 통과. 기존 500 kB 번들 경고는 남아 있다.
- Firestore/Storage 규칙, Functions, 인덱스는 이번에 배포하지 않았다. 실제 배포된 기존 규칙을 조회·검증한 것은 아니다.
- 운영 계정 생성·권한 변경·백필은 실행하지 않았다. Firebase CLI 인증 완료는 배포용 개발자 로그인이며 서비스 회원 인증 전환을 뜻하지 않는다.

### 실행 환경과 계정

| 실행 | 화면/데이터 | 주소 |
| --- | --- | --- |
| START_MOYOUNG_PREVIEW.cmd | 기존 UI / demo-moyoung-ui, Firestore 8082·Storage 9198 | http://127.0.0.1:3001 |
| START_AUTH_TEST_PREVIEW.cmd | 신규 기능 검증 UI / demo-moyoung, Auth 9099·Firestore 8080·Functions 5001 | http://127.0.0.1:3000 |
| 운영 Hosting | 기존 UI / moyoung-abd47 | https://moyoung-abd47.web.app |

기본 체험은 기존 UI다. 별도 검증 화면을 사용자 제품 화면으로 대체하지 않는다. 새 기능도 기존 화면 컴포넌트와 스타일을 유지하며 연결한다.

기존 UI 로컬 계정: 일반 회원 member1/홍길동, 전체관리자 previewadmin/체험관리자(head_admin), 풋살 총무 previewfutsal/체험총무(member + manager_names). 아이디/이름 방식이다. 총무는 샘플 명단 마지막 한 자리를 교체해 최대 3명을 유지했다. 운영에 복사하지 않았다.

관리자/총무 계정은 현재 로컬 세션에 별도로 생성했다. 에뮬레이터 재시작 후 자동 복원되지 않으므로 기존 UI를 열어 시드가 완료된 뒤 루트에서 node functions/scripts/prepareUiRoles.mjs를 실행한다. 인증 검증 계정 안내는 [직접 실행하기](TRY_PREVIEW.md)를 참고한다.

### 검증 기록

- 홈 요약 단계: 인증·피드·참여·관리자·후처리·홈 구독을 포함한 자동 테스트 10개 통과.
- 이전 미리보기 단계: 신규 테스트 2개와 CLI 예시 통과.
- 백필 단계: 신규 테스트 1개 + 미리보기 2개, 합계 3개 통과. 샘플 보고서 matched:true.
- 위 숫자는 각 단계 실행 결과이며 한 번에 전체 테스트를 재실행한 결과가 아니다.
- 기존 UI 로컬 브라우저 표시, 로컬 역할 계정 저장 및 권한 필드, 운영 Hosting 응답을 확인했다. 운영 회원 로그인/참여 전 과정은 이번 배포 후 별도 검증하지 않았다.
- 예약 함수 로직은 직접 호출로 검증했다. 실제 Cloud Scheduler와 운영 인덱스, 대규모 부하는 미검증이다.

### 다음 작업

1. 기존 LoginPage/LobbyPage/ClubDetailPage 및 관리자 화면에 신규 Firebase 기능을 연결한다. UI를 별도 검증 화면으로 바꾸지 않는다.
2. 기존 계정 소유권/uid 매핑, 게스트·관리자 추가 인증 정책을 확정한다.
3. 실제 자료의 내보내기·입력 변환·완전성 확인, 분할 백필·진행 지점·복구/롤백을 준비한다.
4. 전역 역할 변경·탈퇴·모임 변경 정리, 앱 전체 Firestore/Storage 권한을 완성한다.
5. 기존 사용자를 차단하지 않는 전환 순서로 Rules·Functions·인덱스·화면을 배포하고 운영 검증한다.

### 추가·수정된 주요 파일

- 지침/문서: AGENTS.md, docs/*, ARCHITECTURE_AND_FILE_MAP.md, FULL_CHANGELOG.md, DEPLOYMENT.md.
- 진입/환경: client/src/main.tsx, client/src/firebase/config.ts, firebase.auth-preview.json, firebase.ui-preview.json.
- 검증 UI/클라이언트: EmailAuthPage.tsx, MemberHomePage.tsx, FeedParticipation.tsx, MembershipAdminPanel.tsx 및 firebase/emailAuth.ts, feedReader.ts, participation.ts, optimisticAction.ts, membershipAdmin.ts.
- 서버: functions/src/index.js, activityProjection.js, participationTrigger.js, feedProjection.js, feedTriggers.js, homeProjection.js, homeTriggers.js.
- 이전 준비: functions/src/migrationPreview.js, localBackfill.js 및 scripts/previewMigration.mjs, rehearseBackfill.mjs.
- 로컬 실행: START_MOYOUNG_PREVIEW.cmd, START_AUTH_TEST_PREVIEW.cmd, scripts/runPreview.mjs, functions/scripts/prepareUiRoles.mjs, prepareAdminPreview.mjs.
- 보안/검증: firestore.auth-preview.rules, firestore.preview.indexes.json, client/tests/*, functions/tests/*.
- 이전부터 작업 중이던 변경도 저장소에 있으므로 git diff 전체를 이번 작업에서 새로 만든 변경으로 해석하지 않는다. 이번 배포용 빌드는 현재 작업 폴더 전체를 사용했다.


## 읽는 순서

1. [AGENTS.md](../AGENTS.md): 기존 규칙과 목표
2. [TECH_STACK.md](TECH_STACK.md): 확인된 스택/명령
3. [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md): 파일별 책임
4. [PRODUCT.md](PRODUCT.md): 유지할 도메인 정책
5. [서버 아키텍처](moyoung_firebase_fast_server_architecture.md): 현재/목표 차이와 전환
6. [UI_FLOW.md](UI_FLOW.md): 화면 연결 지점과 목표 흐름

기존 [파일 지도](../ARCHITECTURE_AND_FILE_MAP.md), [배포 안내](../DEPLOYMENT.md), [변경 이력](../FULL_CHANGELOG.md)을 유지한다. 현재 구현/과거 이력과 목표를 구분한다. 서버 설계는 위 문서 하나를 기준으로 삼고 SERVER_ARCHITECTURE.md 복사본을 만들지 않는다. 원본 확보 시 비교·병합한다.


## 인증 구현 진행

[이메일 인증 로컬 검증](AUTH_IMPLEMENTATION.md): 1단계 코드가 추가되었으며 운영 전환은 아직 진행하지 않았다.


## 최신 구현 상태

[홈·피드 및 관리자 멤버십](FEED_AND_MEMBERSHIP.md): 조회/권한 코드, 로컬 실행, 테스트, 운영 전환 잔여 범위.

[참여 기능과 피드 후처리](PARTICIPATION_AND_PROJECTION.md): 직접 쓰기·낙관적 UI·안전한 집계·원본 동기화·예약 종료. 홈 요약 자동 전파는 아래 다음 단계 문서를 참고한다. 운영 이전은 남아 있다.

[홈 요약 자동 갱신](HOME_SUMMARY_IMPLEMENTATION.md): 일정 변경·시간 경과를 회원 홈에 전파하고 열린 화면에도 반영한다. 최신 단계의 변경 파일과 검증 결과를 포함한다.

[데이터 이전 미리보기](MIGRATION_PREVIEW.md): 오프라인 입력으로 피드 후보와 계정 연결 충돌을 검사한다. DB 적용 기능은 없다.

[로컬 백필 리허설](LOCAL_BACKFILL.md): 별도 에뮬레이터 DB에 백필하고 피드/홈 결과와 재실행 안전성을 확인한다.

[직접 실행하기](TRY_PREVIEW.md): 루트 START_MOYOUNG_PREVIEW.cmd 더블클릭으로 체험 계정·샘플 데이터·로컬 서버를 준비한다.

기본 체험은 기존 UI를 사용하는 3001 포트로 변경했다. 이메일/피드 검증 화면은 START_AUTH_TEST_PREVIEW.cmd로 분리했다. 최신 [직접 실행 안내](TRY_PREVIEW.md)를 따른다.
