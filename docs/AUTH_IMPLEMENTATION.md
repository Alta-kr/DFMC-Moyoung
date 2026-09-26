# 이메일 인증 로컬 검증

이 단계는 운영 전환 전의 인증 구현이다. demo-moyoung과 로컬 127.0.0.1만 사용한다. 기존 회원/역할에 자동 연결하지 않으며 일반 프로필에는 uid/name/member 역할/생성시각만 저장한다. 비밀번호와 이메일 복사본은 Firestore에 저장하지 않는다.

저장소 루트의 첫 터미널:

```powershell
node node_modules/firebase-tools/lib/bin/firebase.js emulators:start --project demo-moyoung --config firebase.auth-preview.json --only auth,firestore
```

두 번째 터미널:

```powershell
npm run dev --prefix client -- --mode auth-preview
```

브라우저에서 개발 서버 주소에 접속한다. 이메일 인증/비밀번호 재설정 링크는 에뮬레이터 터미널에서 확인한다. 에뮬레이터는 실제 이메일을 보내지 않는다. 새로고침 시 세션 복원, 로그아웃, 프로필 복구를 확인한다.

자동 통합 테스트(위 에뮬레이터가 종료된 상태):

```powershell
node node_modules/firebase-tools/lib/bin/firebase.js emulators:exec --project demo-moyoung --config firebase.auth-preview.json --only auth,firestore "node --experimental-strip-types --test client/tests/emailAuth.test.ts"
```

Node의 TypeScript strip 지원과 Java 21이 필요하다. 최초 실행은 에뮬레이터 다운로드가 필요할 수 있다. firebase.auth-preview.json은 검증 전용으로 운영 배포에 사용하지 않는다. 기본 npm run build는 기존 앱을 빌드하며 이 화면을 활성화하지 않는다.

현재 프로필 Rules는 생성/자기 조회만 허용한다. 프로필 수정·탈퇴·목록은 거부한다. 후속 단계에서 본인 홈 요약과 가입 모임 피드 읽기를 추가했으며 앱 전체 운영 Rules는 아니다. 계정 소유권 확인/uid 매핑, 기존 게스트/관리자 정책, 앱 전체 Rules/Functions 전환 후 운영 UI에 연결해야 한다.

공식 참조: [이메일/비밀번호 인증](https://firebase.google.com/docs/auth/web/password-auth), [Auth 에뮬레이터](https://firebase.google.com/docs/emulator-suite/connect_auth).

## 검증 결과 (2026-09-27)

전체 npm run build 및 Auth/Firestore 에뮬레이터 통합 테스트 통과. 가입, 재로그인, 잘못된 비밀번호, 인증/재설정 요청, 프로필 재시도/복구, 미인증·타인 조회·역할 상승·추가 권한 필드 거부를 확인했다. 브라우저 수동 UI/새로고침 검증은 미실행이다. 운영 앱 전환/배포는 하지 않았다.


## 후속 단계

홈/피드와 관리자 Functions 실행은 [최신 구현 안내](FEED_AND_MEMBERSHIP.md)를 따른다.
