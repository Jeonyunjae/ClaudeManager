# 기술 결정 사항
> ✏️ 작성 완료 후 CLI에서 **"기술 결정 완료"** 입력

---

## 1. 플랫폼
- [x] 웹 (반응형 — 데스크톱 주, 모바일 보조)

## 2. 프로그래밍 언어
- 프론트엔드: TypeScript
- 백엔드: TypeScript (Node.js)
- Skill 스크립트: Bash

## 3. 프레임워크
- 프론트엔드: Next.js 14+ (App Router)
- 백엔드: Next.js API Routes + 별도 WebSocket 서버 (ws)
- 상태 관리: Zustand (가볍고 심플)
- CSS: Tailwind CSS + shadcn/ui (데이터 뷰, 설정 등 일반 UI)

## 4. 데이터베이스
- 종류: SQLite (better-sqlite3, 동기 API)
- ORM: Drizzle ORM (타입 안전, SQLite 네이티브 지원, 경량)
- 호스팅: 로컬 파일 (`$CLAUDEMANAGER_HOME/data/claudemanager.db`)
- 마이그레이션: Drizzle Kit

## 5. 서버 / 인프라
- [x] 직접 (MacBook → Mac Mini Pro)
- 프로세스 관리: PM2 + macOS launchd
- 리버스 프록시: Caddy (Phase B, 외부 접근 시)
- 외부 접근: Cloudflare Tunnel (Phase B에서 결정)

## 6. 인증
- [x] JWT (단순 토큰 기반)
- 1인 사용자이므로 간단하게:
  - 최초 설정 시 비밀번호 1개 등록
  - 로그인 → JWT 발급 → 이후 토큰 인증
  - 토큰 만료: 7일 (자동 갱신)
  - API 키 암호화: AES-256-GCM (환경변수로 마스터 키 관리)

## 7. 실시간 통신
- WebSocket: ws (Node.js 네이티브, Socket.io보다 가벼움)
- 용도: 에이전트 상태 업데이트, 터미널 릴레이, 알림, 채팅
- 재연결: 자동 재연결 (exponential backoff)
- 프로토콜: JSON 메시지 (type + payload 구조)

## 8. 3D 워크스페이스 렌더링 (데스크톱 전용)

### 엔진 선택: Three.js + React Three Fiber

| 후보 | 장점 | 단점 | 판정 |
|---|---|---|---|
| **Three.js + R3F** | WebGL 3D 렌더링, React 생태계 통합, 성숙한 커뮤니티, 로우폴리 카툰 스타일 적합 | 학습 곡선 존재 | **채택** |
| PixiJS | 2D 렌더링 최적화, 가벼움 | 3D 카툰 스타일 표현 불가 | 미채택 |
| Phaser | 게임 엔진 풀세트 | 오버스펙, 3D 미지원 | 미채택 |
| 순수 Canvas | 의존성 없음 | 3D 렌더링 불가 | 미채택 |

### Three.js + R3F 사용 방식
- `@react-three/fiber` — React 컴포넌트로 Three.js 통합
- `@react-three/drei` — 헬퍼 (OrbitControls, Environment, 등)
- 3D 모델: `.glb/.gltf` 형식 (로우폴리 카툰 스타일)
- 카메라: 고정 아이소메트릭 앵글 (OrthographicCamera)
- 상호작용: Raycasting으로 캐릭터 클릭 → React 팝업 모달 트리거

### 성능 최적화 전략
- **로우폴리 모델**: 캐릭터당 1~2k 폴리곤
- **GPU 인스턴싱**: 동일 모델 에이전트는 InstancedMesh로 일괄 렌더링
- **LOD (Level of Detail)**: 카메라 거리에 따라 디테일 단계 자동 조절
- **Draco 압축**: 3D 모델 용량 80% 절감
- **동적 로딩**: React.lazy + Suspense로 3D 씬 코드 분할
- **모바일 분기**: 모바일에서는 3D 로딩하지 않음 (번들 자체를 분리)

### 3D 에셋
- 모델 형식: `.glb` (바이너리 glTF, Draco 압축)
- 에셋 관리: `/public/assets/models/` 디렉토리
- 캐릭터 리깅: 상태별 애니메이션 (타이핑, 대기, 당황, 기쁨 등)
- 환경: 워크스페이스 가구, 바닥, 벽 등 모듈형 에셋

