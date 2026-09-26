# 홈·피드와 관리자 멤버십 구현

## 범위

2026-09-27: 기존 auth-preview의 로그인 뒤에 홈 요약과 통합 feed 화면을 연결했다. 관리자용 Callable Function과 호출 폼도 추가했다. 모두 demo-moyoung 로컬 환경이며 기존 운영 로그인·데이터·규칙·배포 설정은 전환하지 않았다.

### 데이터 경로

- users/{uid}/summaries/home: 한 문서로 홈 표시. 공개 가능한 공지/모임 이름/다음 일정만 포함하고 비공개 피드 본문·회원 목록은 포함하지 않는다.
- clubs/{clubId}/feed/{itemId}: 카드 최소 데이터. type/title/excerpt/priority/sortAt/status/sourceId.
- clubs/{clubId}/members/{uid}: status(active/revoked), role(member), is_leader.
- clubs/{clubId}: name, membershipSchemaVersion(1), leaderUids, 선택 publicSummary.nextSchedule.
- clubs/{clubId}/membershipAudit/{id}: 서버가 기록하는 회원 변경 이력.

기존 clubs/club_* 원본은 이동하지 않았다. feed/summary는 현재 테스트 데이터로 검증하며 운영 백필은 남아 있다. 이후 구현한 원본 변경 트리거·참여·자동 종료는 [참여/후처리](PARTICIPATION_AND_PROJECTION.md)를 따른다.

### 조회

feedReader.ts는 Firestore를 인자로 받으므로 운영 전환 시 동일 조회 코드를 재사용할 수 있다. 홈은 한 번의 문서 조회, feed는 priority 내림차순 → sortAt 내림차순 → 문서 ID 오름차순이다. 우선순위는 100/90/80/10이며 sortAt은 밀리초 숫자다. 모든 페이지는 limit(10)과 마지막 문서 snapshot의 startAfter를 사용한다. 정확히 10의 배수이면 마지막 빈 요청 1회가 발생한다.

UI는 ID 중복을 제거하고 전체 새로고침으로 순위 변경을 다시 반영한다. 중간에 위쪽으로 이동한 새 항목까지 페이지 스냅샷 일관성을 보장하지는 않는다. 오류 시 기존 cursor를 보존해 재시도하고 권한 거부 시 표시된 피드를 비운다. 모임/계정 전환이나 unmount 후 늦게 도착한 응답은 무시한다. 접근 회수 후 오프라인 캐시를 다시 보여주지 않도록 서버 조회만 사용한다.

홈 조회 자체는 전체 컬렉션을 읽지 않지만 인증 복원과 프로필 조회 비용은 별도다. 실사용 지연시간 측정은 아직 하지 않았다.

### 권한

Rules는 보호된 회원 프로필의 게스트 여부와 모임의 active 멤버십을 확인한다. feed 목록은 limit <= 10을 강제한다. summary/feed/멤버십 직접 쓰기와 변경 이력 접근은 기본 거부한다. 프로필은 본인 생성/조회만 허용한다.

setClubMembership은 Firebase가 확인한 uid와 이메일 인증, 서버 프로필의 server_admin/head_admin 역할을 검사한다. 역할은 트랜잭션 안에서 다시 확인하므로 기존 토큰으로 해임된 권한을 유지할 수 없다. 대상 Auth 계정과 프로필, 게스트 제외, 입력 필드, 모임 전환 버전을 검사한다.

허용 작업은 가입·가입 해제·총무 지정/해제다. 전역 관리자 역할 부여나 회원 탈퇴 기능은 포함하지 않는다. 가입 해제는 Auth 계정 삭제가 아니다. 모영당 총무 3명 제한은 모임 문서와 같은 트랜잭션에서 검사한다. 멤버십, leaderUids, 대상 홈 요약, 변경 이력을 함께 갱신하며 같은 상태 재요청은 중복 기록하지 않는다.

관리자 초기 지정은 신뢰된 운영 경로로만 해야 한다. 제공된 관리자 준비 스크립트는 고정 localhost/demo 프로젝트만 사용하며 운영용 권한 부여 도구가 아니다.

## 로컬 실행

루트에서 의존성을 준비한다(Functions 의존성/잠금 파일 추가).

```powershell
npm ci --prefix functions
node node_modules/firebase-tools/lib/bin/firebase.js emulators:start --project demo-moyoung --config firebase.auth-preview.json --only auth,firestore,functions
```

별도 터미널:

```powershell
npm run dev --prefix client -- --mode auth-preview
```

가입한 로컬 사용자의 UID는 Emulator UI(http://127.0.0.1:4000)의 Authentication에서 확인한다.

```powershell
node --experimental-strip-types client/tests/seedFeedPreview.ts <local-auth-uid>
```

홈 새로고침 후 23개 카드를 10/10/3개로 볼 수 있다. 테스트 데이터는 서버 관리 경로를 흉내내는 로컬 fixture이며 UI의 회원 자가 가입 기능이 아니다.

관리자 폼 확인이 필요하면 기존 로컬 프로필만 대상으로 다음을 실행하고 로그아웃/재로그인한다. 로컬 이메일 인증 상태와 역할을 테스트용으로 설정한다.

```powershell
node functions/scripts/prepareAdminPreview.mjs <local-auth-uid>
```

## 자동 검증

실행 중인 에뮬레이터를 종료한 뒤:

```powershell
node node_modules/firebase-tools/lib/bin/firebase.js emulators:exec --project demo-moyoung --config firebase.auth-preview.json --only auth,firestore,functions "node --experimental-strip-types --test client/tests/emailAuth.test.ts client/tests/feedReader.test.ts functions/tests/membership.test.mjs"
npm run build
```

검증 범위: 인증/프로필 복구, 10/10/3 페이지, 동률 순서, cursor 문서 삭제, 순위 이동 중복, 빈 피드/정확히 10개, 다른 모임 cursor 차단, 미인증·비회원·게스트·해제 회원 접근 거부, 11개/무제한 목록 거부, 클라이언트 권한/summary/feed 변경 거부, 무권한·미인증 이메일 관리 호출 거부, 관리자 해임, 총무 4명 동시 지정 중 3명만 성공, 동일 상태 재요청과 감사 기록.

Firestore 에뮬레이터는 운영의 복합 인덱스 필요 여부를 완전히 검증하지 않는다. firestore.preview.indexes.json을 전환 배포 시 별도로 적용/검증해야 한다.

## 남은 운영 전환

기존 계정의 소유권 확인과 숫자 ID/uid 매핑, 게스트/관리자 추가 인증 정책, 홈 summary 전파의 운영 백필/부하 검증, 앱 전체 Rules/Storage 권한, 신규 참여 코드의 운영 화면 통합, 운영 계정/Functions/인덱스 배포가 남아 있다. 기존 공개 firestore.rules를 안전하게 교체하기 전에는 운영 전환 완료로 보지 않는다.

공식 참조: [cursor pagination](https://firebase.google.com/docs/firestore/query-data/query-cursors), [쿼리 Rules](https://firebase.google.com/docs/firestore/security/rules-query), [Callable Functions](https://firebase.google.com/docs/functions/callable).

홈의 한 문서 조회는 이후 한 문서 구독으로 확장했다. [홈 요약 자동 갱신](HOME_SUMMARY_IMPLEMENTATION.md)을 참고한다.
