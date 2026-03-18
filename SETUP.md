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

## 3. Google Sheets 연동 (Google Apps Script)

n8n 없이 Google Apps Script를 이용해 무료로 웹훅을 만들 수 있습니다.

### Step 1 - Google Sheets 준비

1. 등록 데이터를 저장할 Google Sheets 파일 열기
2. 시트 탭 이름 확인 (기본값: `시트1`)

### Step 2 - Apps Script 배포

1. Google Sheets 상단 메뉴: **확장 프로그램 > Apps Script**
2. 편집기에 `google-apps-script.js` 파일 내용 전체 붙여넣기
3. 코드 상단의 `SHEET_NAME`을 실제 시트 탭 이름으로 수정
4. 상단 **저장** (💾) 클릭
5. **배포 > 새 배포** 클릭
6. 설정:
   - 유형: **웹 앱**
   - 설명: `Pro Tag Validator 웹훅`
   - 실행 계정: **나**
   - 액세스 권한: **모든 사용자**
7. **배포** 클릭 → 권한 허용
8. 표시되는 **웹 앱 URL** 복사

### Step 3 - Zendesk 앱에 URL 입력

- `zcli apps:server` 실행 시 또는 앱 설치 시
- `webhookUrl` 항목에 복사한 Apps Script URL 붙여넣기

---

## 4. Google Sheets 컬럼 구성

Apps Script가 자동으로 헤더를 추가합니다. 수동으로 만들 경우:

| 티켓ID | 접수일 | 본명 | 선수활동명 | 공식활동명 | 라이엇ID | 라인 | 소속 팀 | 서버 | 리그 | 출처 | 상태 |
|--------|--------|------|-----------|-----------|---------|------|--------|------|------|------|------|
| 12345  | 2024-01-15T... | 홍길동 | Faker | Faker | Faker#KR1 | 미드 | T1 | KR | LCK | https://... | 승인 |

---

## 5. 테스트 방법

Apps Script 배포 후 터미널에서 아래 명령으로 동작 확인:

```bash
curl -X POST "YOUR_APPS_SCRIPT_URL" \
  -H "Content-Type: application/json" \
  -d '{"ticketId":"test-001","realName":"홍길동","playerName":"Faker","officialName":"Faker","riotId":"Faker#KR1","line":"미드","team":"T1","server":"KR","league":"LCK","verifiedAt":"2024-01-15T00:00:00Z","sources":"https://leaguepedia.com","status":"승인"}'
```

정상 응답: `{"success":true}`
