# 홈 요약 자동 갱신

2026-09-27. auth-preview/demo-moyoung 범위에 구현했다. 운영 데이터 이전과 배포는 하지 않았다.

## 흐름

전환 대상으로 표시된 일정 원본 → 기존 피드 후처리 → 모임의 publicSummary.nextSchedule → 회원별 users/{uid}/summaries/home → 열린 홈 화면.

- 피드에 startsAt을 추가했다. eventDate/event_date를 기존 날짜 변환 규칙으로 읽는다.
- 모임별 active 일정 중 startsAt이 현재보다 큰 가장 가까운 1개만 조회한다. 동률은 문서 ID 순이다. 지난 일정은 참석 마감 여부와 별개로 홈에서 빠진다. 일정이 없으면 null이다.
- 이 정책은 로컬 전환 화면 기준이다. 운영 홈의 지난 일정 참석 허용 시간과 통합하는 것은 전환 정책에 포함한다.
- 일정 제목/시각/종료/삭제/모임 이동 시 해당 모임 요약을 갱신한다. 하트·댓글 집계 변경은 홈 재계산을 유발하지 않는다.
- 시간만 흐르는 경우 5분 간격 예약 처리가 지난 다음 일정을 교체한다. 한 번에 모임 최대 100개를 처리한다. 처리 지연이나 대기량에 따라 표시 전환은 늦어질 수 있다.
- 홈 화면은 본인 요약 한 문서만 구독한다. 전체 일정·피드·회원 조회를 추가하지 않는다. 서버 확인 전 캐시 이벤트는 무시하고, 계정 전환/화면 해제 시 구독을 종료한다. 권한 오류 시 표시된 요약을 비운다.

## 회원 전파와 복구

_homeSummaryJobs/{clubId}에 revision/cursor/pending을 기록한다. 변경 때 revision을 올리고 처음부터 처리한다. 한 페이지는 최대 100명, 동시 처리 10명이다. 다음 페이지 기록이 다음 이벤트를 만들며, 예약 처리도 남은 작업을 재시도한다. 같은 revision/cursor일 때만 진행 지점을 확정하므로 오래된 작업이 새 작업의 진행 상태를 덮어쓰지 않는다.

각 회원 갱신은 모임·멤버십·프로필·기존 홈을 한 트랜잭션에서 다시 읽는다. 해제 회원/게스트/없는 모임은 해당 모임을 제거하고, 다른 모임과 공지는 보존한다. 이미 같은 값이면 다시 쓰지 않는다. 회원 가입·해제 이벤트도 같은 처리 함수를 사용하므로 회원 목록 조회 이후 가입 상태가 바뀌어도 늦은 작업이 접근 정보를 되살리지 않는다.

홈 값은 공개 가능한 모임명·일정 제목·시각만 담는다. 실제 피드 접근은 기존 Rules가 별도로 검증한다. 기존 홈 문서를 클라이언트가 변경할 수 없다는 규칙도 유지한다. 전역 역할 변경/회원 탈퇴 시 전체 멤버십 정리, 모임 이름 변경·삭제 전파는 별도 관리 작업 범위다.

## 검증 결과

자동 테스트 10개 통과(실패 0), 전체 npm run build 통과, 변경 프론트엔드 파일 정적 검사 통과. 기존 500 kB 번들 경고는 남아 있다.

이번 추가 검증:
- 원본 일정 추가/수정/삭제 → 실제 Functions 트리거 → 회원 홈 반영
- 가장 가까운 일정 선택과 시간 경과 후 다음 일정 선택
- 기존 공지·다른 모임 보존
- 가입 해제 후 늦은 갱신 차단, 재가입 반영, 게스트 제외, 중복 실행
- 홈 구독의 서버 변경 수신과 구독 해제 후 수신 중단

예약 함수의 실행 로직은 에뮬레이터에서 직접 호출했다. 실제 Cloud Scheduler 호출 및 운영 복합 인덱스는 배포 전 검증 대상이다. 회원 100명 초과 부하/실사용 지연 측정은 아직 하지 않았다.

~~~powershell
npx --yes --package=node@22 -- node node_modules/firebase-tools/lib/bin/firebase.js emulators:exec --project demo-moyoung --config firebase.auth-preview.json --only auth,firestore,functions "node --experimental-strip-types --test client/tests/emailAuth.test.ts client/tests/feedReader.test.ts client/tests/homeSubscription.test.ts client/tests/participation.test.ts client/tests/optimisticAction.test.ts functions/tests/membership.test.mjs functions/tests/activityProjection.test.mjs functions/tests/feedProjection.test.mjs functions/tests/homeProjection.test.mjs"
npm run build
~~~

## 이번 변경 파일

- functions/src/homeProjection.js — 다음 일정 선택, 회원 전파, 진행 지점, 시간 경과 복구
- functions/src/homeTriggers.js — 피드/멤버십/작업 이벤트와 예약 연결
- functions/src/feedProjection.js — 일정 startsAt 생성
- functions/src/index.js — 신규 Functions 공개
- firestore.preview.indexes.json — 모임별 다음 일정 쿼리 인덱스
- client/src/firebase/feedReader.ts — 본인 홈 문서 구독
- client/src/pages/MemberHomePage.tsx — 자동 갱신 연결
- functions/tests/homeProjection.test.mjs, client/tests/homeSubscription.test.ts — 신규 검증
- docs/README.md, PROJECT_STRUCTURE.md, FEED_AND_MEMBERSHIP.md, PARTICIPATION_AND_PROJECTION.md, moyoung_firebase_fast_server_architecture.md, HOME_SUMMARY_IMPLEMENTATION.md
- ARCHITECTURE_AND_FILE_MAP.md, FULL_CHANGELOG.md

## 전환 시 주의

이미 생성한 피드에는 startsAt이 없으므로 원본 재처리/백필이 필요하다. 이번 작업은 기존 운영 원본에 변경을 가하지 않았다. 다음 운영 준비 범위는 계정 소유권과 uid 매핑, 백필 미리보기/대조, 게스트·관리자 추가 인증, 전역 권한 변경과 탈퇴 정리, 기존 화면/Storage Rules 전환이다.
