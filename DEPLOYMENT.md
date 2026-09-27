# DFMC 모영 (Moyoung) 배포 및 운영 가이드

본 문서는 **둔산제일교회 동호회(모영) 플랫폼**의 현재 프로덕션 구조(Firebase 서버리스)에 맞는 빌드, 배포, 데이터 운영 방법을 안내합니다.

> 과거 Fly.io + Express + SQLite 구조는 폐기되었습니다. `server/` 디렉토리는 레거시 참고용이며 프로덕션에서 실행되지 않습니다.

---

## 1. 시스템 아키텍처 개요

- **프론트엔드**: Vite + React 18 + TypeScript + Vanilla CSS (모바일 반응형)
- **백엔드(서버리스)**: 별도 서버 없음. `client/src/firebase/apiInterceptor.ts`가 브라우저의 `window.fetch`를 가로채 `/api/*` 요청을 Cloud Firestore / Firebase Storage와 직접 통신으로 처리
- **데이터베이스**: Cloud Firestore (NoSQL)
- **파일 저장소**: Firebase Storage (`uploads/{timestamp}_{random}.jpg`), 실패 시 Base64 Data URL 폴백
- **호스팅**: Firebase Hosting (SPA, 모든 경로를 `index.html`로 리라이트)
- **2차 인증 메일**: EmailJS (서버 관리자 OTP)

| 항목 | 값 |
|---|---|
| Firebase 프로젝트 | `moyoung-abd47` |
| 프로덕션 URL | https://moyoung-abd47.web.app |
| Hosting 배포 대상 | `client/dist` |

> **중요**: API/DB/비즈니스 로직 수정은 `server/`가 아니라 반드시 `client/src/firebase/apiInterceptor.ts`에서 해야 프로덕션에 반영됩니다. 자세한 파일 지도는 `ARCHITECTURE_AND_FILE_MAP.md` 참고.

---

## 2. 로컬 개발

```powershell
cd d:\Project\DFMC_Moyoung\client
npm run dev
```

- 클라이언트 Vite 개발 서버만 실행하면 됩니다. Express 서버는 필요 없습니다.
- 개발 중에도 실제 Firebase(Firestore/Storage)에 연결되므로 운영 데이터 수정에 주의하세요.

---

## 3. 빌드 및 배포

프로젝트 루트에서 한 번에 실행:

```powershell
cd d:\Project\DFMC_Moyoung
cmd /c "npm run build && npx firebase deploy --only hosting"
```

- 최초 1회 `npx firebase login`이 필요합니다.
- 보안 규칙(`firestore.rules`, `storage.rules`)을 수정했다면 함께 배포:
  ```powershell
  npx firebase deploy --only firestore:rules,storage
  ```
- 배포 완료 후 `Deploy complete!` 메시지와 Hosting URL을 확인합니다.

> 참고: 루트 `npm run build`는 `build:server`(레거시 서버 tsc)와 `build:client`를 모두 실행합니다. 클라이언트만 빌드하려면 `npm run build:client`를 사용하세요.

---

## 4. Firestore 컬렉션

| 컬렉션 | 용도 |
|---|---|
| `users` | 성도/관리자/게스트 계정 (문서 ID = username) |
| `cells` | 소속 셀 목록 |
| `clubs` | 모영 정보 |
| `club_posts` | 피드 게시글 (`post_{id}`) |
| `club_comments` | 댓글/대댓글 |
| `club_reactions` | 이모지 반응 |
| `club_polls` | 투표 (`poll_{id}`) |
| `club_schedules` | 모임 일정 (`sched_{id}`) |
| `club_chat` | 모영톡 채팅 |
| `club_views` | 모영 일자별 방문수 (`{clubId}_{YYYY-MM-DD}`) |
| `notices` | 교회 전체 공지 (항상 최신 1개 유지) |
| `popups` | 교회 팝업 |
| `targeted_welcomes` | 대상별 맞춤 환영 문구 |
| `reports` | 버그 제보 (고객센터) |

`lobby_settings`, `church_members`, `feedbacks` 등 일부 컬렉션명은 `apiInterceptor.ts`에서 다른 방식으로 참조되므로, 정확한 이름은 코드를 기준으로 확인하세요.

---

## 5. 데이터 백업 및 복구

