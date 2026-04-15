# 디자인 프롬프트 모음
> v0.dev UI 프로토타입 + Midjourney/DALL-E 컨셉아트 프롬프트
> 각 프롬프트를 복사하여 해당 도구에 붙여넣기

---

## A. v0.dev UI 프로토타입 프롬프트

> https://v0.dev 에서 사용. 각 프롬프트를 복사하여 입력하면 React + Tailwind 코드와 미리보기가 생성됨.

---

### A-1. 로그인 화면

```
Create a login page for "ClaudeManager" - an AI organization management web app.

Design specs:
- Background: warm cream/beige gradient (#FDFBF7 to #F5EDE3) with subtle bokeh blur effect
- Center: white card (border-radius 16px, soft shadow) with:
  - Logo area: "ClaudeManager" title (Pretendard/Inter font, 24px bold, color #1A1523)
  - Subtitle: "나와 AI 동료들이 함께하는 워크스페이스" (14px, color #6B6478)
  - Password input field (border-radius 8px, border #E2E8F0, focus border #7C5CFC)
  - Login button: lavender-purple gradient (#7C5CFC to #6344E0), white text, border-radius 8px, full width
- Error state: red text below input "#DC2626"
- Overall mood: warm, pastel, dreamy metaverse aesthetic (like Versa Metaverse landing page)
- Font: clean sans-serif (Inter or similar)
- No dark mode. Light warm cream theme only.
```

---

### A-2. 채팅 팝업 (데스크톱 — Main 접촉 시 열림)

```
Create a chat interface for "ClaudeManager" - an AI secretary chat.

Layout (desktop, 1440px):
- Top bar: avatar circle (lavender #7C5CFC bg, white icon) + "비서실장" name + green online dot + connection status
- Chat area (background #FAF8F5):
  - Left-aligned messages (AI secretary): small avatar (32px circle) + message bubble (white bg #FFFFFF, border-radius 20px, soft shadow, max-width 70%)
  - Right-aligned messages (CEO): bubble (lavender bg #EDE5FF, border-radius 20px, max-width 70%)
  - Messages support markdown: show a message with a table and bullet list rendered inside
  - Typing indicator: three animated dots in a small bubble
  - Inline approval card: white card inside chat with title, summary text, and 3 buttons [승인 (green #4ADE80)] [수정 지시 (amber #F5A623)] [반려 (red #F06060)]
  - Progress bar message: inline progress showing "개발 진행률 60%" with blue bar (#5B9BF7)
- Bottom: message input (border-radius 20px, border #E2E8F0, placeholder "메시지를 입력하세요...") + send button (circle, #7C5CFC)
- Top navigation bar: 4 tabs [워크스페이스] [대시보드] [설정] [리소스 관리] with Lucide icons. Chat is NOT a separate tab — it opens as a popup when touching the Main character in workspace.
- Note: This is the desktop chat view opened via Main character contact in workspace

Color palette: primary #7C5CFC, secondary #3EC9A0, bg #FDFBF7, surface #FFFFFF, chat-bg #FAF8F5
Font: Inter/Pretendard, body 14px, headings bold
Style: warm pastel, rounded corners everywhere (min 8px), soft shadows, no hard edges
```

---

### A-3. 채팅 화면 (모바일)

```
Create a mobile chat interface (390px width) for "ClaudeManager".

Layout:
- Top: "비서실장" with avatar + green dot, minimal
- Yellow banner at top: "승인 대기 1건" with amber background (#FFF8EB, text #D48806)
- Chat messages same as desktop but full-width bubbles
- AI messages (left): white bubble, small avatar
- User messages (right): lavender bubble (#EDE5FF)
- Inline approval buttons: [승인] [반려] stacked or side by side
- Bottom: input field (rounded 20px) + send button
- Mobile bottom nav: 3 tabs [채팅*] [알림] [상태] with icons

Same warm pastel style. Background #FAF8F5. Primary #7C5CFC.
No 3D, no office view. Clean mobile-first chat UI.
```

