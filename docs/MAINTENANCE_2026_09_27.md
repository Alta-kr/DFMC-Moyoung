> **2026-09-28 최종 변경:** 사용자는 실명+아이디 로그인을 유지하기로 결정했다. 서버 세션·서버/미디어 관리자 OTP 및 DB 직접 접근 차단으로 전환했다. 아래 이메일/비밀번호 계획은 과거 기록이다. 코드/검증 상태와 운영 전제는 [보안 로그인 전환](SECURE_NAME_LOGIN.md)을 따른다. **아직 운영 미배포.**

# 2026-09-27 기능 정비 — 로그인 전환 전

## 범위와 운영 상태

기존 App·로비·모임 상세·관리자 화면을 유지했다. 로그인 방식 전환은 사용자 요청에 따라 보류했다. 이번 코드는 아직 운영에 배포하지 않았다. 운영 회원, 권한, 데이터 백필을 변경하지 않았다.

**운영 보안 전환은 완료 상태가 아니다.** 배포된 Firestore Rules를 Firebase Rules API로 조회한 결과 전체 경로에 `allow read, write: if true`가 있었다. Storage Rules 배포 항목은 조회 결과에 없어서 운영 상태를 확인하지 못했다. 현재 username 토큰은 Firebase 인증 증명이 아니므로, 브라우저 역할 검사는 보안 경계가 될 수 없다.

## 구현 상태

| 항목 | 구현 내용 | 적용 조건 / 제한 |
|---|---|---|
| 사진 업로드 제거 | 글의 파일 선택·업로드 코드와 압축/업로드 서비스 제거, 업로드 API 410, 새 이미지 URL 첨부 거부 | 기존 이미지 열람·삭제 유지. 팝업의 기존 URL 표시는 유지. Storage 신규 쓰기 금지 규칙은 미배포 |
| 관리자 검증 | 브라우저 경로별 역할·대상 모임·게시글/댓글 소유자 검사, 임의 계정 전환 API 폐쇄, OTP 우회 코드 제거 | 브라우저 검사만으로 운영 보안을 보장하지 않음 |
| 관리자 서버 작업 | `manageDomain`: 검증된 Firebase 계정, 이메일 인증, 비활성 계정 차단, 트랜잭션 내 역할 재검증, 감사 기록 | 현재 아이디 로그인 화면에서 호출하는 경로로 아직 전환하지 않음. 로그인/uid 연결 후 연결 필요 |
| 운영 Rules | 실제 배포 Firestore 규칙 확인, 기존 uid 기반 엄격 규칙의 거부 테스트 재검증, Storage write 금지 | Firestore 운영 규칙 교체는 인증 전환과 함께 수행해야 함. 기존 preview 규칙을 운영에 그대로 배포하면 레거시 화면 접근이 차단됨 |
| 동시 참석·투표 | 대상과 회원을 함께 읽는 Firestore 트랜잭션, 요청된 최종 상태 저장, 중복 재시도 안전, 모임·마감·선택지 검사 | 기존 배열 구조를 보존하므로 대규모 모임의 단일 문서 경합/용량 한계는 남음. 목표 activity 구조는 별도 |
| 고유 ID | 참석·투표 본인 판별, 총무 선택/임면, 게스트 배제에 ID 사용 | 이름뿐인 기존 총무 명단은 권한으로 추정하지 않음. 운영 총무 ID의 명시적 매핑 필요 |
| 날짜 통일 | 한국 시간 기준 파서, 숫자 시각 startsAtMs/endsAtMs/closesAtMs, 날짜만 있는 투표는 해당 일 23:59:59.999 마감 | 기존 표시 문자열 보존. 운영 기존 데이터의 날짜 백필은 미실행 |
| 기존 홈 연결 | `_readModels/lobby` 요약 조회 경로 및 원본 변경/시간 경과 후처리 | `lobby_settings/main.readModelVersion=1`은 날짜 백필 완료 후에만 설정. 요약 없으면 기존 조회 유지 |
| 기존 피드 연결 | 통합 feed의 우선순위/시각/문서 ID 정렬, 실제 limit(10)/startAfter, 기존 카드에 원본 연결, 페이지 중복 제거 | `clubs/{id}.feedReadModelVersion=1`인 모임에서 사용. 미전환 모임은 기존 조회 유지. 댓글/반응은 해당 페이지 대상으로 조회 |
| 계정별 캐시 | 계정 이름 공간으로 분리, 늦게 끝난 요청은 시작한 계정의 캐시에 저장, 계정 변경 시 화면 재마운트 | 캐시는 인증 수단이 아님. 로그아웃 시 캐시 정리 |
| 도메인 규칙 | 총무 최대 3명/게스트 금지, 기본 셀 보호, 빈/중복 셀 개편 거부, 임의 역할 거부, 공지 단일 문서 | 서버의 셀 개편/공지 작업은 원자적 처리. 기존 관리자 UI의 모든 작업이 Functions로 이전된 것은 아님 |
| 자동 샘플 제거 | 샘플 생성은 DEV + ui-preview만 허용 | 운영 빌드에서는 실행 안 함 |
| 신규 홈 누락 이벤트 | 모임 이름/삭제/스키마 변경, 사용자 역할/게스트 변경, 멤버십 링크와 재전파 | 기존 멤버십의 `_clubLinks` 백필 필요. 아직 링크가 없는 기존 회원의 복귀 시 완전한 복원은 백필 후 보장 |

