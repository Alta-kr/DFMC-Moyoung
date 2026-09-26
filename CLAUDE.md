> 2026-09-27: 작업 전 [AGENTS.md](AGENTS.md) 8절과 [docs/README.md](docs/README.md)를 읽는다. 아래 아이디/실명 인증과 인터셉터 전담 설명은 현재 구현이다. 새 인증은 Firebase 이메일/비밀번호, 민감 작업은 Cloud Functions라는 목표를 따른다. 기존 구현을 일괄 교체하지 않는다.

# DFMC 모영(Moyoung) 에이전트 룰

둔산제일교회 동호회(모영) 커뮤니티 웹앱. 프로덕션: https://moyoung-abd47.web.app (Firebase 프로젝트 `moyoung-abd47`)

## 1. 아키텍처 (가장 중요)

- 프로덕션은 **Firebase Hosting 정적 SPA + Firestore + Storage** 서버리스 구조다.
- `client/src/firebase/apiInterceptor.ts`가 `window.fetch`를 가로채 `/api/*` 요청을 Firestore/Storage와 직접 통신으로 처리한다.
- `server/`(Express + SQLite)는 **레거시**이며 프로덕션에서 실행되지 않는다. **API, DB, 비즈니스 로직 수정은 `server/`가 아니라 반드시 `apiInterceptor.ts`에서 한다.** `server/`는 명시적 요청이 없으면 수정하지 않는다.
- 기능별 파일 위치는 `ARCHITECTURE_AND_FILE_MAP.md`, 배포/운영은 `DEPLOYMENT.md`, 변경 이력은 `FULL_CHANGELOG.md`를 참고한다.

## 2. 코드 작성 원칙

1. **새 필드는 카멜/스네이크 둘 다 방어적으로 읽는다.** 예: `imageUrl`과 `image_url`, `userId`와 `user_id`, `selectedOption`과 `selected_option`. 클라이언트와 인터셉터 사이 필드명이 어긋나 버그가 난 이력이 있다.
2. **Firestore에 `undefined`를 쓰지 않는다.** `updateDoc`/`setDoc` 전에 값을 살균한다.
3. **낙관적 UI(0ms)를 유지한다.** 상호작용 후 `loadClubData()` 같은 전체 재조회로 화면을 깜빡이게 하지 말고 `setData`로 먼저 반영한 뒤 백그라운드에서 동기화한다.
4. **로딩 UX 패턴을 따른다.** localStorage 캐시(`dfmc_*_cache`)로 즉시 렌더하고 백그라운드에서 갱신한다. 캐시가 없을 때만 스피너를 보여준다. 조건은 `loading && !data`.
5. **Firestore 조회는 `where('club_id', '==', id)`로 좁히고, 독립 쿼리는 `Promise.all`로 병렬화한다.** 컬렉션 전체 스캔 후 JS 필터링은 하지 않는다.
6. **이미지 업로드는 `firebaseService.ts`의 압축(1200px, JPEG 75%)과 타임아웃/Base64 폴백 경로를 우회하지 않는다.**
7. **UI 문구는 한국어로, 간결하게 쓴다.** 기존 톤을 따르고 불필요한 안내 문구나 이모지를 늘리지 않는다.
8. 주변 코드의 이름 규칙, 주석 밀도, 스타일을 따른다. 요청받지 않은 리팩터링은 하지 않는다.

## 3. 도메인 규칙

- 역할: `server_admin` > `head_admin` > `media_admin` > 모영 총무(`is_leader`, 모영당 최대 3인) > `member` > `guest`.
- 로그인은 비밀번호 없이 아이디 + 실명이다. 서버 관리자만 이메일 OTP 2단계 인증을 쓴다.
- **게스트**는 홈 화면에서 일정 참석/취소만 가능하다. 모영 피드 진입, 관리자/총무 임명, 성도 검색 목록에는 절대 포함하지 않는다(`role === 'guest'`, `is_guest` 필터).
- `'둔산제일교회'`는 고정 기본 셀이며 삭제/개편에서 보호한다.
- 홈 화면 일정은 **모영당 가장 임박한 1개만** 노출한다. 마감된 투표는 홈/상단 고정에서 제외하고 피드 타임라인으로 이동한다.
- 교회 전체 공지는 항상 최신 1개만 유지한다.

## 4. 빌드 · 배포

```powershell
cd d:\Project\DFMC_Moyoung\client ; npm run dev          # 로컬 개발
cd d:\Project\DFMC_Moyoung ; cmd /c "npm run build && npx firebase deploy --only hosting"   # 빌드 + 배포
```

- 코드 수정 후 **먼저 빌드(TypeScript 컴파일)가 통과하는지 확인**한다. 실패하면 배포하지 않고 원인을 보고한다.
- **배포는 실제 사용자에게 바로 반영되므로 사용자에게 먼저 확인받고 실행한다.** 사용자가 그 작업에 대해 미리 "바로 배포해"라고 지시한 경우만 예외다.
- 보안 규칙(`firestore.rules`, `storage.rules`)을 수정했으면 `npx firebase deploy --only firestore:rules,storage`도 별도로 배포해야 한다. 규칙은 느슨하게 완화하지 않는다.
- 배포 전 Firebase 로그인이 필요하면 사용자에게 `! npx firebase login` 실행을 안내한다.

## 5. 보안 · 데이터 주의

- 개발 환경도 **실제 운영 Firestore에 연결**된다. 테스트 데이터 생성, 삭제, 일괄 개편(`cells/batch`) 등 파괴적 작업은 실행 전에 대상을 확인한다.
- 비밀 값(마스터 OTP 코드, SMTP 비밀번호 등)을 문서, 커밋, 응답에 쓰지 않는다.
- `server/database.sqlite`, `server/uploads/`, `.firebase/`, `scratch/`는 커밋 대상이 아니다.
- 임시 스크립트와 산출물은 `scratch/`나 스크래치패드에 두고 프로젝트 소스에 섞지 않는다.

## 6. 문서 유지

- 구조나 API가 바뀌면 `ARCHITECTURE_AND_FILE_MAP.md`를, 기능 단위 변경이면 `FULL_CHANGELOG.md`를 함께 갱신한다.
- 문서에서 SQLite/Express/Fly.io 기준 설명은 과거 구조다. 새로 쓰는 내용은 Firebase 서버리스 기준으로 작성한다.

## 7. 커뮤니케이션

- 사용자와는 한국어로 대화한다.
- 커밋은 사용자가 요청할 때만 한다. 기본 브랜치는 `main`이고 현재 작업 브랜치는 `master`이다.
