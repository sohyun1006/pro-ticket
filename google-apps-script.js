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

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAME);

    if (!sheet) {
      return jsonResponse({ success: false, error: `시트를 찾을 수 없습니다: ${SHEET_NAME}` });
    }

    // 헤더가 없으면 첫 행에 추가
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(['티켓ID', '접수일', '본명', '선수활동명', '공식활동명', '라이엇ID', '라인', '소속 팀', '서버', '리그', '출처', '상태']);
    }

    // 데이터 행 추가
    sheet.appendRow([
      data.ticketId   || '',
      data.verifiedAt || '',
      data.realName   || '',
      data.playerName || '',
      data.officialName || '',
      data.riotId     || '',
      data.line       || '',
      data.team       || '',
      data.server     || '',
      data.league     || '',
      data.sources    || '',
      data.status     || '승인',
    ]);

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
