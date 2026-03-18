/* global ZAFClient */

// 커스텀 필드 라벨 매핑
const FIELD_MAP = {
  line:       ['라인', 'Line', 'Position', '포지션'],
  realName:   ['본명', '실명', 'Real Name'],
  playerName: ['선수 활동명', '선수활동명', '선수명', 'Player Name'],
  riotId:     ['라이엇 ID', '라이엇ID', 'Riot ID'],
  team:       ['소속 팀', '소속팀', 'Team'],
  server:     ['서버', 'Server'],
  league:     ['리그', 'League'],
  requestMethod: ['요청 방식', '신청 유형', 'Request Type'],
};

const client = ZAFClient.init();
let parsedPlayer = null;
let verifiedData = null;

client.on('app.registered', async () => {
  client.invoke('resize', { width: '100%', height: '700px' });
  await loadTicketData();
});

// ─── 티켓 데이터 읽기 ────────────────────────────────────────────────────────

async function loadTicketData() {
  try {
    const ticketData = await client.get(['ticket.id', 'ticket.subject']);
    const ticketId = ticketData['ticket.id'];

    const [ticketResponse, fieldsResponse] = await Promise.all([
      client.request(`/api/v2/tickets/${ticketId}.json`),
      client.request('/api/v2/ticket_fields.json'),
    ]);

    const customFields = ticketResponse.ticket?.custom_fields || [];
    const fieldDefs = fieldsResponse.ticket_fields || [];

    const idToTitle = {};
    for (const f of fieldDefs) {
      idToTitle[f.id] = f.title;
    }

    parsedPlayer = { ticketId, ticketSubject: ticketData['ticket.subject'] };

    for (const field of customFields) {
      const title = idToTitle[field.id] || '';
      for (const [key, aliases] of Object.entries(FIELD_MAP)) {
        if (aliases.some(alias => title.includes(alias))) {
          parsedPlayer[key] = field.value;
          break;
        }
      }
    }

    if (!parsedPlayer.team || !parsedPlayer.playerName) {
      const debugFields = customFields
        .map(f => `${idToTitle[f.id] || '(ID:' + f.id + ')'}: ${f.value}`)
        .join('<br/>');
      document.getElementById('parse-error').innerHTML = `
        <b>필드를 찾지 못했습니다.</b> 읽힌 필드 목록:<br/><br/>
        ${debugFields || '(커스텀 필드 없음)'}
      `;
      show('parse-error');
      return;
    }

    renderPlayerInfo(parsedPlayer);
    show('verify-section');

  } catch (err) {
    console.error('티켓 로드 실패:', err);
    show('parse-error');
  }
}

function renderPlayerInfo(p) {
  const box = document.getElementById('player-info');
  box.innerHTML = `
    <table class="info-table">
      <tr><td>라인</td><td>${p.line || '-'}</td></tr>
      <tr><td>본명</td><td>${p.realName || '-'}</td></tr>
      <tr><td>선수활동명</td><td><strong>${p.playerName || '-'}</strong></td></tr>
      <tr><td>라이엇 ID</td><td>${p.riotId || '-'}</td></tr>
      <tr><td>소속 팀</td><td><strong>${p.team || '-'}</strong></td></tr>
      <tr><td>서버</td><td>${p.server || '-'}</td></tr>
      <tr><td>리그</td><td>${p.league || '-'}</td></tr>
    </table>
  `;
  show('player-info');
}

// ─── 검증 버튼 (OpenAI 교차검증) ────────────────────────────────────────────

document.getElementById('btn-verify').addEventListener('click', async () => {
  hide('verify-section');
  hide('result-section');
  showLoading('AI 교차검증 중... (나무위키, Leaguepedia, DeepLoL 확인 중)');

  try {
    const meta = await client.metadata();
    const apiKey = meta.settings?.openAiApiKey;
    if (!apiKey) {
      hideLoading();
      showResult('fail', '⚠️ API 키가 설정되지 않았습니다.<br/>zcli 실행 시 openAiApiKey를 입력해주세요.');
      show('result-section');
      return;
    }

    const verificationPrompt = buildVerificationPrompt(parsedPlayer);

    const response = await client.request({
      url: 'https://openrouter.ai/api/v1/chat/completions',
      type: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://zendesk.com',
        'X-Title': 'Pro Tag Validator',
      },
      data: JSON.stringify({
        model: 'perplexity/sonar-pro',
        temperature: 0,
        messages: [
          {
            role: 'system',
            content: '당신은 리그 오브 레전드 프로선수 정보를 검증하는 전문가입니다. 반드시 JSON만 반환하세요. 마크다운, 코드블록, 설명 문구 없이 순수 JSON만 출력하세요.',
          },
          {
            role: 'user',
            content: verificationPrompt,
          },
        ],
      }),
    });

    hideLoading();

    const content = response.choices?.[0]?.message?.content || '';
    // 혹시 ```json ... ``` 블록으로 감싸진 경우 제거
    const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const result = JSON.parse(cleaned);
    renderVerifyResult(result);

  } catch (err) {
    hideLoading();
    console.error('검증 오류 전체:', err);
    // ZAF request 오류는 err.message가 없고 status/responseText 형태
    const status = err?.status || '';
    const responseText = err?.responseText || '';
    let errMsg = '';
    try {
      const parsed = JSON.parse(responseText);
      errMsg = parsed?.error?.message || responseText;
    } catch {
      errMsg = responseText || err?.message || JSON.stringify(err) || '알 수 없는 오류';
    }
    showResult('fail', `오류 발생 (${status})<br/>${errMsg}`);
    show('result-section');
  }
});