### 3D 에셋 제작 파이프라인
- **AI 3D 생성**: Meshy, Tripo3D, Luma Genie로 텍스트→3D 모델 초안 생성
- **Blender 후보정**: AI 생성 모델 최적화, 리깅, 애니메이션 추가
- **무료 에셋 활용**: Sketchfab, Kenney 로우폴리 카툰 에셋 커스터마이징
- **컨셉 아트**: Midjourney / DALL-E로 3D 워크스페이스 분위기, 캐릭터 컨셉 이미지 생성
- **UI 레이아웃**: v0.dev (Vercel)로 React UI 코드 프로토타입 생성
- **와이어프레임 피드백**: Claude (비전)로 스케치 → 피드백 → 개선 반복
- designer 에이전트가 설계 단계에서 위 도구들을 활용하여 진행

### 레퍼런스 비주얼
- **Versa Metaverse Landing Page** (Dribbble) — 3D 카툰 캐릭터 + 몽환적 파스텔 환경
- 로우폴리 + 소프트 라이팅 + 보케 효과의 따뜻한 메타버스 분위기

## 9. 터미널 렌더링
- xterm.js + @xterm/addon-fit (터미널 크기 자동 조정)
- node-pty (서버 측 PTY 할당)
- WebSocket으로 stdin/stdout 양방향 릴레이
- 팝업 모달 내 탭에서 렌더링

## 10. 채팅 UI
- 직접 구현 (React 컴포넌트)
  - 외부 라이브러리 불필요한 수준의 심플한 채팅 구조
  - 메시지 목록 + 입력창 + 타이핑 인디케이터
- 메시지 저장: SQLite (채팅 이력 DB 저장)
- 실시간: WebSocket으로 Main ↔ 웹앱 메시지 전달
- 마크다운 지원: 보고 내용에 코드블록, 테이블 등 포함 가능

## 11. 마크다운 렌더링 (리포트/노트 뷰)
- react-markdown + remark-gfm (GFM 테이블, 체크박스 지원)
- rehype-highlight (코드 구문 강조)
- `.orchestrator/` 노트를 파싱하여 리포트 뷰에 렌더링

## 12. 파일 감시
- chokidar: `.orchestrator/` 폴더 변경 감지
- 변경 감지 → DB 동기화 + WebSocket으로 클라이언트에 푸시

## 13. 태스크 관리
- 별도 작업 큐(BullMQ/Redis) 사용하지 않음
- 노트 기반 상태 관리 + Hooks + PM2로 대체:
  - 태스크 순서: 오케스트레이터가 `.orchestrator/` 노트를 읽고 판단
  - 재시도: Hooks 이벤트 + 노트 상태 기반으로 관리
  - 프로세스 복구: PM2 자동 재시작 + 노트 기반 컨텍스트 복구
- 에이전트 규모가 커지면 Phase 2에서 작업 큐 도입 검토

## 14. AI Gateway
- LiteLLM: 프록시 모드로 실행 (localhost:4000)
- 모든 모델 호출은 LiteLLM 경유 (직접 API 호출 금지)
- 토큰/비용 수집: LiteLLM 콜백으로 자동 기록

## 15. 세션 관리
- tmux: 에이전트별 세션 분리
- tmux 명령: Node.js child_process로 실행
- 세션 목록/상태: `tmux list-sessions` 파싱

## 16. 알림
- 브라우저 푸시: Web Push API (service worker)
- 모바일: 동일한 Web Push (PWA 지원)
- 대시보드 내 알림: WebSocket 실시간 전달

## 17. 재시도 정책 기본값
- 기본 재시도 횟수: 3회
- 재시도 간격: 지수 백오프 (10초, 30초, 90초)
- Part별 오버라이드 가능 (설정 UI에서 변경)
- 모든 재시도 실패 시: 에이전트 정지 + 대표 알림

## 18. 백업
- SQLite: 일 1회 자동 백업 (`.backup` 명령 또는 파일 복사)
- `.orchestrator/`: git 기반 자동 커밋 (일 1회) 또는 rsync
- 백업 경로: `$CLAUDEMANAGER_HOME/backups/`
- 보관 기간: 최근 30일

## 19. 배포
- Phase A: `npm run dev` 또는 `npm run build && npm start` (로컬)
- Phase B: PM2로 프로세스 관리 + Caddy 리버스 프록시 + Cloudflare Tunnel (외부 접근)
- Vercel 사용하지 않음 — 백엔드/DB/tmux 모두 로컬 필수이므로 로컬 배포 전용

## 20. 개발 환경
- Node.js: 20 LTS
- 패키지 매니저: pnpm
- 린터: ESLint + Prettier
- 테스트: Vitest (유닛) + Playwright (E2E)
- 모노레포: 단일 레포 (apps/ 분리 불필요, 규모가 작으므로)