---

### A-4. 리포트 뷰 (프로젝트 진행 보고서)

```
Create a project report dashboard for "ClaudeManager".

Layout (desktop):
- Top: Part tabs [전체] [프로젝트관리부 (active, purple underline)] [재무관리부]
- Left sidebar (240px, bg #F8F5F0):
  - Report type list: > 진행 보고 (active, purple left border) > 의사결정 > 비용 > 활동 요약 > 오류
  - Date filter dropdown at bottom
- Right content area (bg #FDFBF7):
  - Title: "할일관리앱" h2
  - Overall progress: "전체 43%" with progress bar (#7C5CFC fill, #E2E8F0 track, border-radius full)
  - Stage timeline (vertical):
    - 기획: green bar (#4ADE80) "완료"
    - 디자인: green bar "완료"
    - 개발: blue bar 60% (#5B9BF7) "진행 중"
    - 테스트: gray bar (#E2E8F0) "미시작"
    - 리뷰: gray bar "미시작"
    - 배포: gray bar "미시작"
  - Recent activity cards (white card, rounded 12px, soft shadow):
    - "4/16 개발 60% 도달" with blue dot
    - "4/15 디자인 완료" with green dot
- Top nav: [워크스페이스] [대시보드 (active, purple underline)] [설정] [리소스 관리]

Color: primary #7C5CFC, complete #4ADE80, active #5B9BF7, idle #E2E8F0
Background: #FDFBF7, sidebar #F8F5F0, cards #FFFFFF
Style: warm, clean, pastel. Rounded corners. Soft shadows. Pretendard/Inter font.
```

---

### A-5. 데이터 뷰 (비용 대시보드)

```
Create a cost dashboard for "ClaudeManager" AI management tool.

Layout (desktop):
- Top tabs: [비용 (active, purple)] [승인 이력] [오류 로그] [감사 로그]
- Content:
  - Monthly cost summary bar: "$78 / $100" with progress bar (78% filled)
    - Bar color: green (#4ADE80) for 0-60%, amber (#F5A623) for 60-90%, red (#F06060) for 90%+
    - Currently amber at 78%
  - Two cards side by side:
    - Left card: "모델별 비율" donut chart (opus 45% purple, sonnet 35% blue, haiku 20% mint)
    - Right card: "일별 비용 추이" line chart (7 days, purple line)
  - Bottom section: "API 키별 사용량" table
    - Columns: 제공사 | 상태 | 사용량
    - Anthropic | 활성 (green badge) | $65.00
    - OpenAI | 활성 (green badge) | $13.00
- Top nav: [워크스페이스] [대시보드] [설정] [리소스 관리 (active, purple underline)]

Colors: primary #7C5CFC, secondary #3EC9A0, bg #FDFBF7, cards white
Charts: use soft pastel colors matching the palette
Style: warm, professional, rounded (12px cards), soft shadows
```

---

### A-6. 팝업 모달 (에이전트 상세 - 4탭)

```
Create a large popup modal (80% of screen) for agent detail view in "ClaudeManager".

Modal specs:
- Overlay: semi-transparent dark (#00000066)
- Modal: white bg, border-radius 16px, slide-up animation
- Header:
  - Left: circle avatar (lavender bg) + "할일관리앱 팀장" name (h2 bold)
  - Below name: "Sub 오케스트레이터 | 개발 감독 중" (caption, #6B6478) + green status badge
  - "가동: 2h 15m" small text
  - Right: X close button
- Tab bar: [대화 (active)] [노트] [로그] [터미널] with purple underline on active

Tab 1 (대화 - shown):
- Timeline of messages:
  - "[14:00] Part → Sub:" with message "할일관리앱 프로젝트 시작. 기획부터"
  - "[14:05] Sub → 기획 인스턴스:" with message "요구사항 분석 후 PRD 작성하라"
  - "[15:30] 기획 인스턴스 → Sub:" with message "PRD 초안 완료. 기능 14개 도출"
  - Each entry has sender avatar, arrow icon, timestamp
  - Direction indicators with different colors (blue for down, green for up)

Tab 3 indicator (로그): show a red dot badge "3" for errors

Colors: bg #FDFBF7 (modal content), primary #7C5CFC, text #1A1523
Style: warm, clean, generous whitespace, rounded everything
```

