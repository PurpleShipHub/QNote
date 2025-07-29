// GitHub 레포지토리 정보 설정
const GITHUB_OWNER = 'r2cuerdame'; // GitHub 사용자명
const GITHUB_REPO = 'QNote'; // 레포지토리 이름
const GITHUB_TOKEN = ''; // GitHub Personal Access Token (옵션)

// DOM 요소
const pinInput = document.getElementById('pinInput');
const noteSection = document.getElementById('noteSection');
const noteContent = document.getElementById('noteContent');
const cancelBtn = document.getElementById('cancelBtn');
const saveBtn = document.getElementById('saveBtn');
const copyBtn = document.getElementById('copyBtn');

let currentPin = '';

// PIN 입력 이벤트
pinInput.addEventListener('input', async (e) => {
    const value = e.target.value.replace(/[^0-9]/g, '');
    e.target.value = value;
    
    if (value.length === 6) {
        currentPin = value;
        await loadNote(value);
    }
});

// 노트 불러오기
async function loadNote(pin) {
    const path = getPathFromPin(pin);
    const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${path}/Qnote.txt`;
    
    try {
        const response = await fetch(url, {
            headers: GITHUB_TOKEN ? {
                'Authorization': `token ${GITHUB_TOKEN}`
            } : {}
        });
        
        if (response.ok) {
            const data = await response.json();
            const content = atob(data.content);
            noteContent.value = content;
        } else if (response.status === 404) {
            // 파일이 없으면 빈 노트로 시작
            noteContent.value = '';
        } else {
            throw new Error('Failed to load note');
        }
        
        showNoteSection();
    } catch (error) {
        console.error('Error loading note:', error);
        alert('노트를 불러오는 중 오류가 발생했습니다.');
    }
}

// PIN을 경로로 변환
function getPathFromPin(pin) {
    return pin.split('').join('/');
}

// 노트 섹션 표시
function showNoteSection() {
    noteSection.style.display = 'block';
    noteContent.focus();
}

// 노트 섹션 숨기기
function hideNoteSection() {
    noteSection.style.display = 'none';
    noteContent.value = '';
    pinInput.value = '';
    currentPin = '';
    pinInput.focus();
}

// 취소 버튼
cancelBtn.addEventListener('click', () => {
    hideNoteSection();
});

// 저장 버튼
saveBtn.addEventListener('click', async () => {
    if (!currentPin) return;
    
    const content = noteContent.value;
    const encoder = new TextEncoder();
    const bytes = encoder.encode(content);
    
    // 10KB 제한 확인
    if (bytes.length > 10240) {
        alert('노트 크기가 10KB를 초과합니다.');
        return;
    }
    
    // GitHub Issue 생성
    const issueTitle = `Create note: ${currentPin}`;
    const issueBody = `PIN: ${currentPin}\nContent:\n\`\`\`\n${content}\n\`\`\``;
    
    try {
        const response = await fetch(`https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/issues`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(GITHUB_TOKEN ? { 'Authorization': `token ${GITHUB_TOKEN}` } : {})
            },
            body: JSON.stringify({
                title: issueTitle,
                body: issueBody,
                labels: ['qnote', 'auto-create']
            })
        });
        
        if (response.ok) {
            alert('저장 요청이 전송되었습니다. GitHub Actions가 파일을 생성합니다.');
        } else {
            throw new Error('Failed to create issue');
        }
    } catch (error) {
        console.error('Error saving note:', error);
        alert('저장 중 오류가 발생했습니다.');
    }
});

// 복사 버튼
copyBtn.addEventListener('click', async () => {
    try {
        await navigator.clipboard.writeText(noteContent.value);
        
        // 복사 완료 피드백
        const originalText = copyBtn.textContent;
        copyBtn.textContent = '복사됨!';
        copyBtn.style.backgroundColor = '#4CAF50';
        
        setTimeout(() => {
            copyBtn.textContent = originalText;
            copyBtn.style.backgroundColor = '#2196F3';
        }, 2000);
    } catch (error) {
        console.error('Error copying text:', error);
        alert('복사 중 오류가 발생했습니다.');
    }
});

// Enter 키로 노트 불러오기
pinInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && pinInput.value.length === 6) {
        loadNote(pinInput.value);
    }
});

// 페이지 로드 시 PIN 입력에 포커스
window.addEventListener('load', () => {
    pinInput.focus();
});