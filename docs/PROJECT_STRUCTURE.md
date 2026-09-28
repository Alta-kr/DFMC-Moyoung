> **2026-09-28 최종 변경:** 사용자는 실명+아이디 로그인을 유지하기로 결정했다. 서버 세션·서버/미디어 관리자 OTP 및 DB 직접 접근 차단으로 전환했다. 아래 이메일/비밀번호 계획은 과거 기록이다. 코드/검증 상태와 운영 전제는 [보안 로그인 전환](SECURE_NAME_LOGIN.md)을 따른다. **아직 운영 미배포.**

# 기존 구조와 수정 지점

```text
DFMC_Moyoung/
  AGENTS.md / CLAUDE.md
  ARCHITECTURE_AND_FILE_MAP.md / DEPLOYMENT.md / FULL_CHANGELOG.md
  docs/
  client/src/
    App.tsx                    # 라우팅, 사용자 상태
    main.tsx                   # 앱 시작
    firebase/
      config.ts                # App/Firestore/Storage
      setupFirebase.ts         # 인터셉터 등록
      apiInterceptor.ts        # 현재 /api/* 호환 처리와 데이터 로직
      firebaseService.ts       # 로컬 ui-preview 시드; 사진 업로드 제거
    pages/                     # Login, Lobby, ClubDetail, HeadAdmin, ServerAdmin
    components/                # 헤더, 내 정보, 모달 등
    types.ts                   # 공통 타입
    index.css / App.css
  server/                      # 레거시 Express + SQLite
  firebase.json / firestore.rules / storage.rules
  package.json / package-lock.json
  data/ / scratch/ / .firebase/
```

Auth는 config.ts·LoginPage.tsx·App.tsx와 기존 인터셉터 계약을 함께 검토한다. 홈 summary는 LobbyPage.tsx와 /api/lobby/data, 통합 feed는 ClubDetailPage.tsx와 /api/clubs/:id에 연결한다. UI와 필드명 호환을 보존한다.

일반 쓰기는 기존 Firebase 계층을 사용하고 민감 작업은 새 Functions 계층으로 분리한다. functions/src/index.js에 멤버십 관리 Callable이 추가되었다. firebase.auth-preview.json에서만 로컬 실행한다. 레거시 server/를 Functions 대용으로 쓰지 않는다.

예시를 근거로 src/services, src/hooks 등을 일괄 생성하지 않는다. 실제 책임에 맞춰 최소 분리한다. 운영 데이터·업로드·임시 산출물을 문서 정리를 이유로 수정/삭제하지 않는다.


## 추가된 코드

- client/src/firebase/feedReader.ts: summary 1문서/통합 feed 10개 cursor 조회
- client/src/pages/MemberHomePage.tsx: 홈·피드 화면
- client/src/firebase/membershipAdmin.ts 및 components/MembershipAdminPanel.tsx: 관리자 호출
- functions/src/index.js: 인증/관리자 검증과 트랜잭션
- client/tests/, functions/tests/: 격리된 검증; functions/scripts/prepareAdminPreview.mjs는 로컬 관리자 fixture

참여 코드는 client/src/firebase/participation.ts·optimisticAction.ts와 components/FeedParticipation.tsx에 있다. Functions activityProjection.js/participationTrigger.js가 집계를, feedProjection.js/feedTriggers.js가 원본 동기화와 종료를 담당한다. 상세 경로·스키마·검증은 [참여/후처리](PARTICIPATION_AND_PROJECTION.md)를 따른다.

- functions/src/homeProjection.js·homeTriggers.js: 모임 다음 일정 → 회원 홈 전파, 페이지 처리와 예약 복구.
- client/src/firebase/feedReader.ts의 watchHomeSummary: 홈 한 문서 구독. 상세: [홈 요약 자동 갱신](HOME_SUMMARY_IMPLEMENTATION.md).

- functions/src/migrationPreview.js·scripts/previewMigration.mjs: 네트워크/DB 쓰기 없는 이전 후보 검사. 입력 예시와 테스트는 functions/tests에 있다. [실행 안내](MIGRATION_PREVIEW.md).

- functions/src/localBackfill.js·scripts/rehearseBackfill.mjs: 고정된 migration-rehearsal 로컬 DB의 백필·대조. [안내](LOCAL_BACKFILL.md).

- functions/scripts/prepareUiRoles.mjs: 기존 UI 전용 에뮬레이터 전체관리자/풋살 총무 생성 및 확인. 운영 계정 생성 도구가 아니다.
- 누적 구현·검증·Hosting 배포 및 파일 목록의 최신 상태: [README](README.md).