---

### A-7. 전역 설정

```
Create a full-screen settings modal for "ClaudeManager".

Layout:
- Full screen modal (slide-up), white bg, border-radius 16px top corners
- Header: "설정" title + X close button
- Left sidebar menu (200px, bg #F8F5F0):
  - > 전역 설정 (active, purple left border + purple text)
  - > Part별 정책
  - > API 키 관리
  - > 백업/복원
- Right content:
  - Form fields with labels:
    - "재시도 횟수" - number input, value "3"
    - "재시도 간격" - select dropdown "지수 백오프"
    - "비용 한도 ($)" - number input, value "100"
    - "알림 임계값 (%)" - number input, value "80"
    - "동시 에이전트 상한" - number input, value "10" (range 1-50)
  - Input style: border-radius 8px, border #E2E8F0, focus border #7C5CFC, bg white
  - Purple "저장" button at bottom (full width within content area)

Colors: primary #7C5CFC, bg #FDFBF7, surface white, border #E2E8F0
Style: clean, warm, generous spacing (16px between fields), rounded corners
```

---

### A-8. 모바일 상태 카드

```
Create a mobile status card view (390px width) for "ClaudeManager".

Layout:
- Top: "상태" title (h1, bold)
- Scrollable card list:
  - Card 1: white card, rounded 12px, soft shadow, padding 16px
    - Top row: "프로젝트관리부" bold + green status badge "정상"
    - Icon (small circle, purple bg) + "할일관리앱" project name
    - "개발 80%" with progress bar (blue #5B9BF7, 80% filled)
    - "에이전트 3개 활동" caption text (#6B6478)
  - Card 2: similar card
    - "재무관리부" + green badge
    - "월간 분석" + "완료" green text
    - "에이전트 0개 대기" gray text
- Bottom: link text "데스크톱에서 자세히 보기 →" (#7C5CFC)
- Mobile nav: [채팅] [알림] [상태*] with purple active indicator

Background: #FDFBF7, cards: white, primary: #7C5CFC
Style: warm pastel, rounded, clean mobile cards
```

---

## B. Midjourney / DALL-E 컨셉아트 프롬프트

> Midjourney: /imagine 뒤에 붙여넣기
> DALL-E: 직접 붙여넣기

---

### B-1. 3D 워크스페이스 전체 뷰 (메인 컨셉)

```
Isometric 3D cartoon virtual office, low-poly style, warm pastel color palette (lavender, mint, cream, coral), soft lighting with bokeh effect, depth of field.

The office has a CEO room at the top center with a small cute 2-head-tall cartoon character sitting at a desk. Below are department zones: "Project Management" area with team desks where tiny cute characters are typing on laptops, and an empty zone marked with dotted lines for future departments.

Each character has a small speech bubble above their head. The floor is warm cream/beige tone. Gentle ambient light from above. Dreamy, cozy metaverse atmosphere like Versa Metaverse style. No text, clean background. Professional but cute.

--ar 16:9 --v 6 --style raw
```

---

### B-2. 3D 워크스페이스 - 부서 건축 애니메이션 장면

```
Isometric 3D cartoon scene of a small virtual office being built. Low-poly cute style. Two tiny 2-head-tall construction worker characters with hard hats hammering, surrounded by sparkle particles and dust clouds. A half-built office space with pastel colored walls emerging. Warm cream floor, soft bokeh lighting, dreamy atmosphere. Lavender and mint accent colors. Cozy metaverse construction scene.

--ar 16:9 --v 6 --style raw
```