## 데이터 및 기능 전환

- 기존 `users/{username}`, `clubs`, `club_*`를 삭제하거나 일괄 교체하지 않았다.
- 레거시 `manager_ids`는 기존 회원 숫자 ID를 문자열로 보관하고 `manager_names`는 표시 전용이다. 목표 `leaderUids`와 혼용하지 않는다.
- 새 게시글·일정·투표에는 명시적 `feedClubId`, `feedSchemaVersion`을 쓴다. 후처리는 모임의 `membershipSchemaVersion=1` 또는 `feedProjectionVersion=1`일 때만 투영한다.
- `legacyReadModelRehearsal.js`는 localhost + demo 프로젝트만 허용한다. 원본 수정 시 updateTime 사전조건을 사용하고, 원본/피드 개수 대조 후 읽기 경로를 켠다. 운영 이전 도구가 아니다.
- 빠른 피드도 현재 레거시 원본/댓글/반응 읽기 권한에 의존한다. 엄격한 Rules 전환 시 uid 멤버십과 activity 경로를 포함한 기존 화면 연결을 완성해야 한다.
- 추가 조회 인덱스는 `firestore.preview.indexes.json`에 포함했다. 운영 인덱스 배포는 미실행이다.

## 운영 전환 순서

1. 운영 내보내기/복구본, 고유 회원 ID와 Firebase uid 연결, 이름뿐인 총무 명단의 수동 매핑을 확정한다.
2. 기존 LoginPage를 유지하며 Firebase Auth를 연결한다. 관리자 추가 인증 정책도 이때 정한다.
3. 관리자 화면을 검증된 Callable로 전환하고, 나머지 관리자 경로도 같은 서버 검증으로 옮긴다. 브라우저 직접 관리자 쓰기 경로를 폐쇄한다.
4. 참석/투표를 uid activity 구조로 연결하고 레거시 배열의 이전을 검증한다. 레거시 배열을 쓰는 현재 트랜잭션은 데이터 경합 개선이며 보안 Rules 전환의 대체물이 아니다.
5. 소규모 모임으로 날짜/피드/홈/멤버십 링크를 백필·대조한 후 준비 표시를 설정한다. `feedReadModelVersion` 제거와 요약 version 비활성화로 읽기 경로를 복귀할 수 있다.
6. 로그인·권한·원본/활동 데이터 접근을 함께 검증한 뒤 사용자 승인 하에 Functions/인덱스/Rules/Hosting을 배포한다. 보안 롤백을 전체 공개 규칙으로 하지 않는다.

## 검증

- 전체 루트 빌드 통과. 기존 500 kB 번들 경고는 남음.
- 로컬 demo 에뮬레이터: 날짜/동명이인, 동시 참석·투표, 재시도 중복 방지, 게스트/총무 정원 거부, 10·10·3개 피드 조회, 캐시 격리, 관리자/기본 셀/단일 공지, 홈 수명주기, 백필 재실행 테스트 추가.
- 기존 인증·참여·피드·홈·멤버십·이전 테스트도 재검증한다. 상세 최종 결과는 이 문서 하단 실행 기록에 추가한다.
- 처음 병렬 실행에서 Functions 기동 지연으로 참여 집계 대기가 실패했다. 해당 테스트 단독 재실행은 통과했다.
- 홈 테스트는 실제 존재하지 않는 다른 모임을 보존하던 가정을 수정하여, 유효한 모임/멤버십 fixture를 먼저 만든다. 새 후처리는 고아 홈 항목을 제거한다.
- 예약 함수의 실제 운영 스케줄, 운영 인덱스, 대규모 부하, 실제 회원 로그인은 검증하지 않았다. 로컬 Functions는 설치된 Node 24로 실행되었으며 배포 목표는 Node 22다.

## 주요 파일

- 기존 화면: `client/src/App.tsx`, `pages/ClubDetailPage.tsx`, `LobbyPage.tsx`, `HeadAdminPage.tsx`, `ServerAdminPage.tsx`, `LoginPage.tsx`, `types.ts`
- 기존 진입점: `client/src/firebase/apiInterceptor.ts`, `firebaseService.ts`
- 클라이언트 정비: `identity.ts`, `accountCache.ts`, `legacyParticipation.ts`, `legacyManagers.ts`, `legacyFeedReader.ts`
- 서버: `functions/src/dateTime.js`/`.d.ts`, `adminDomain.js`, `legacyLobbyProjection.js`, `legacyReadModelRehearsal.js`, `feedProjection.js`, `homeProjection.js`, `homeTriggers.js`, `index.js`
- 검증: `client/tests/accountCache.test.ts`, `legacyMaintenance.test.ts`, `functions/tests/maintenance.test.mjs`, `homeProjection.test.mjs`, `firebase.maintenance-test.json`
- 규칙/인덱스: `storage.rules`, `firestore.preview.indexes.json`
- 로컬 역할 계정: `functions/scripts/prepareUiRoles.mjs`

