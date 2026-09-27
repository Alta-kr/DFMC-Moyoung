# 데이터 이전 미리보기

2026-09-27. 로컬 JSON 입력을 검사하는 읽기 전용 준비 도구다. Firebase 초기화·로그인·운영 조회·DB 쓰기·실제 계정 연결 기능은 없다.

## 실행

~~~powershell
node functions/scripts/previewMigration.mjs functions/tests/migration-preview.example.json scratch/my-migration-report.json 2026-09-27T00:00:00Z
node --test functions/tests/migrationPreview.test.mjs
~~~

출력 파일은 새 파일이어야 한다. 기존 보고서와 입력은 덮어쓰지 않는다. 종료 코드 0은 구조 검사 통과, 2는 검토할 문제 발견, 1은 입력/실행 오류다. 0도 운영 이전 승인을 의미하지 않는다.

입력은 version: 1과 clubs/sources/accounts/identityMappings 배열이다. 동봉한 JSON은 가상 데이터 예시이며 Firestore 관리형 백업 형식과는 다르다. 실제 export를 이 형식으로 변환하는 수집 도구는 아직 없다. Firestore Timestamp는 명시적 시간대 ISO 문자열 또는 밀리초로 바꿔 제공한다.

- clubs: 실제 문서 id, membershipSchemaVersion. 준비되지 않은 모임은 제외한다.
- sources: collection, id, data. 기존 normalizeSource와 동일한 피드 규칙을 사용한다. feedClubId/feedSchemaVersion을 사전 매핑해야 하며 기존 숫자 club_id를 추측하지 않는다.
- accounts: 확인 대상 Auth uid 목록. 비밀번호·토큰·이메일·실명은 필요하지 않다.
- identityMappings: legacyId, uid, verificationRef. 일대일 중복과 uid 존재 여부, 증빙 참조 누락을 검사한다. 참조의 존재가 실제 소유권 증명을 뜻하지 않는다. 별도 검토가 필요하며 이름/이메일 일치만으로 연결하지 않는다.

출력은 원본 배열 위치, ID, 카드 종류/순위/시각, 문제 코드와 집계다. 원본 글 내용이나 계정 비밀 값, 증빙 내용은 복사하지 않는다. ID도 개인정보와 연결될 수 있으므로 보고서는 저장소에 커밋하지 않고 scratch에서 검토한다.

## 검사와 제한

중복 원본/모임/uid 연결, 카멜·스네이크 필드 충돌, 매핑 누락, 준비되지 않은 모임, 잘못된 생성/일정/마감 시각을 검사한다. 동일 입력과 기준 시각에는 동일 결과를 내고 입력 객체를 바꾸지 않는다.

이 도구는 입력 스냅샷의 후보 검사다. 실제 운영 Auth 계정 존재/활성 상태, 전체 기존 회원 중 누락된 계정, 기존 집계와의 대조, 데이터 수집 완전성은 검증하지 않는다. 원본 일괄 변경과 백필 적용·롤백 도구도 아직 없다. applySupported는 항상 false다.

## 검증 결과 및 파일

신규 테스트 2개 통과, 예시 CLI 실행 통과(카드 후보 1개/증빙 검토 후보 1개), 전체 빌드 통과. 기존 번들 크기 경고는 남아 있다. 기존 앱 동작 코드는 변경하지 않아 에뮬레이터 회귀 테스트는 이번 단계에서 재실행하지 않았다.

- functions/src/migrationPreview.js: 순수 검사 함수
- functions/scripts/previewMigration.mjs: 로컬 파일 CLI
- functions/tests/migrationPreview.test.mjs: 충돌·입력 보존·출력 제한 검증
- functions/tests/migration-preview.example.json: 가상 입력 예시
- docs/MIGRATION_PREVIEW.md 및 README/PROJECT_STRUCTURE, ARCHITECTURE_AND_FILE_MAP.md, FULL_CHANGELOG.md: 실행/구조/이력

다음 단계는 이 보고서를 기반으로 로컬 에뮬레이터에서만 백필 적용·대조·재실행을 검증하는 것이다. 운영 계정 연결과 배포는 별도다.

## 후속 구현
로컬 백필 적용과 피드/홈 대조 도구를 추가했다. [로컬 백필 리허설](LOCAL_BACKFILL.md)을 따른다. 이 미리보기 명령 자체는 계속 읽기 전용이다.

## 2026-09-27 후속: 기존 회원·총무·날짜 사전 검사

기존 명령/입력 버전은 유지하면서 `legacyUsers` 선택 배열을 추가했다. 배열을 제공하면 다음 형식의 회원을 검사한다.

```json
{"legacyId":"member1","id":3,"role":"member"}
```

- `legacyId`: 기존 users 문서 키. `identityMappings[].legacyId`와 일치해야 한다.
- `id`: 기존 양의 안전한 정수 회원 ID 또는 동일한 십진 문자열. 중복 ID·중복 문서 키를 거부한다. 선행 0과 큰 정수의 정밀도 손실을 허용하지 않는다.
- `role`, 선택 `is_guest`: 유효 역할과 게스트 여부. 게스트 총무를 거부하고 게스트의 Auth 연결은 정책 검토 항목으로 남긴다.
- 실명은 필요하지 않다. 같은 이름의 회원이라도 `manager_ids`로만 총무를 연결한다.
- `clubs[].manager_ids`: 최대 3개 고유 회원 ID. 이름만 있는 총무는 `EXPLICIT_MANAGER_IDS_REQUIRED`로 표시한다. `manager_names`는 표시용이며 자동 권한 승계에 사용하지 않는다.
- 기존 원본에 `club_id`가 있으면 `clubs[].legacyId`와 비교한다. 새 문서 ID가 기존 ID와 동일하면 별도 legacyId를 생략할 수 있다.

일정 시작/종료 역전, 문자열 일정과 startsAtMs/endsAtMs의 불일치, 투표 표시 날짜와 closesAtMs의 불일치, 카멜/스네이크 충돌도 검사한다. 잘못된 날짜를 조용히 마감된 항목으로 이전하지 않는다.

`readyForReview`는 입력 검사에 문제가 없다는 뜻이고 운영 전환 허가가 아니다. `applySupported`는 계속 false다. `legacyAudit.completenessVerified`도 false이며, 제공한 목록이 운영 전체인지 또는 실제 계정 소유권이 맞는지는 확인하지 않는다. `legacyUsers` 생략 시 기존 호환 검증만 수행한다.

검증: 순수 함수 테스트 **6개 통과**, 확장 예시 CLI **문제 0**, 전체 빌드 통과. 이름·비밀번호·증빙 내용이 결과에 포함되지 않고 입력이 변경되지 않는지 검증했다. DB 접근 경로는 추가하지 않았으며 운영 데이터/로그인/배포는 변경하지 않았다.
