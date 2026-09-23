# 📇 facts — 값의 단일 소스

> 최종 확인: 2026-09-14 (spark-3f44 에서 실측)

**이 문서는 값을 적는 유일한 곳이다.** 포트·호스트·경로·명령·버전은 여기에만 쓰고,
다른 문서는 값을 옮겨 적지 말고 `[[📇 facts#포트]]` 처럼 가리킨다.

값이 여러 문서에 흩어져 있으면 반드시 썩는다 — 실제로 DB 포트가 `5433` 인 채로
네 문서에 박혀 있었고, 그 사이 실제 포트는 `5434` 로 바뀌어 있었다. 문서대로
접속하면 이 장비의 5432 에 떠 있는 **다른 프로젝트의 Postgres** 에 붙는 상태였다.

> 값을 고칠 때: 여기만 고친다. 다른 문서에 같은 값이 박혀 있으면 그건 버그이며,
> `bash .scripts/check-doc-facts.sh` 가 찾아준다.

---

## 포트

| 대상 | 포트 | 비고 |
|---|---|---|
| 웹 앱 | **3010** | `.env.local` 의 `PORT` |
| WebSocket | **3001** | `.env.local` 의 `WS_PORT`. Next instrumentation 이 함께 기동한다 |
| PostgreSQL | **5434** | 호스트 5434 → 컨테이너 5432 |

- **3000 은 쓰지 않는다.** 이 장비에서는 Open WebUI 가 점유하고 있다.
- **5432 도 쓰지 않는다.** 다른 프로젝트(open_mes)의 Postgres 가 떠 있다.
- `pnpm ws:dev` 를 따로 띄우면 3001 이 겹쳐 `EADDRINUSE` 가 난다. 둘 중 하나만 띄운다.

## 호스트

| 항목 | 값 |
|---|---|
| 호스트명 | spark-3f44 |
| 랜 주소 | 192.168.30.24 |
| OS | Ubuntu (aarch64) |
| 접속 주소 | http://192.168.30.24:3010 |

랜에서 접속하려면 `next.config.ts` 의 `allowedDevOrigins` 에 출처가 등록돼 있어야 한다.
빠지면 화면은 뜨는데 버튼·입력이 전부 먹지 않는다 (하이드레이션 차단).

## 경로

| 항목 | 값 |
|---|---|
| 앱 소스 | `04_development/app` |
| 런타임 홈 | `~/.claudemanager` (`CLAUDEMANAGER_HOME`) |
| 프로젝트 폴더 | `~/.claudemanager/projects/<프로젝트명>` |
| Sub 컨텍스트 | `~/.claudemanager/.orchestrator/<partId>/sub-contexts/<agentId>.md` |
| 백업 | `~/.claudemanager/backups` |

> Sub 컨텍스트 파일은 **경로 자체가 Part·Agent 의 UUID** 다. DB 를 잃어도 이 경로에서
> ID 를 읽어 같은 ID 로 복원할 수 있다. 새 ID 로 만들면 그 파일은 고아가 된다.

## 접속 문자열

```
postgresql://claudemanager:<비밀번호>@127.0.0.1:5434/claudemanager
```

실제 값은 `04_development/app/.env.local` 의 `DATABASE_URL` 에 있다 (git 에 없음).

## 명령

모두 `04_development/app` 에서 실행한다.

| 명령 | 용도 |
|---|---|
| `sudo docker compose up -d` | PostgreSQL 기동 — **sudo 필요** (`dmoa` 는 docker 그룹에 없다) |
| `pnpm db:migrate` | 마이그레이션 적용 |
| `pnpm db:generate` | 스키마 변경분으로 마이그레이션 생성 |
| `pnpm dev` | 개발 기동 (앱 + WS). 포트는 `.env.local` 에서 읽는다. 상시 기동은 PM2 가 하므로 따로 띄우면 포트가 겹친다 |
| `pm2 restart claudemanager` | 상시 기동 중인 앱 재시작 (`scripts/setup-pm2.sh` 참고) |
| `pnpm build` | 프로덕션 빌드 |
| `pnpm lint` / `pnpm test` | 린트 / 테스트 |

## 스택

| 항목 | 버전 |
|---|---|
| Next.js | 16.2.3 (Turbopack) |
| Node / pnpm | 22 / 9 |
| PostgreSQL | 17-alpine (docker, 컨테이너 `claudemanager-db`) |
| ORM | Drizzle (`drizzle-orm/node-postgres`) |
| 마이그레이션 | `0000` ~ `0006` |

## 최초 1회 설정

계정이 0개면 `/login` 은 어떤 값도 받지 않는다 (`AUTH_NOT_SETUP`).
**`/setup` 을 주소로 직접 열어** 비밀번호를 등록한다 (4자 이상, bcrypt).
루트(`/`)는 토큰이 없으면 `/login` 으로만 보내므로 `/setup` 에 자동으로 도달하지 않는다.