---

### B-3. 캐릭터 컨셉 시트 - Main(비서실장)

```
Character concept sheet, 3D low-poly cartoon style, cute 2-head-tall chibi proportioned office secretary character.

Wearing a neat navy suit with glasses, holding a clipboard. Round soft face with simple dot eyes and small smile. Multiple poses in one image: standing (default), typing on keyboard, drinking coffee, bowing politely, showing surprised expression with exclamation mark above head, happy jumping with sparkle effects.

Warm pastel background, clean white backdrop. Soft lighting. Professional but adorable. Versa Metaverse art style reference.

--ar 3:2 --v 6 --style raw
```

---

### B-4. 캐릭터 컨셉 시트 - Part(부서장), Sub(팀장), 인스턴스

```
Character lineup concept sheet, 3D low-poly cartoon style, four cute 2-head-tall chibi characters standing side by side.

From left to right:
1. Department head: purple uniform, confident pose, name badge
2. Team leader: purple-tinted casual outfit with team badge, holding notebook
3. Instance worker 1: casual freelancer look with laptop, headphones
4. Instance worker 2: different casual outfit, typing pose

All characters share the same round soft face style with simple features. Warm pastel color palette (lavender, mint, cream). Clean white background. Professional but adorable office workers.

--ar 3:1 --v 6 --style raw
```

---

### B-5. 3D 워크스페이스 - 야간 모드 (Phase 2 참고)

```
Isometric 3D cartoon virtual office at night. Low-poly style. Dark blue ambient with warm desk lamp lighting. Cute 2-head-tall characters working late, some sleeping on desk with zzz bubbles. Window showing moonlit sky with stars. Cozy night office atmosphere. Warm yellow light pools from desk lamps contrasting with cool blue shadows. Dreamy, peaceful mood. Pastel night colors.

--ar 16:9 --v 6 --style raw
```

---

### B-6. 3D 워크스페이스 - 승인 대기 장면

```
Isometric 3D cartoon virtual office scene. A cute 2-head-tall secretary character in navy suit standing at the CEO room door, knocking politely. Above the character's head is a yellow speech bubble with "결재 요청" text. Another small character in the background doing a happy jump with sparkle effects. Warm pastel colors (lavender, cream, mint). Soft lighting with bokeh. Cozy office atmosphere.

--ar 16:9 --v 6 --style raw
```

---

### B-7. 3D 워크스페이스 - 서버 복구 장면

```
Isometric 3D cartoon virtual office emerging from darkness. Left side is dark and dim, right side has warm lights turning on one by one. Cute 2-head-tall characters stretching and waking up at their desks, one holding a coffee cup. Small "복구됨" speech bubbles appearing. Transition from cool dark blue to warm cream/pastel lighting. Cozy recovery scene. Low-poly style with bokeh effects.

--ar 16:9 --v 6 --style raw
```

---

## C. 사용 가이드

### v0.dev 사용법
1. https://v0.dev 접속 (무료 계정으로 일일 제한 있음)
2. 프롬프트 복사 → 입력창에 붙여넣기
3. 생성된 UI 확인 → 마음에 들면 코드 복사
4. 수정이 필요하면 "make the button bigger" 등 자연어로 수정 요청

### Midjourney 사용법
1. Discord에서 Midjourney Bot 사용
2. `/imagine` 입력 후 프롬프트 붙여넣기
3. 4개 변형 중 선택 → U1~U4로 업스케일
4. `--v 6`은 최신 모델, `--ar 16:9`은 가로비율

### DALL-E 사용법
1. ChatGPT (Plus)에서 이미지 생성 요청
2. 프롬프트 붙여넣기
3. 생성된 이미지 다운로드

### 생성된 이미지 저장 위치
- 컨셉아트: `03_design/assets/concept/`
- UI 스크린샷: `03_design/assets/ui-prototype/`
