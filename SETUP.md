# Pro Tag Validator 설치 가이드

## 1. Zendesk CLI 설치 & 로컬 테스트

```bash
npm install -g @zendesk/zcli

# 앱 폴더로 이동
cd 프로티켓

# 로컬 실행 (브라우저에서 티켓 열어서 확인)
zcli apps:server

# Zendesk에 업로드
zcli apps:create
```

---

## 2. 유저 티켓 템플릿 (Zendesk Ticket Form)

유저가 티켓 작성 시 아래 형식으로 작성하도록 안내:

```
라인: 미드
본명: 홍길동
선수활동명: Faker
라이엇ID: Faker#KR1
소속 팀: T1
서버: KR
리그: LCK
```

> Zendesk의 티켓 기본 설명란에 이 형식을 기본값으로 넣어두면 편합니다.

---

## 3. n8n 워크플로우 설정 (Google Sheets 업로드)

### 워크플로우 구성

```
[Webhook 트리거]
    ↓
[Google Sheets - Append Row]
```

### 단계별 설정

**Step 1 - Webhook 노드**
- Method: POST
- Path: /pro-tag-register
- 생성 후 웹훅 URL 복사 (앱 설치 시 입력)

**Step 2 - Google Sheets 노드**
- Operation: Append or Update Row
- Spreadsheet: 등록할 시트 선택
- Sheet: 시트 탭 선택
- Column 매핑:

| 시트 컬럼 | n8n 필드 |
|----------|---------|
| 티켓ID | `{{ $json.ticketId }}` |
| 접수일 | `{{ $json.verifiedAt }}` |
| 본명 | `{{ $json.realName }}` |
| 선수활동명 | `{{ $json.playerName }}` |
| 라이엇ID | `{{ $json.riotId }}` |
| 라인 | `{{ $json.line }}` |
| 소속 팀 | `{{ $json.team }}` |
| 서버 | `{{ $json.server }}` |
| 리그 | `{{ $json.league }}` |
| 상태 | `{{ $json.status }}` |

---

## 4. 앱 설정값 입력

Zendesk에서 앱 설치 시:
- `n8nSheetWebhookUrl`: n8n에서 복사한 웹훅 URL

---

## 5. Google Sheets 컬럼 구성 예시

| 티켓ID | 접수일 | 본명 | 선수활동명 | 라이엇ID | 라인 | 소속 팀 | 서버 | 리그 | 상태 |
|--------|--------|------|-----------|---------|------|--------|------|------|------|
| 12345  | 2024-01-15 | 홍길동 | Faker | Faker#KR1 | 미드 | T1 | KR | LCK | 승인 |
