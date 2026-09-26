# 참여 기능과 피드 후처리 구현

2026-09-27. 적용 위치는 개발 모드 auth-preview와 demo-moyoung 에뮬레이터다. 운영 로그인·데이터·배포 설정은 전환하지 않았다.

## 직접 참여와 집계

- clubs/{clubId}/feed/{itemId}/activity/{id}: uid/kind/value/updatedAt만 쓴다.
- 참석·하트·투표는 attendance_{uid}/heart_{uid}/vote_{uid}에 원하는 최종 상태를 저장한다. 재시도가 중복 참여를 만들지 않는다.
- 댓글은 생성 시 고정 ID를 만들고 트랜잭션으로 동일 내용 재시도를 처리한다. 댓글 삭제도 반복 가능하다. 목록은 댓글만 10개씩 cursor 조회한다.
- 화면은 클릭 직후 반영하고 실패하면 이전 상태로 복구한다. 처리 중 중복 입력을 막으며, 전체 피드를 다시 읽지 않는다. 참여 패널을 펼칠 때만 내 상태와 댓글을 읽는다.
- Rules가 active 멤버십, 본인 uid, 허용 필드, 대상 종류, 투표 선택지, 서버 시각 기준 마감을 검사한다. 타인의 참여, 집계, 우선순위 수정은 거부한다.
- projectActivity는 현재 원본과 _appliedActivity 영수증을 같은 트랜잭션에서 비교한다. 중복·역순 이벤트가 집계를 중복 증가시키지 않는다. 집계는 지연 반영될 수 있다.
- 댓글/하트는 종료 후에도 가능하다. 참석·투표는 마감 후 변경할 수 없다. 게스트 홈 참석과 기존 반응 종류의 운영 전환은 별도다.

## 원본에서 통합 feed 생성

projectPost/projectSchedule/projectPoll이 club_posts/club_schedules/club_polls 원본 변경을 처리한다. 원본에 feedSchemaVersion: 1과 feedClubId: 실제 clubs 문서 ID를 명시해야 한다(각각 snake_case도 읽음). 대상 모임도 membershipSchemaVersion: 1이어야 한다. 기존 숫자 club_id를 추측하거나 운영 원본에 전환 표시를 자동으로 쓰지 않는다.

- createdAt/created_at을 고정 sortAt으로 사용한다. 잘못된 생성 시각은 카드를 만들지 않는다.
- 일반 글은 priority 10이다. type: notice와 isPinned/is_pinned가 동시에 참인 글만 고정 공지 100이다. 기존 고정 일반 글을 공지로 자동 승격하지 않는다.
- 진행 일정 90, 진행 투표 80, 종료 항목 10이다. isClosed/is_closed, isExpired/is_expired를 함께 읽는다.
- closesAtMs/closes_at_ms가 우선이다. 없으면 투표 endDate/end_date, 일정 eventDate/event_date + 24시간을 사용한다. 이 일정 기본값은 기존 상세 피드 정책에 맞춘 로컬 어댑터이며 운영 전환 시 홈 정책과 함께 확정한다.
- 날짜만 있는 문자열은 한국 시간 자정이다. 시간대 없는 날짜+시각은 거부하고 해당 참여를 닫는다. 명확한 ISO 시간대, 숫자 밀리초, Firestore Timestamp를 지원한다.
- 투표 문자열 선택지는 내용의 해시로 ID를 만들어 순서 변경에도 유지한다. 명시적인 {id, label}도 지원한다. 중복 ID/잘못된 선택지는 게시하지 않는다. 문자열 문구 변경은 새 선택지로 취급하므로 운영 편집기는 명시적 ID를 유지해야 한다.
- 기존 votes/attendees 배열은 uid 소유권이 확인되지 않아 가져오지 않는다.

