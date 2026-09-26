# 로컬 백필 리허설

2026-09-27. 기존 미리보기 JSON을 실제 Firestore 에뮬레이터에 넣고 피드/홈 결과를 대조한다. 운영 이전 도구가 아니다.

## 실행

~~~powershell
npx --yes --package=node@22 -- node node_modules/firebase-tools/lib/bin/firebase.js emulators:exec --project demo-moyoung --config firebase.auth-preview.json --only firestore "node functions/scripts/rehearseBackfill.mjs functions/tests/migration-preview.example.json scratch/new-backfill-report.json 2026-09-27T00:00:00Z"
~~~

이미 같은 출력 파일이 있으면 다른 이름을 사용한다. 입력 형식은 [미리보기](MIGRATION_PREVIEW.md)와 같다. 출력은 판정/건수/불일치 위치만 기록하고 원본 본문이나 계정 정보를 복사하지 않는다. 결과 matched:true가 로컬 피드·홈 대조 통과를 의미한다.

대상은 코드에 고정된 127.0.0.1:8080, demo-moyoung, migration-rehearsal 데이터베이스다. 운영 프로젝트·호스트·데이터베이스 인자는 받지 않는다. 기본 auth-preview 데이터베이스와 분리되어 있으며 실제 Auth 계정이나 identityMappings를 연결하지 않는다.

## 처리와 반복 실행

1. 이전 미리보기에서 문제가 하나라도 나오면 중단한다.
2. 모임+원본 합계 최대 300건을 처리한다. 원본 충돌을 모두 읽은 뒤 같은 트랜잭션에서 없는 자료만 만든다. 기존 원본 내용이 다르면 덮어쓰지 않는다.
3. 실제 서비스의 reconcileFeedSource 함수로 피드를 생성한다. 중복 실행은 같은 카드 ID를 유지하며 기존 참여 집계를 보존한다.
4. 원본 정규화 결과와 피드 필드/개수를 대조한다.
5. 가상 rehearsal_member 프로필과 모임 멤버십으로 실제 홈 요약 함수를 실행한다. 가까운 일정과 회원 홈 값을 비교한다.

가상 모임명은 ‘로컬 검증 모영’이다. 실제 모임 이름·회원 계정/권한 이전이나 기존 votes/attendees 집계 가져오기는 수행하지 않는다. 기본 데이터베이스 이벤트 트리거는 이 별도 데이터베이스에서 실행되지 않으므로 후처리 함수를 명시적으로 호출한다. 이 검증은 백필 함수의 결과 검증이며 이벤트 전달 검증은 기존 에뮬레이터 테스트의 책임이다.

대상 모임에 입력 밖의 피드가 남아 있으면 개수 대조가 실패한다. 데이터를 자동 삭제하지 않는다. 새로운 에뮬레이터 세션을 사용하거나 입력 범위를 확인한다. 중간 실패는 부분 결과를 남길 수 있지만 동일 입력으로 재실행할 수 있다. CLI 실패 시 보고서는 completed:false를 기록한다. 에뮬레이터를 export하지 않고 종료하면 로컬 데이터는 유지되지 않는다.

## 검증

신규 백필 테스트 1개와 기존 미리보기 테스트 2개, 합계 3개 통과. 샘플 CLI 실행도 matched:true, mismatches:[]로 완료했다. 전체 빌드 통과(기존 번들 크기 경고 유지).

검증 항목: 피드/홈 대조, 같은 입력 재실행 시 카드 ID·개수 유지, 하트 집계 유지, 다른 원본 입력 덮어쓰기 거부, 매핑 오류 사전 차단. 기존 실행 경로는 변경하지 않았으며 이번에는 백필 관련 테스트만 실행했다.

## 변경 파일

- functions/src/localBackfill.js: 고정 로컬 DB 준비·백필·결과 대조
- functions/scripts/rehearseBackfill.mjs: CLI와 새 보고서 출력
- functions/tests/localBackfill.test.mjs: 에뮬레이터 검증
- docs/LOCAL_BACKFILL.md, README.md, PROJECT_STRUCTURE.md, MIGRATION_PREVIEW.md
- ARCHITECTURE_AND_FILE_MAP.md, FULL_CHANGELOG.md

다음 운영 준비 범위는 실제 내보내기 자료의 입력 변환/완전성 검사, 원본 대조와 계정 소유권 검토, 대규모 분할 백필·진행 지점·롤백 계획이다. 운영 적용이나 배포는 하지 않았다.
