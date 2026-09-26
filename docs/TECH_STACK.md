# 확인된 기술스택

아래는 2026-09-27 package.json의 선언 범위이며 설치/최신 버전을 뜻하지 않는다.

| 영역 | 구성 | 근거 |
| --- | --- | --- |
| UI | React/React DOM ^19.2.8 | client/package.json |
| 언어/빌드 | TypeScript ~6.0.2, Vite ^8.3.0 | client/package.json |
| 스타일 | 일반 CSS, lucide-react ^1.47.0; Tailwind 선언 없음 | client/src/index.css, App.css, client/package.json |
| 라우팅 | 상태와 URL query/history 처리 | client/src/App.tsx |
| Firebase | Web SDK ^12.19.0, Firestore, Storage | client/package.json, client/src/firebase/config.ts |
| 데이터 | fetch 인터셉터의 Firestore/Storage 직접 접근 | client/src/firebase/apiInterceptor.ts |
| 이메일 | @emailjs/browser ^4.4.1 | client/package.json |
| 호스팅 | Firebase Hosting, client/dist, SPA rewrite | firebase.json |
| 패키지 관리 | npm, 루트/client 잠금 파일 | package-lock.json, client/package-lock.json |
| 정적 검사 | oxlint ^1.81.0 | client/package.json |
| 레거시 | Express ^4.21.2, better-sqlite3 ^11.8.1, TS ^5.8.2 | server/package.json |

로컬 검증용 Auth 초기화, functions/(Node 22, firebase-admin 14.5.0, firebase-functions 7.4.0), firebase.auth-preview.json, firestore.preview.indexes.json이 추가되었다. 운영 경로는 아직 기존 구성이다. server/를 운영 서버로 되살리지 않는다.

## 루트에서 실행하는 기존 명령

- npm run dev --prefix client: 프론트엔드 개발
- npm run build --prefix client: TypeScript 검사와 Vite 빌드
- npm run lint --prefix client: oxlint
- npm run build: 레거시 server 빌드 후 client 빌드
- npm run dev: 레거시 server와 client를 함께 실행

기존 루트 package.json에는 test 스크립트가 없다. firebase.auth-preview.json에 별도 Emulator 설정이 있으며 테스트 명령은 FEED_AND_MEMBERSHIP.md를 따른다. scratch 스크립트를 검증 없이 운영 연결 상태로 실행하지 않는다. 코드 변경 시 빌드를 검증하고 Auth/Rules 구현 시 격리된 Emulator 테스트를 추가한다.