- **백업**: Firebase 콘솔 > Firestore > 가져오기/내보내기(Export)는 Blaze 요금제가 필요합니다. 무료 플랜에서는 콘솔에서 컬렉션 단위로 수동 확인하거나 별도 스크립트로 덤프하세요.
- **시드 데이터**: 최초 접속 시 `firebaseService.ts`가 기본 셀·모영 등을 시딩합니다. 로컬 캐시 플래그 `dfmc_seeded_v1`이 있으면 재검사를 건너뜁니다.
- **캐시 초기화**: 클라이언트는 `dfmc_user`, `dfmc_lobby_cache`, `dfmc_cells_cache` 등 localStorage 캐시를 사용합니다. 화면이 옛 데이터로 보이면 캐시를 지우세요.

### 서버 관리자 2단계 인증 문제 시
- OTP는 EmailJS로 발송됩니다. 메일이 오지 않으면 EmailJS 대시보드의 서비스/템플릿 설정과 발송 한도를 확인하세요.
- 비상 마스터 코드 체계가 `apiInterceptor.ts`에 구현되어 있으니 해당 로직을 참고하세요. (마스터 코드 값은 이 문서에 기록하지 않습니다.)

---

## 6. 보안 주의

- Firebase 웹 API 키는 공개되어도 되는 식별자이지만, **실제 보호는 `firestore.rules` / `storage.rules`가 담당**합니다. 규칙을 느슨하게 두면 누구나 DB를 수정할 수 있으니 변경 시 신중히 검토하세요.
- 권한 검사(관리자 여부 등)가 클라이언트 코드에서 수행되는 구조이므로, 민감 데이터는 보안 규칙 수준에서 추가 보호를 고려하세요.
- 비밀 값(SMTP 비밀번호, 마스터 코드 등)은 문서/저장소에 기록하지 마세요.

---

## 7. 관리자 및 역할 계정 안내

| 역할 | 아이디 | 로그인 방식 | 주요 권한 |
|---|---|---|---|
| **서버 관리자** | `dfmc8470` | 아이디 + 실명 + 이메일 OTP | 성도/게스트 명단, 직책 부여, 게스트 삭제, 버그 제보함, 시스템 통계 |
| **전체 관리자** | `pastor` (김목사) | 아이디 + 실명 | 셀 개편, 모영 개설/삭제, 미디어 관리자 선임, 총무 선임, 방문 통계 |
| **미디어 관리자** | `user15` | 아이디 + 실명 | 환영 문구, 팝업, 전체 공지 |
| **모영 총무** | `user1` (이주환) | 아이디 + 실명 | 모영 소개 수정, 투표/일정 관리, 총무 2인 자율 위임 |
| **일반 성도** | `user4` 등 | 아이디 + 실명 | 피드/댓글/반응, 투표, 일정 참석 |
| **게스트** | 자동 생성 | 이름 + 지인 이름 | 홈 화면에서 일정 참석/취소만 가능 |

## 2026-09-27 실제 배포 기록
Firebase CLI 인증 후 firebase deploy --only hosting --project moyoung-abd47 --non-interactive 실행 완료. 기존 UI의 client/dist를 배포했고 운영 HTTP 200과 index-Bm3qO0-d.js 제공을 확인했다. 전체 빌드 통과(기존 번들 경고 유지).
신규 auth-preview 코드·Rules·Functions·인덱스·계정 이전은 운영에 적용하지 않았다. previewadmin/previewfutsal은 로컬 전용이다. 배포 인증코드·토큰은 문서에 보관하지 않는다. 최신 전체 상태는 [개발 문서](docs/README.md)를 따른다.

## 2026-09-27 정비 코드 배포 주의

현재 운영 Firestore 규칙이 전체 공개 상태임을 조회로 확인했다. 이번 정비 코드는 미배포다. `storage.rules`는 새 업로드를 거부하도록 변경했으나 배포하지 않았다. 로그인 전환을 보류했으므로 기존 화면을 깨뜨리지 않고 엄격한 Firestore 규칙으로 전환하는 작업은 아직 끝나지 않았다. 배포 순서와 읽기 모델 준비 표시, 관리자 Callable 연결 범위는 [최신 정비 기록](docs/MAINTENANCE_2026_09_27.md)을 따른다. preview 규칙을 운영 파일에 단순 복사하지 않는다.