_feedSources 서버 전용 기록이 대상 피드 경로와 세대를 보관한다. 원본을 트랜잭션 안에서 다시 읽으므로 늦게 온 이벤트도 최신 상태를 반영한다. 같은 카드 수정은 집계를 보존한다. 삭제·전환 표시 해제·모임 이동은 이전 카드를 제거한다. 재생성/이동은 새 세대 ID를 사용해 과거 참여가 다른 모임이나 새 카드에 섞이지 않는다. 삭제된 카드 아래 하위 데이터는 접근이 막힌 상태로 남으며, 실제 정리·보존 정책은 탈퇴/데이터 이전 단계에서 구현한다.

## 자동 종료

expireFeedItems는 5분 간격으로 마감된 활성 projectionVersion: 1 카드 최대 100개를 조회한다. 다시 읽은 원본의 최신 마감 기준으로 종료하며 마감 연장을 오래된 쿼리 결과로 덮어쓰지 않는다. 중복 실행에도 같은 결과다. 많은 종료 항목이 쌓이면 다음 실행에서 이어서 처리한다. 실패하면 예약 재시도와 다음 주기가 복구 경로다. Rules는 예약 처리 지연과 무관하게 마감 시각부터 참여를 거부한다.

이 단계 이후 원본 일정 변경을 모임 요약과 회원 홈에 전파하는 코드를 추가했다. 최신 범위와 제한은 [홈 요약 자동 갱신](HOME_SUMMARY_IMPLEMENTATION.md)을 따른다.

## 검증

Node 22와 격리된 에뮬레이터에서 실행한다.

~~~powershell
npx --yes --package=node@22 -- node node_modules/firebase-tools/lib/bin/firebase.js emulators:exec --project demo-moyoung --config firebase.auth-preview.json --only auth,firestore,functions "node --experimental-strip-types --test client/tests/emailAuth.test.ts client/tests/feedReader.test.ts client/tests/participation.test.ts client/tests/optimisticAction.test.ts functions/tests/membership.test.mjs functions/tests/activityProjection.test.mjs functions/tests/feedProjection.test.mjs"
npm run build
npm run lint --prefix client
~~~

참여·Rules 거부·실패 복구·10개 댓글·중복 집계, 원본 트리거·수정 집계 보존·마감 연장·종료·이동·삭제·재생성을 검증한다. 예약 서비스 자체는 에뮬레이터가 자동 실행하지 않아 동일 expireFeed 함수를 직접 호출한다. 실제 Cloud Scheduler 실행과 운영 복합 인덱스는 배포 시 검증해야 한다.

브라우저에서 로컬 이메일 계정으로 로그인, 홈→피드, 일정 참석·하트·댓글, 투표 선택 변경까지 확인했다.

## 이번 단계 파일

- client/src/firebase/participation.ts, optimisticAction.ts: 직접 참여/실패 복구
- client/src/components/FeedParticipation.tsx: 참여 화면
- client/src/pages/MemberHomePage.tsx, client/src/firebase/feedReader.ts: 연결/카드 타입
- functions/src/activityProjection.js, participationTrigger.js: 참여 집계
- functions/src/feedProjection.js, feedTriggers.js, index.js: 원본 동기화·예약 종료
- firestore.auth-preview.rules, firestore.preview.indexes.json: 참여 권한·쿼리 인덱스
- client/tests/participation.test.ts, optimisticAction.test.ts, previewFixtures.ts
- functions/tests/activityProjection.test.mjs, feedProjection.test.mjs
- docs/README.md, PROJECT_STRUCTURE.md, FEED_AND_MEMBERSHIP.md, moyoung_firebase_fast_server_architecture.md
- ARCHITECTURE_AND_FILE_MAP.md, FULL_CHANGELOG.md 및 이 문서

공식 참고: [Functions 예약 실행](https://firebase.google.com/docs/functions/schedule-functions), [Firestore 이벤트](https://firebase.google.com/docs/functions/firestore-events).

### 이번 실행 결과
자동 테스트 8개 통과(실패 0), 전체 npm run build 통과. oxlint 종료 코드 0이며 기존 운영 코드 경고와 기존 500 kB 번들 경고는 남아 있다. 에뮬레이터는 테스트 종료 후 정상 종료했다.
