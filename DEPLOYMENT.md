# DFMC 모영 (Moyoung) 프로덕션 배포 및 운영 가이드

본 문서는 **둔산제일교회 동호회(모영) 플랫폼**의 프로덕션 빌드, 클라우드 호스팅 배포(Render, Cloudtype, Railway 등) 및 데이터베이스 백업/운영 관리 방법을 안내합니다.

---

## 1. 시스템 아키텍처 개요

- **프론트엔드**: Vite + React 18 + TypeScript + Modern Vanilla CSS (PWA & 모바일 반응형)
- **백엔드**: Node.js + Express + TypeScript
- **데이터베이스**: SQLite (`better-sqlite3`, WAL 모드 활성화)
- **장점**: 별도의 무거운 외부 DB 인스턴스(MySQL, Oracle 등) 없이 단일 Node.js 컨테이너로 100% 자급 구동되며, 1GB 무료/초저비용 호스팅에 최적화되어 있습니다.

---

## 2. 로컬 실행 및 프로덕션 빌드

### 1) 개발 모드 실행 (1클릭 동시 구동)
```bash
# 프로젝트 루트(DFMC_Moyoung)에서 실행
npm run dev
```
- 프론트엔드: `http://localhost:3000` (Vite HMR 지원)
- 백엔드 API: `http://localhost:5000` (Express 자동 재시작)

### 2) 프로덕션 빌드 명령
```bash
# 프론트엔드 빌드 (결과물: client/dist)
npm run build:client

# 백엔드 빌드 (결과물: server/dist)
npm run build:server
```

---

## 3. 무료 및 저비용 클라우드 배포 가이드

### 🚀 추천 플랫폼 1: Render.com (Web Service)
1. **GitHub 리포지토리 연결**:
   - Render 대시보드에서 `New +` -> `Web Service` 선택 후 리포지토리 연동.
2. **빌드 및 실행 설정**:
   - **Environment**: `Node`
   - **Build Command**:
     ```bash
     npm install && npm run build
     ```
   - **Start Command**:
     ```bash
     npm run start
     ```
3. **디스크 마운트 (Persistent Disk)**:
   - SQLite 데이터 및 사진 파일 보존을 위해 `Disks` 탭에서 마운트 추가:
     - **Name**: `dfmc-data`
     - **Mount Path**: `/app/server/data`
     - **Size**: 1 GB
4. **환경 변수 (Environment Variables)**:
   ```env
   NODE_ENV=production
   PORT=5000
   JWT_SECRET=dfmc_super_secure_jwt_secret_2026
   SMTP_USER=baehh4159@gmail.com
   SMTP_PASS=구글_앱_비밀번호_16자리
   ```

---

### 🚀 추천 플랫폼 2: Cloudtype (국내 호스팅)
1. Cloudtype 대시보드에서 `새 프로젝트 생성` -> `Node.js` 선택.
2. GitHub 저장소 연동 후 루트 디렉토리 설정.
3. 빌드 명령어: `npm run build`, 시작 명령어: `npm run start` 입력.
4. 스토리지 볼륨을 `/server/data`에 연결하여 재배포 시에도 회원/투표 데이터 영구 보존.

---

## 4. 데이터베이스 백업 및 긴급 복구 매뉴얼

### 1) 데이터베이스 파일 위치
- `server/data/dfmc.db` (메인 데이터베이스)
- `server/data/dfmc.db-wal` (Write-Ahead Logging 로그)
- `server/data/dfmc.db-shm` (공유 메모리)

### 2) 간편 백업 (1초 완료)
`dfmc.db` 파일만 복사하여 구글 드라이브나 별도 저장소에 보관하면 전체 회원, 투표, 피드, 사진, 댓글 데이터가 100% 보존됩니다.

### 3) 서버 관리자 2단계 인증 긴급 잠금 해제 (CLI / DB 직접 수정)
서버 관리자 계정(`dfmc8470`)이 5회 연속 인증 실패로 영구 잠금(`is_locked = 1`)되었을 경우:
```sql
-- SQLite 콘솔 또는 DB Browser for SQLite에서 실행
UPDATE server_security 
SET is_locked = 0, fail_count = 0, cooldown_until = 0 
WHERE id = 1;
```
위 한 줄 실행으로 즉시 잠금이 해제되고 다시 정상 로그인이 가능해집니다.

---

## 5. 관리자 및 역할 계정 안내

| 역할 | 기본 아이디 | 기본 비밀번호 | 주요 권한 |
|---|---|---|---|
| **서버 관리자** | `dfmc8470` | `admin1234` (테스트 환경 비밀번호 생략 가능) | 2FA 이메일 보안 인증, 1GB 용량 게이지, 전체 관리자 임명/해임 |
| **전체 관리자** | `pastor` (김목사) | 없음 (테스트 바 1클릭 지원) | 셀 개편, 모영 개설/삭제, 미디어 관리자 선임, 총무 총괄 |
| **미디어 관리자**| `user15` (신민재) | 없음 | 환영 문구 수정, 팝업창 관리, 전체 공지 단일 등록 |
| **모영 총무** | `user1` (이주환) | 없음 | 모영 소개 수정, 투표 개설/마감, 일정 등록, 총무 2인 자율 위임 |
| **일반 성도** | `user50` (도하준) | 없음 | 전 모영 자율 참여, 실시간 투표, 나눔 피드 작성, 댓글, 이모지 반응 |
