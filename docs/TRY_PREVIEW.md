# 모영 직접 실행하기

START_MOYOUNG_PREVIEW.cmd를 더블클릭하고 http://127.0.0.1:3001 에 접속한다.

사용자의 기존 App/LoginPage/LobbyPage/ClubDetailPage와 CSS를 그대로 사용한다. 화면 재디자인은 없다. 기존 시드가 로컬에 생성된 뒤 로그인 아이디 member1, 이름 홍길동으로 확인할 수 있다. 운영 데이터가 아닌 기존 코드의 샘플 데이터다.

ui-preview 모드는 demo-moyoung-ui 프로젝트의 Firestore(8082), Storage(9198) 에뮬레이터로만 연결한다. 기존 운영용 SDK 설정과 배포 규칙은 변경하지 않았다. 시작 창은 유지하고 종료 시 Ctrl+C를 누른다. Java 21, Node/npm과 프로젝트 의존성이 필요하다.

새 이메일 인증/통합 피드 검증 화면은 START_AUTH_TEST_PREVIEW.cmd로 별도 실행한다(3000). 이는 개발 검증 전용이며 기존 UI에 신규 백엔드를 연결한 완성 화면이 아니다. 앞으로 UI 작업은 기존 화면 컴포넌트를 기준으로 진행한다.
## 로컬 관리자·총무
현재 생성된 계정은 전체관리자 previewadmin / 체험관리자, 풋살 총무 previewfutsal / 체험총무다. 기존 아이디/이름 방식으로 로그인한다. 에뮬레이터를 재시작했다면 기존 UI 시드가 준비된 뒤 node functions/scripts/prepareUiRoles.mjs로 다시 만든다. 실제 운영 계정은 아니다.
인증 검증 전용 START_AUTH_TEST_PREVIEW.cmd에서는 preview@example.test 계정을 사용하며 실행 창에 로컬 비밀번호를 표시한다. 두 실행의 계정을 혼용하지 않는다.
운영 사이트는 https://moyoung-abd47.web.app 이며 기존 계정을 사용한다. Hosting 배포는 완료됐지만 신규 이메일 인증 통합은 아직이다.
