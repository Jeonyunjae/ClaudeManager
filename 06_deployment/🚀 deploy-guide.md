# 배포 가이드
> 작성: deployer | 상태: 작성 완료 (Spark 워크스테이션 기준) | 최종 갱신: 2026-09-23
> 이 문서의 절차는 2026-09-11 ~ 09-14, 09-23(PM2) 에 실제로 수행해 확인한 것이다.
> 아직 외부 배포는 하지 않았다 — 내부망 워크스테이션 상시 기동이 현재 운영 형태다.

---

## 1. 대상 환경

호스트·포트·경로·스택 버전은 **[[📇 facts]]** 에 있다 — 이 문서는 값을 옮겨 적지 않는다.
([[📇 facts#포트]] · [[📇 facts#호스트]] · [[📇 facts#경로]])

> `next dev` 는 포트를 정한 뒤에야 `.env.local` 을 읽는다. 그래서 과거 엉뚱한 포트로
> 떠서 접속이 어긋난 적이 있다. 지금은 `scripts/next-with-env.mjs` 래퍼가 `PORT` 를
> 먼저 읽어 `--port` 로 넘긴다.

---

## 2. 기동 절차

### 2.1 PostgreSQL

```bash
cd ~/Desktop/00.jyj/01.project/02.LLMManager/04_development/app
sudo docker compose up -d
sudo docker ps --filter name=claudemanager-db     # 0.0.0.0:5434->5432/tcp 확인
```

> `dmoa` 는 docker 그룹에 없어 **sudo 가 필요하다.** TTY 없는 세션(Claude Code 등)에서는
> 암호 입력이 불가능하므로 사람이 별도 터미널에서 실행해야 한다.

### 2.2 마이그레이션

```bash
pnpm db:migrate
```

`drizzle.config.ts` 가 `.env.local` 을 직접 읽는다. `DATABASE_URL` 이 없으면
폴백으로 엉뚱한 DB 에 붙지 않고 즉시 실패한다.

### 2.3 앱

```bash
pnpm install
bash scripts/setup-pm2.sh install   # 상시 기동 — PM2 등록 + 저장 + 부팅 자동 기동
```

상시 기동은 **PM2 로만 한다.** 앱은 `claudemanager` 한 프로세스이고, 내부적으로는
`next dev` 가 앱과 WS 를 함께 띄운다 ([[📇 facts#포트]]).

```bash
pm2 status                       # 상태
pm2 logs claudemanager           # 로그 (파일: ~/.claudemanager/logs/app-*.log)
pm2 restart claudemanager        # 재시작 — 코드 반영 등
```

> **Claude Code 세션에서 `pnpm dev` 를 백그라운드 작업(`run_in_background`)으로
> 띄우지 말 것.** 그 서버는 세션의 자식이라 세션이 끝날 때 함께 종료된다.
> 2026-09-23 15:06 에 실제로 이렇게 내려갔고, 재시작이 잦아 백업 스케줄러
> (기동 24시간 뒤 첫 실행)가 7일간 한 번도 돌지 못했다.
> 포트를 이미 PM2 가 잡고 있으므로 `pnpm dev` 를 따로 띄우면 `EADDRINUSE` 가 난다.

`scripts/pm2-start.sh` 가 기동 전에 **이전 인스턴스의 고아 프로세스를 치운다.**
`next dev` 는 next-server 자식을 따로 띄우므로, 부모가 비정상 종료하면 고아가
포트를 잡아 새 인스턴스가 `EADDRINUSE` 로 재시작만 반복한다. 작업 디렉터리가
이 앱인 프로세스만 죽이므로 다른 서비스는 건드리지 않는다.

부팅 자동 기동은 사용자 crontab `@reboot pm2 resurrect` 다. `pm2 startup` 은 sudo 가
필요하고, 사용자 systemd 유닛은 linger 가 꺼져 있어 로그인 전에 뜨지 않는다.
crontab 에 nvm 의 node 경로가 박혀 있으므로 **node 버전을 바꾸면
`bash scripts/setup-pm2.sh boot` 를 다시 실행한다.**

WebSocket 서버는 **Next 의 instrumentation 이 함께 기동한다.**
`pnpm ws:dev` 를 따로 실행하면 WS 포트가 겹쳐 `EADDRINUSE` 가 난다 — 둘 중 하나만 띄운다.

기동 확인:

```
- Local:  http://localhost:3010
✓ Ready
[WS] WebSocket server listening on port 3001
```

### 2.4 최초 1회 — 관리자 비밀번호

계정이 0개인 상태에서는 `/login` 이 아무 값도 받지 않는다 (`AUTH_NOT_SETUP`).
**`/setup` 으로 직접 들어가 비밀번호를 등록한다** (4자 이상, bcrypt 해시 저장).
루트(`/`)는 토큰이 없으면 `/login` 으로만 보내므로 `/setup` 은 주소로 직접 연다.

---

## 3. 랜에서 접속하기

접속 주소는 [[📇 facts#호스트]].

`next.config.ts` 의 `allowedDevOrigins` 에 접속 출처가 등록돼 있어야 한다.
빠져 있으면 **화면은 그려지는데 버튼·입력이 전부 먹지 않는다** — Next dev 가
localhost 외 출처의 `/_next/*` 를 차단해 하이드레이션이 일어나지 않기 때문이다.
에러 화면이 아니라 "그냥 반응이 없는" 형태로 나타나므로 증상만으로는 알기 어렵다.

```ts
allowedDevOrigins: ['192.168.30.24', 'spark-3f44', 'spark-3f44.local'],
```

---

## 4. 백업과 복구

### 4.1 백업

24시간 간격 자동 실행. 저장 위치는 `$CLAUDEMANAGER_HOME/backups` (= `~/.claudemanager/backups`).

| 파일 | 내용 |
|---|---|
| `db-<timestamp>.sql` | DB 덤프 |
| `orchestrator-<timestamp>.tar.gz` | `.orchestrator/` 압축 |

보존 개수는 `settings.backup_retention_count` (기본 7), 주기는 `backup_interval_hours` (기본 24).

> **덤프 방식이 두 가지다.** `pg_dump` 가 있으면 그것을 쓰고(스키마 포함),
> 없으면 앱의 pg 커넥션으로 **데이터만** 덤프한다. 이 워크스테이션에는
> postgresql-client 가 없고 설치에 sudo 가 필요해 현재는 후자로 동작한다.
> 덤프 파일 첫 줄에 어느 방식인지 적힌다.

### 4.2 복구

```bash
# 1) 빈 DB 를 올리고 스키마부터 만든다 (데이터 전용 덤프에는 스키마가 없다)
pnpm db:migrate

# 2) 덤프를 적용한다
psql "$DATABASE_URL" -f ~/.claudemanager/backups/db-<timestamp>.sql
# psql 이 없으면 컨테이너 안에서:
sudo docker exec -i claudemanager-db psql -U claudemanager -d claudemanager < <덤프파일>
```

`.orchestrator/` 는 tar 를 `$CLAUDEMANAGER_HOME` 에 풀면 된다.

> **에이전트 레코드를 잃었을 때**: `.orchestrator/<partId>/sub-contexts/<agentId>.md` 의
> **경로 자체가 Part·Agent 의 UUID** 다. 파일이 남아 있다면 같은 ID 로 레코드를
> 되살릴 수 있고, 그래야 Sub 가 자기 컨텍스트 파일을 다시 찾는다.
> 새 ID 로 만들면 그 파일은 고아가 된다.

---

## 5. 상태 점검

```bash
bash .scripts/check-runtime.sh
```

포트 3개가 LISTEN 인지, 앱이 200 을 주는지, 최근 백업이 0바이트가 아닌지를 본다.
검사에 쓰는 값은 [[📇 facts]] 에서 읽으므로 포트가 바뀌어도 스크립트는 그대로다.

`0바이트 덤프가 completed 로 기록되던 버그`가 있었으므로, 백업은 DB 기록이 아니라
**파일 크기로** 확인한다.

---

## 6. 아직 하지 않은 것

- 외부 배포 (도메인·TLS·리버스 프록시 없음, 내부망 전용)
- 실제 재부팅으로 자동 기동 확인 — `pm2 kill` 후 cron 과 같은 최소 환경에서
  `pm2 resurrect` 로 복구되는 것까지만 확인했다. 부팅 시 DB 컨테이너는
  `restart: unless-stopped` 로 뜬다
- 프로덕션 빌드 기동(`pnpm build && pnpm start`) 검증 — 빌드 성공까지만 확인했다
