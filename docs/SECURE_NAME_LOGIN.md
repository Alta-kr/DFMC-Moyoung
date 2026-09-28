# 실명·아이디 로그인과 데이터베이스 접근 제한

2026-09-28. 사용자 결정: 일반 회원은 기존 아이디+실명으로 로그인한다. 이메일/비밀번호 전환은 하지 않는다. **코드와 로컬 검증 완료, 운영 비밀 설정 및 배포는 미완료다.** 이 문서가 과거 이메일 인증 계획보다 우선한다.

## 확인한 시작 상태

작업 시작 시 저장소는 깨끗했고 최신 커밋은 `3f22408`이었다. 사진 제거, 계정별 캐시, 날짜/ID 정비와 총무 인계 안건이 반영되어 있었다. 기존 Firestore 규칙은 전체 공개였고 로그인 토큰은 아이디로 위조할 수 있었다. 이번에 운영 데이터/계정을 수정하지 않았다.

## 최종 경로

기존 React 화면 → `/api/*` → Hosting rewrite → 서울 리전 Cloud Functions `api` → Admin SDK → 기존 Firestore 컬렉션.

- apiInterceptor는 서버 요청에 저장된 세션을 전달한다. 브라우저가 Firestore에 직접 접속하는 운영 경로를 제거했다.
- legacyApi.ts는 기존 API 계약과 사용자 수정 코드를 이전한 원본이다. server/는 건드리지 않았다.
- legacyAuth.js는 실명/아이디 대조, 서버 세션, OTP, 요청 제한을 담당한다. apiGateway.js는 인증/공개 경로 구분과 응답 필드 제한을 담당한다.
- adminFirestore.js는 기존 domain helper의 함수형 호출을 Admin SDK로 연결한다. scripts/buildApi.mjs는 legacyApi.ts와 기존 identity/참여/총무/피드 helper를 functions/lib로 컴파일한다. 생성물은 편집/커밋하지 않는다.
- 기존 배열 데이터의 타인 수정과 관리자 권한을 엄격한 브라우저 Rules만으로 안전하게 검증하기 어려워, 이번 구조에서는 일반 참여도 서버를 경유한다. 즉시 UI 반영·실패 복구와 10개 커서 피드는 유지한다.
- firestore.rules는 모든 클라이언트 읽기/쓰기를 거부한다. Firebase API 키만 알아서는 DB에 접근할 수 없다. Admin SDK는 서버 서비스 계정 권한으로 처리한다.
- storage.rules는 기존 파일 개별 읽기를 유지한다. 목록 조회와 업로드/변경/삭제는 거부한다. 기존 다운로드 URL은 공개될 수 있으며 비공개 이미지 보관 정책으로 바뀐 것은 아니다.

## 관리자 로그인과 잠금 (2026-09-28 추가 결정)

- 이메일 OTP는 server_admin만 사용한다. media_admin, head_admin, 총무는 실명+아이디로 로그인한다.
- server_admin은 `/api/auth/login`에서 일반 오류로 거부된다. 로그인 화면 우측 하단의 보이지 않는 버튼을 1.5초 간격 안에 7번 누르면 열리는 관리자 로그인 창(`/api/auth/admin-login`)에서만 OTP를 받는다. 숨은 버튼은 보안 장치가 아니다.
- 인증번호 오류는 challenge와 무관하게 계정별로 누적된다. 5회째에 `_apiLocks/{아이디}`가 잠기고 올바른 코드도 거부된다(423). 성공하면 누적 기록을 지운다.
- 잠기면 `alertRecipient`로 `unlockTemplateId` 메일을 보낸다. 링크는 `/api/auth/unlock?t=…`, 32바이트 토큰의 해시만 저장, 24시간 1회용이다. GET은 확인 버튼 화면만 보여주고 POST에서 해제하므로 메일 보안 검사기의 미리 열기로는 풀리지 않는다. 만료된 뒤 관리자 로그인을 시도하면 새 링크를 보낸다.
- EmailJS에 잠금 알림 템플릿을 만들고 `{{{unlock_url}}}`을 버튼 링크로 넣는다. 사용 변수: `to_email`, `username`, `unlock_url`, `message`.

## 인증 범위

- 아이디와 실명이 등록 정보와 모두 일치해야 로그인된다. 일반 세션은 24시간, 서버 관리자 OTP 인증 세션은 1시간이다. 미디어·전체 관리자와 총무는 일반 세션으로 로그인한다. 32바이트 무작위 토큰의 SHA-256 해시만 DB에 보관한다.
- 매 요청에서 프로필/현재 역할/비활성 여부를 확인한다. 일반 세션 발급 후 서버 관리자가 되면 OTP 로그인부터 다시 필요하다.
- server_admin만 관리자 로그인 창의 OTP 화면으로 추가 인증한다. 사용자 요청으로 media_admin, head_admin, 현직 총무는 실명+아이디 로그인만 사용한다. 서버에서 생성한 5자리 코드는 5분, 최대 5회 시도, 성공 후 삭제된다. 계정별 challenge에 묶여 재사용할 수 없다.
- 인증 API는 IP당 10분 40회, 아이디 로그인은 10분 10회로 제한한다. 일반 API는 계정 또는 비로그인 IP당 분당 300회다. 대규모 분산 공격 방어를 보장하는 장치는 아니다.
- 로그아웃 시 서버 세션도 삭제한다. cleanApiSessions는 만료 세션/OTP/제한 기록을 매시간 제한된 묶음으로 정리한다. 실제 Scheduler 동작은 배포 후 확인해야 한다.
- 실명/아이디를 아는 사람은 일반 회원을 사칭할 수 있다. 자유 가입도 유지한다. 이름, 소속, 작성 내용 등 앱이 허용하는 정보는 로그인한 회원에게 보인다. 이 방식은 강한 본인 확인이나 정보 유출의 완전한 방지가 아니다.

