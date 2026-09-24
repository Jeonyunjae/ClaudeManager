# Changelog

이 파일은 [Keep a Changelog](https://keepachangelog.com/ko/1.1.0/) 형식을 따른다.
요구사항 코드(`FR-`·`NFR-`·`INT-`·`UIR-`)와 결함 코드(`DF-`)를 각 항목에 괄호로 병기한다.

## [Unreleased] - 모바일 웹 Phase 1 (`feat/mobile-web`)

### Added
- 폭 판정 기반 모바일 자동 전환 + 데스크톱 보기 수동 전환·복귀 (FR-001, FR-002, UIR-001)
- 로그인 성공 시 `next` 파라미터(같은 출처 상대 경로만)로 원래 화면 복귀 — Open Redirect 방지
- `/m` 공통 셸: 인증 가드, WS 연결, 진입 시 inbox·notifications·tree 조회 (공통 EVT-SH-3)
- SCR-M01 대화 목록 + 답변 대기 인박스(확인함 처리 포함) (FR-006, FR-007)
- SCR-M02 대화 화면: 메시지 목록·전송·재전송·스트리밍·대기열·이전 대화 무한 스크롤, 실시간 스토어(`mobileChatStore`)·WS 반영 (FR-004, FR-005, FR-007)
- SCR-M03 알림 목록: 읽음·모두 읽음 처리, 무한 스크롤, 탭 시 해당 화면 이동 (FR-009, FR-013)
- SCR-M04 상태 화면: Part·Sub·Instance 트리 상태 카드, 실시간 반영, 데스크톱 상세 보기 이동 (FR-014, FR-015, FR-002)
- 웹 푸시 구독 켜기/끄기, VAPID 키 조회, 서비스워커 알림 클릭 시 해당 화면 이동 (FR-010, FR-011, FR-012, FR-013)
- 알림 생성 공통 함수 `createNotification`(insert → WS 방송 → 푸시 fire-and-forget) 도입
- iPhone 홈 화면 설치 지원(PWA manifest·아이콘·설치 안내 배너) (FR-003)
- 로그인 만료 임박(≤2일) 토큰 자동 갱신 + 401 응답 시 토큰 삭제·로그인 화면 이동 (NFR-003)
- HTTPS(Tailscale serve) 접속 경로에서 `NEXT_PUBLIC_WSS_PORT`로 별도 포트 wss 접속 지원 (INT-001)
- 테스트 인스턴스(`claudemanager-mtest`) PM2 설정·DB 준비 스크립트, `CM_BACKGROUND_JOBS=off`로 기동 작업 분리해 운영과 격리 (NFR-002)
- WS `connection:open` 재연결 전이 감지 + 화면별 재조회(목록: inbox·tree / 대화: conversations 1페이지), 앱이 백그라운드에서 돌아올 때(`visibilitychange`) 연결 상태 확인 후 재연결 시도 (FR-005, DES-006 EVT-SH-1·EVT-SH-2)
- `apiClient.del(path, body?)` — DELETE 요청에 JSON 바디를 실어 보낼 수 있도록 확장 (기존 바디 없는 호출부와 호환) (DF-012)
- `CHANGELOG.md` 신설 (Keep a Changelog 형식)

### Changed
- `mobileChatStore.send`가 `Promise<boolean>`을 반환하도록 확장해, 전송 실패 시 호출부가 후속 처리(입력 복원)를 판단할 수 있게 함
- `usePushSubscription`의 구독 해제(`DELETE /api/notifications/subscribe`) 호출을 `fetch` 직접 호출에서 `apiClient.del(path, body)`로 되돌려, 다른 API 호출과 동일한 401 처리·인증 헤더 경로를 재사용 (DF-012)
- 알림 생성 호출 5곳(에이전트 응답 완료·오류, 키 만료 등)을 `createNotification` 공통 경로로 통일
- 로그인·설정 화면을 360px 폭에서 가로 스크롤 없이 보이도록 카드 레이아웃 조정 (UIR-001, 데스크톱 레이아웃 무변경)

### Fixed
- SCR-M02 전송 실패 시 입력 내용이 복원되지 않던 문제 — 실패하면 `MessageComposer` 입력창에 보낸 내용을 되돌린다(그 사이 새로 입력을 시작했으면 덮어쓰지 않음). 실패 버블의 [다시 보내기]는 기존과 동일하게 유지 (DF-009)
- 이전 대화(SCR-M02, EVT-M02-4)·알림 목록(SCR-M03, EVT-M03-7) 추가 로딩 실패 시 재시도 UI가 없던 문제 — 각 스토어에 `loadMoreError` 상태를 추가하고, 실패 시 스크롤에 의한 자동 재시도를 멈추고 화면에 "다시(시도)" 버튼을 노출한다 (DF-011)
- `apiClient.del`이 요청 바디를 받지 못해 바디가 필요한 `DELETE /api/notifications/subscribe`를 `usePushSubscription.ts`가 `fetch`로 우회 호출하던 문제 (DF-012)
- 알림 API `GET` total 필터·`mark-read` 처리 건수 불일치 (DF-005)
- 최초 비밀번호 설정 후 폐기된 `/workspace`(v3 Phase 2 3D 화면)로 이동하던 문제 — 폭에 따라 `/m/chat` 또는 `/dashboard`로 이동 (DF-006)
- 테스트 인스턴스(`claudemanager-mtest`)가 운영 env를 상속해 운영 DB에 접속한 사고 방지 — `env -i` 격리 + `.env.local` 검증 (DF-008, 대표 결정 D-15 대기 항목 별도 존재)
- 실시간(WS) `SERVER_EVENTS`에 누락되어 있던 `notification:read`·`chat:tool`·`chat:queue` 브로드캐스트 추가
- `allowedDevOrigins`에 Tailscale HTTPS 호스트 추가

## [Unreleased] - test 단계 결함 수정 (2026-09-24, `feat/mobile-web`)

### Fixed
- (치명) 서버 내부 WS 브리지(`ws-bridge.ts`)가 `localhost:3001` 상수로 고정되어 테스트 인스턴스(WS 3111)의 채팅 실행·방송이 운영 WS로 나가려던 문제 — `process.env.WS_PORT`를 우선 읽도록 수정(운영은 값이 그대로 3001이라 동작 무변경), 클라이언트 `ws.ts`의 `buildWsUrl`도 HTTP 접속 시 `NEXT_PUBLIC_WS_PORT`를 우선 사용, `mtest-env-check.mjs`에 비밀값(`WS_BROADCAST_SECRET`·`JWT_SECRET`) 필수·비기본값 검증과 운영 `.env.local`과의 비교 검증 추가 (BUG-001, DF-013 근본 원인)
- `mtest-env-check.mjs`가 `.env.local`만 보고 우선순위가 더 높은 `.env.development.local`·`.env.development`·`.env`의 존재를 확인하지 않아 fail-open 가능하던 문제, `export KEY=` 형식 줄 미인식 문제 (BUG-003)
- `mtest-env-check.mjs`·`mtest-db-setup.mjs`의 실패 메시지에 DB 접속 URL 비밀번호가 그대로 노출되던 문제 — 마스킹(`://user:***@host`) 적용 (SEC-002)
- 로그인 `next` 복귀 경로 검증(`safe-next.ts`)이 `%`-인코딩된 백슬래시·탭(`/%5Cevil.com`, `/%09/evil.com`)으로 감춘 오픈 리다이렉트를 걸러내지 못하던 문제 — 디코드 후 재검증 + `new URL()` 기반 origin 재확인으로 강화 (SEC-001)
- 데스크톱 TopNav에서 알림(targetUrl이 `/m/...`인 모바일 전용 경로)을 클릭하면 모바일 셸로 이동하던 문제 — `desktopTargetFor()`로 판정해 읽음 처리만 하고 이동하지 않음 (BUG-002, NFR-001)
- Postgres `now()::text` 형식(공백 구분자·마이크로초·`+HH`/`+HH:MM` 오프셋)이 일부 브라우저에서 Invalid Date로 파싱되어 "NaN"이 표시되던 문제 — `parseFlexibleTimestamp()`로 ISO 정규화 후 파싱, 실패 시 빈 문자열 (BUG-004)
- 알림 배지(`unreadCount`)가 서버 값이 아니라 최근 30건 목록 안에서 다시 계산되어 30건 밖의 안 읽은 알림이 배지에서 누락되던 문제 — 서버 `unreadCount`를 그대로 쓰고, 읽음 처리 시에도 목록 재계산이 아니라 실제 변경 건수만큼만 차감 (BUG-005)
- `GET /api/notifications` 응답의 `pagination.total`·`unreadCount`가 Postgres `count(*)`(bigint) 드라이버 매핑으로 문자열로 내려오던 문제 — `Number()`로 명시 변환 (BUG-013)
- 재연결 시 REST 재조회와 WS `chat:message` 수신이 겹치면 같은 메시지가 대화창에 중복 표시되던 문제 — `mobileChatStore.applyMessage`에 id 기준 중복 제거 추가 (BUG-008)
- 웹 푸시 권한 요청 창을 닫아 `'default'`가 반환된 경우에도 `denied`로 처리되어 [푸시 켜기] 버튼이 다시 나타나지 않던 문제 — `denied`는 명시적 거부일 때만, 그 외는 `default` 유지 (BUG-009)
- 모바일 대화 입력창에서 한글 등 IME 조합 중 Enter를 누르면 마지막 글자가 중복·잘리던 문제, 터치 기기에서 Enter가 줄바꿈 없이 바로 전송되어 여러 줄 메시지를 쓸 수 없던 문제 — `decideEnterAction()`으로 조합 중·터치 기기에서는 Enter를 기본 동작(조합 확정/줄바꿈)에 맡기고, 터치 기기는 전송 버튼으로만 전송 (BUG-010)
- CLI 응답을 저장·방송까지 마친 뒤 호출하는 알림 생성(`createNotification`)이 실패하면 예외가 바깥 catch로 빠져 이미 성공한 응답을 "[Error]"로 덮어쓰던 문제 — 알림 생성만 별도 try/catch로 감싸 실패를 로그로만 남김 (BUG-012)
- `POST /api/notifications/subscribe`가 endpoint 스킴·호스트를 검증하지 않아 인증된 사용자가 서버로 하여금 임의 URL에 POST하게 만들 수 있던 문제(SSRF) — https + 알려진 푸시 서비스 호스트(Apple/FCM/Windows/Mozilla)만 허용, 그 외는 400 VALIDATION_ERROR (SEC-003)
- `mtest-db-setup.mjs` 주석이 "운영 DB에 절대 연결하지 않는다"고 설명해 실제 동작(관리 URL로 같은 서버의 기존 DB에 접속해 조회·`CREATE DATABASE`만 수행 — 그 기존 DB가 운영 `claudemanager`일 수 있음)과 어긋나던 문제 — 주석을 실제 동작에 맞게 정정 (BUG-011, 일부 — 인라인 style·react-markdown 지연 로딩은 다음 Phase)
- `sendPushNotification`이 CJS 패키지 `web-push`의 ESM 동적 import 결과(`{ default: { setVapidDetails, sendNotification, ... } }`)를 언랩하지 않아 `webpush.setVapidDetails`·`webpush.sendNotification`이 항상 `undefined`가 되고, 매번 "web-push not available"로 오도해 실제 발송이 100% 무동작하던 문제 — `mod.default ?? mod`로 언랩 후 API 존재를 확인하고, 모듈 로드 실패와 발송 실패를 구분해 로그(발송 실패 로그는 엔드포인트 전체·키 대신 호스트명·statusCode만 기록)한다 (BUG-017)
- `POST /api/notifications/mark-read`의 ids 지정 분기가 `isRead=false` 조건 없이 매칭해, 이미 읽은 알림 id로 재호출해도 매번 `updated`가 변경 건수처럼 보고되고 `notification:read`가 불필요하게 재방송되던 문제 — ids 분기에도 '전체' 분기와 동일하게 `isRead=false` 조건을 걸고, 두 분기 모두 실제 변경 행이 있을 때만 방송한다 (BUG-016)
- `mtest-start.sh`가 `env -i`로 넘기는 `PATH`를 기동 셸의 `PATH`에만 의존해, claude CLI 위치(`~/.local/bin`)가 빠진 좁은 PATH로 재기동되면 `agent-manager.ts`의 `spawn('claude', ...)`가 매 채팅마다 ENOENT로 실패하던 문제 — `~/.local/bin`(존재할 때만)과 node 실행 경로를 명시적으로 PATH 앞에 붙이고, `claude` CLI를 못 찾으면 기동 시 경고를 남긴다. DF-008 격리(`env -i`로 운영 env 차단)는 그대로 유지한다 (BUG-015)
