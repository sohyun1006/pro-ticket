/**
 * Pro Tag Validator - Google Apps Script 웹훅
 *
 * [배포 방법]
 * 1. Google Sheets에서 확장 프로그램 > Apps Script 열기
 * 2. 이 코드 전체를 붙여넣기
 * 3. SHEET_NAME을 실제 시트 탭 이름으로 수정
 * 4. 배포 > 새 배포 > 웹 앱 선택
 * 5. 실행 계정: 내 계정 / 액세스 권한: 모든 사용자
 * 6. 배포 후 나오는 URL을 Zendesk 앱 설정의 webhookUrl에 입력
 */

const SHEET_NAME = '시트1'; // ← 실제 시트 탭 이름으로 변경
const SLACK_WEBHOOK_URL = 'YOUR_SLACK_WEBHOOK_URL'; // ← Slack Incoming Webhook URL
const SLACK_MANAGER_ID = 'YOUR_SLACK_MEMBER_ID';   // ← 담당자 슬랙 멤버 ID (U로 시작)
const SHEET_URL = 'YOUR_GOOGLE_SHEET_URL';          // ← 구글 시트 URL

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);

    const ss = SpreadsheetApp.openById('YOUR_SPREADSHEET_ID'); // ← 구글 시트 ID
    const sheet = ss.getSheetByName(SHEET_NAME);

    if (!sheet) {
      return jsonResponse({ success: false, error: `시트를 찾을 수 없습니다: ${SHEET_NAME}` });
    }

    // 티켓ID(A열) 기준으로 첫 번째 빈 행 찾기 (체크박스가 있어도 무시)
    const ticketIdValues = sheet.getRange('A:A').getValues();
    let newRow = 2;
    for (let i = 1; i < ticketIdValues.length; i++) {
      if (ticketIdValues[i][0] === '') {
        newRow = i + 1;
        break;
      }
    }

    // 데이터 행 추가
    // 컬럼 순서: 티켓ID, 요청 유형, 공식활동명, 서버, 라이엇ID, 리그, 소속 팀, 본명, 라인, 접수일, 검증, 작업 상태, 비고, 출처
    sheet.getRange(newRow, 1, 1, 14).setValues([[
      data.ticketId     || '',  // A: 티켓ID
      data.requestType  || '',  // B: 요청 유형
      data.officialName || '',  // C: 공식활동명
      data.server       || '',  // D: 서버
      data.riotId       || '',  // E: 라이엇ID
      data.league       || '',  // F: 리그
      data.team         || '',  // G: 소속 팀
      data.realName     || '',  // H: 본명
      data.line         || '',  // I: 라인
      data.verifiedAt   || '',  // J: 접수일
      '승인',                   // K: 검증
      false,                    // L: 작업 상태 (체크박스)
      '',                       // M: 비고 (수동)
      data.sources      || '',  // N: 출처
    ]]);

    // 작업 상태(L열=12)에 체크박스 삽입
    sheet.getRange(newRow, 12).insertCheckboxes();

    return jsonResponse({ success: true });

  } catch (err) {
    return jsonResponse({ success: false, error: err.message });
  }
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ─── 슬랙 일일 알림 ──────────────────────────────────────────────────────────

function checkAndNotify() {
  // 주말(토, 일) 제외
  const now = new Date();
  const day = now.getDay(); // 0=일, 6=토
  if (day === 0 || day === 6) return;

  const ss = SpreadsheetApp.openById('YOUR_SPREADSHEET_ID'); // ← 구글 시트 ID
  const sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet || sheet.getLastRow() <= 1) return;

  // 오늘 날짜 (한국 시간 기준)
  const today = Utilities.formatDate(now, 'Asia/Seoul', 'yyyy-MM-dd');

  const allRows = sheet.getDataRange().getValues();
  const rows = allRows.slice(1); // 헤더 제외

  // 오늘 접수된 행만 필터링
  const todayRows = rows.filter(row => {
    if (!row[1]) return false;
    const rowDate = Utilities.formatDate(new Date(row[1]), 'Asia/Seoul', 'yyyy-MM-dd');
    return rowDate === today;
  });

  if (todayRows.length === 0) return;

  // 슬랙 메시지 구성 (Block Kit)
  const payload = {
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `<@${SLACK_MANAGER_ID}> 프로 태그 업데이트 요청이 *${todayRows.length}건* 있습니다.`,
        },
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: { type: 'plain_text', text: '시트에서 확인하기' },
            url: SHEET_URL,
            style: 'primary',
          },
        ],
      },
    ],
  };

  UrlFetchApp.fetch(SLACK_WEBHOOK_URL, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
  });
}

// ─── 트리거 설정 (최초 1회만 실행) ──────────────────────────────────────────

function createDailyTrigger() {
  // 기존 트리거 삭제 (중복 방지)
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === 'checkAndNotify') {
      ScriptApp.deleteTrigger(t);
    }
  });

  // 평일 오후 5~6시 사이에 실행
  ScriptApp.newTrigger('checkAndNotify')
    .timeBased()
    .everyDays(1)
    .atHour(17)
    .nearMinute(0)
    .inTimezone('Asia/Seoul')
    .create();
}