## 운영 설정 및 배포 순서

1. 서버 관리자 계정에 사용할 인증 이메일을 확정한다. 이메일은 브라우저 입력값을 신뢰하지 않고 서버 Secret Manager의 명시적 매핑만 사용한다.
2. Secret Manager에 `MOYOUNG_MAIL_CONFIG`를 JSON으로 설정한다. 필드: `serviceId`, `templateId`, `publicKey`, `privateKey`, `recipients`(키=기존 아이디, 값=해당 이메일), `alertRecipient`(잠금 알림 받을 메일), `unlockTemplateId`. 비밀값은 소스/문서/채팅에 넣지 않는다. 기존 EmailJS 계정에서 서버 API 사용을 허용하고 템플릿의 수신자와 코드 변수를 확인한다. 실제 메일 전송은 아직 시험하지 않았다.
3. `npm run build`와 로컬 보안 테스트를 통과시킨다. Firebase Functions 배포에는 프로젝트의 결제/권한 준비가 필요하다. 아직 실계정 결제 설정은 확인하지 않았다.
4. 운영 clubs에는 총무 이름만 있고 `manager_ids`가 없다. 배포 직전 `node scratch/assign-manager-ids.mjs`로 미리보기 후 승인받아 `--apply`로 기록한다(이름이 유일하지 않거나 이미 기록된 경우 중단). 2026-09-28 사용자 승인으로 운영 4개 모영에 기록 완료(총무 12자리, 이전 상태는 scratch/clubs-before-manager-ids-*.json).
5. 사용자 배포 승인 후 `functions:api,functions:cleanApiSessions`를 먼저 배포한다. 기존 이메일 검증용 Functions 전체를 이 작업에서 배포할 필요는 없다.
6. 짧은 점검 시간에 새 Hosting과 `firestore:rules,storage`를 함께 배포하고 실제 로그인/OTP/관리자/참석을 확인한다. 배포는 원자적이지 않으므로 잠깐 구버전 화면 요청이 실패할 수 있다. 구세션은 의도적으로 만료되어 다시 로그인해야 한다. Hosting만 배포하고 공개 DB 규칙을 남기면 보안 전환이 완료되지 않는다.
7. 운영 REST DB 접근 거부, 서버 API/메일/오류 로그를 검증한다. 장애 시 서버 코드/Hosting을 수정·복구하되 Rules를 전체 공개로 되돌리지 않는다.

Hosting rewrite는 [Firebase 공식 안내](https://firebase.google.com/docs/hosting/functions), 서버 메일 필드는 [EmailJS REST API](https://www.emailjs.com/docs/rest-api/send/)를 따른다. 비밀 설정이 빠져 있으면 서버/미디어 관리자 로그인은 503으로 차단하며 우회 코드가 없다.

## 로컬 실행 및 검증

- `START_MOYOUNG_PREVIEW.cmd`: demo-moyoung-ui의 Firestore 8082/Storage 9198, 로컬 API 5002, 기존 화면 3001. 데이터 초기화는 localhost Admin SDK로만 수행한다. 운영 자동 샘플 생성은 없다.
- 일반 체험: member1 / 홍길동. 전체 관리자: previewadmin / 체험관리자. 풋살 총무: previewfutsal / 체험총무. 서버 관리자 로컬 전용 OTP와 잠금 해제 링크는 실행 터미널에 표시되고 외부로 발송하지 않는다. 운영 api.js에는 이 경로가 없다.
- API/Rules 검증: `npx firebase emulators:exec --project demo-moyoung-security --config firebase.security-test.json --only firestore "node --test --test-concurrency=1 functions/tests/apiSecurity.test.mjs functions/tests/handoverServer.test.mjs"` (먼저 npm run build:functions).
- 2개 통합 테스트 통과: 실명 오류, 토큰 위조, 회원가입 역할 주입, 관리자 API 거부, 타인 글 수정 거부, 동시 투표/중복 방지, 게스트 참석/피드 거부, OTP 재사용·5회 제한, 권한 상승 후 재인증, 로그아웃/비활성 계정 거부, DB 직접 읽기·쓰기 거부, 총무 안건·동의·정원·게스트 제한.
- 기존 UI에서 실명/아이디 로그인 → 홈 → 참석 저장을 확인했다. 전체 빌드 통과. 서버 API 원본의 TypeScript 검사도 빌드에 포함했다.
- 과거 브라우저 SDK 직접 쓰기 테스트는 이제 운영 정책과 맞지 않는다. 새 서버 테스트를 기준으로 삼는다. 이메일 인증 auth-preview는 역사적 별도 실험이며 운영 로그인 화면이 아니다.

운영 메일 발송, 운영 배포, 실제 예약 정리, 부하 검증은 미실행이다. 배포 전 추가 승인이 필요하다.

최종 정책 검증: 총무·전체·미디어 관리자에게 OTP가 요구되지 않고, 서버 관리자에게만 요구됨을 통합 테스트에서 확인했다. 총무·전체·미디어 관리자도 아이디/실명을 아는 사람의 사칭 가능성이 남는다.