function buildVerificationPrompt(p) {
  return `아래 정보를 가진 사람이 리그 오브 레전드 프로게이머인지 웹 검색으로 교차 검증해주세요.

[검증 대상 정보]
- 선수활동명(IGN): ${p.playerName}
- Riot ID: ${p.riotId}
- 소속 팀: ${p.team}
- 리그: ${p.league}
- 서버: ${p.server}
- 라인: ${p.line}
- 본명: ${p.realName}

[검증 방법]
다음 순서로 웹 검색을 수행하세요:
1. "${p.playerName} ${p.team} Leaguepedia" 검색 → 팀 로스터에 해당 선수가 있는지 확인
2. "${p.playerName} 나무위키" 검색 → 선수 문서 존재 여부 확인
3. "${p.team} ${p.league} roster" 검색 → 팀과 리그 정보 일치 여부 확인

[판단 기준]
- isLie: false → Leaguepedia 또는 나무위키에서 해당 팀 소속 선수로 확인됨
- isLie: true → 어떤 공식 출처에서도 확인 불가, 또는 팀/리그 정보가 불일치

※ 정보가 불확실할 경우, 확인된 근거 위주로 판단하고 isLie: false로 처리하되 description에 불확실 사항 명시

[출력 형식 - 반드시 JSON만 출력, 다른 텍스트 금지]
{
  "requestMethod": "신규 등록",
  "isLie": false,
  "official_name": "${p.playerName}",
  "verification_logic": "검증에 사용한 검색어와 확인된 내용 요약",
  "description": "최종 판단 이유 (한국어로)",
  "sources": ["확인한 URL 목록"]
}`;
}

function renderVerifyResult(result) {
  const isVerified = result.isLie === false;

  if (isVerified) {
    verifiedData = {
      ...parsedPlayer,
      officialName: result.official_name,
      verificationLogic: result.verification_logic,
      sources: result.sources || [],
      verifiedAt: new Date().toISOString(),
    };

    const sourcesHtml = (result.sources || [])
      .map(url => `<a href="${url}" target="_blank">${url}</a>`)
      .join('<br/>');

    showResult('success', `
      <strong>✅ 프로선수 확인됨</strong><br/><br/>
      <b>공식 ID:</b> ${result.official_name}<br/>
      <b>판단 근거:</b> ${result.description}<br/>
      <br/>
      <span class="small"><b>📎 검증 출처</b><br/>${sourcesHtml}</span>
    `);
    show('btn-register');
  } else {
    const sourcesHtml = (result.sources || [])
      .map(url => `<a href="${url}" target="_blank">${url}</a>`)
      .join('<br/>');

    showResult('fail', `
      <strong>❌ 프로선수 확인 불가</strong><br/><br/>
      <b>사유:</b> ${result.description}<br/>
      <br/>
      <span class="small"><b>📎 검토한 출처</b><br/>${sourcesHtml || '없음'}</span>
    `);
  }

  show('result-section');
}

// ─── 구글 시트 등록 ──────────────────────────────────────────────────────────

document.getElementById('btn-register').addEventListener('click', async () => {
  hide('btn-register');
  showLoading('구글 시트에 등록 중...');

  try {
    const settings = await client.metadata();
    const webhookUrl = settings.settings?.n8nSheetWebhookUrl
      || 'https://script.google.com/macros/s/AKfycbyhw5cEGtgoNbRSfOdlx23CqOZ2qWrLWBLB0b5vNdgBOHgKPutQB8miY9haHGvFM0zG/exec';

    await client.request({
      url: webhookUrl,
      type: 'POST',
      contentType: 'application/json',
      data: JSON.stringify({
        ticketId: verifiedData.ticketId,
        line: verifiedData.line,
        realName: verifiedData.realName,
        playerName: verifiedData.playerName,
        officialName: verifiedData.officialName,
        riotId: verifiedData.riotId,
        team: verifiedData.team,
        server: verifiedData.server,
        league: verifiedData.league,
        verifiedAt: verifiedData.verifiedAt,
        sources: (verifiedData.sources || []).join(', '),
        status: '승인',
      }),
    });

    hideLoading();
    const regResult = document.getElementById('register-result');
    regResult.className = 'success-box';
    regResult.innerHTML = '✅ 구글 시트에 등록 완료!';
    show('register-result');

    // 티켓에 태그 추가
    try {
      const tagData = await client.get('ticket.tags');
      const currentTags = tagData['ticket.tags'] || [];
      await client.set('ticket.tags', [...currentTags, 'pro_verified']);
    } catch (tagErr) {
      console.warn('태그 추가 실패:', tagErr);
    }

  } catch (err) {
    hideLoading();
    show('btn-register');
    const regResult = document.getElementById('register-result');
    regResult.className = 'error-box';
    const errDetail = err?.responseText || err?.message || JSON.stringify(err) || '알 수 없는 오류';
    regResult.innerHTML = `등록 실패 (${err?.status || ''}): ${errDetail}`;
    show('register-result');
  }
});

// ─── UI 헬퍼 ────────────────────────────────────────────────────────────────

function show(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('hidden');
}

function hide(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('hidden');
}

function showLoading(text) {
  document.getElementById('loading-text').textContent = text;
  show('loading');
}

function updateLoadingText(text) {
  document.getElementById('loading-text').textContent = text;
}

function hideLoading() {
  hide('loading');
}

function showResult(type, html) {
  const box = document.getElementById('result-box');
  box.className = type === 'success' ? 'success-box' : 'fail-box';
  box.innerHTML = html;
}