레거시 `server/` 소스는 수정하지 않았다. 커밋·push·배포는 하지 않았다.

### 최종 실행 기록

- 기존 회귀 검증: `firebase.maintenance-test.json`으로 Auth/Firestore/Functions를 실행하고 테스트를 순차 수행. **13개 통과, 실패 0**.
- 새 정비 검증: `firebase.ui-preview.json`의 Firestore/Storage에서 캐시, 날짜/ID, 동시 참여/총무/페이지, Storage 거부, 관리자/홈/백필 테스트. **5개 통과, 실패 0**.
- 마지막 전체 `npm run build` 통과. 이후 추가한 일정/투표 입력 검증과 날짜 백필 유효성 검사는 컴파일 확인을 포함한다.
- 테스트는 모두 localhost의 `demo-*` 프로젝트에서 실행했다. 테스트 에뮬레이터는 실행 종료 후 내려갔다.
- 피드 첫 조회에서 총무용 전체 회원 명단 조회를 분리했다. `/api/clubs/:id/members`는 총무 관리창을 열 때만 호출하며 게스트를 제외한다. 이 마지막 화면 연결 변경은 클라이언트 빌드로 확인했다.

## 2026-09-28 기존 화면 직접 검증 및 캐시 보완

- 운영 데이터와 분리된 demo-moyoung-ui 에뮬레이터에서 기존 LoginPage/LobbyPage/ClubDetailPage/HeadAdminPage를 직접 사용했다.
- 확인: 홈 참석/취소와 인원 반영, 투표 저장/선택 변경, 저장 직전 투표 마감 시 이전 선택으로 복구, 계정 전환 시 내 투표 분리, 총무 3명 제한 및 저장/새로고침 후 유지, 고정 기본 셀 삭제 버튼 없음.
- LobbyPage와 ClubDetailPage는 참석/투표 요청이 끝난 상태를 계정별 캐시에 반영하도록 보완했다. 처리 중 낙관적 상태는 해당 효과에서 캐시에 쓰지 않는다.
- firebaseService의 로컬 샘플 초기화는 브라우저의 오래된 완료 표시 대신 에뮬레이터 데이터를 확인한다. 운영 자동 샘플 생성은 계속 비활성이다.
- prepareUiRoles의 총무 ID와 표시 이름을 동일한 체험총무 1명으로 맞췄다. 총무 해임 툴팁도 이름과 실제 저장 전 선택 동작을 표시한다.
- 전체 npm run build 통과. 기존 번들 500 kB 경고는 남아 있다. 체험 계정 준비 스크립트 변경은 구문 확인만 수행했으며 저장 검증 데이터를 덮어쓰지 않기 위해 재실행하지 않았다.
- 미검증/남은 범위: ClubDetailPage의 총무 인계 제안 화면과 API 연결은 별도 정비가 필요하다. 로그인 전환, 운영 권한 전환, 배포는 이번 검증에 포함하지 않았다.
- 화면 기록: scratch/ui-verification-20260928.png (로컬 검증 산출물, 커밋 제외).

## 2026-09-28 총무 인계 연결과 이번 배포 범위

- 사용자 결정: 로그인은 현재 아이디/실명 방식을 유지하고 이메일/비밀번호 전환은 다음 작업으로 미룬다. Firestore 공개 규칙은 로그인 전환 전까지 유지한다.
- 총무 인계: `POST /api/clubs/:id/handover/propose`, `/handover/:voteId/agree`를 `legacyManagers.ts`에 연결했다. `club_handover_votes`에 안건을 두고 현직 총무(`manager_ids`) min(2, 인원)명 동의 시 트랜잭션으로 반영한다. 1~3명 유지, 게스트 거부, 같은 안건 중복 거부, 반영 시점에 명단이 바뀌면 안건을 `rejected`로 종료한다.
- ClubDetailPage의 `총무 안건` 버튼은 총무에게 항상 보인다. 모임 조회는 총무일 때만 진행 중 안건을 읽는다.
- 검증: `client/tests/handover.test.ts` 추가. demo-moyoung-ui 에뮬레이터에서 인계·기존 정비·캐시 테스트 4개 통과, 전체 빌드 통과.
- 운영 Functions는 firebase.json에 없고 목록 조회도 실패한다. 홈/피드 요약 읽기 경로와 날짜/멤버십 백필은 Functions 배포와 함께 다음 로그인 전환 작업에서 진행한다. 이번 배포 대상은 Hosting과 Storage 쓰기 금지 규칙이다.
