// GitHub 레포지토리 정보 설정
const GITHUB_OWNER = 'r2cuerdame'; // GitHub 사용자명
const GITHUB_REPO = 'QNote'; // 레포지토리 이름
const GITHUB_TOKEN = ''; // GitHub Personal Access Token (옵션)

// DOM 요소
const pinDigits = document.querySelectorAll('.pin-digit');
const noteSection = document.getElementById('noteSection');
const noteContent = document.getElementById('noteContent');
const cancelBtn = document.getElementById('cancelBtn');
const saveBtn = document.getElementById('saveBtn');
const copyBtn = document.getElementById('copyBtn');

let currentPin = '';

// PIN 입력 이벤트 설정
pinDigits.forEach((input, index) => {
    input.addEventListener('input', async (e) => {
        const value = e.target.value.replace(/[^0-9]/g, '');
        e.target.value = value;
        
        if (value) {
            e.target.classList.add('filled');
            
            // 다음 입력 칸으로 자동 이동
            if (index < pinDigits.length - 1) {
                pinDigits[index + 1].focus();
            } else {
                // 마지막 칸이면 PIN 확인
                const pin = Array.from(pinDigits).map(digit => digit.value).join('');
                if (pin.length === 6) {
                    currentPin = pin;
                    await loadNote(pin);
                }
            }
        } else {
            e.target.classList.remove('filled');
        }
    });
    
    input.addEventListener('keydown', (e) => {
        // Backspace 처리
        if (e.key === 'Backspace' && !e.target.value && index > 0) {
            pinDigits[index - 1].focus();
            pinDigits[index - 1].value = '';
            pinDigits[index - 1].classList.remove('filled');
        }
        // Enter 키 처리
        else if (e.key === 'Enter') {
            const pin = Array.from(pinDigits).map(digit => digit.value).join('');
            if (pin.length === 6) {
                currentPin = pin;
                loadNote(pin);
            }
        }
    });
    
    // 붙여넣기 처리
    input.addEventListener('paste', (e) => {
        e.preventDefault();
        const pastedData = e.clipboardData.getData('text').replace(/[^0-9]/g, '');
        const digits = pastedData.slice(0, 6).split('');
        
        digits.forEach((digit, i) => {
            if (i < pinDigits.length) {
                pinDigits[i].value = digit;
                pinDigits[i].classList.add('filled');
            }
        });
        
        if (digits.length === 6) {
            currentPin = digits.join('');
            loadNote(currentPin);
        } else if (digits.length < 6) {
            pinDigits[Math.min(digits.length, 5)].focus();
        }
    });
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
    
    // PIN 입력 비활성화
    pinDigits.forEach(digit => {
        digit.disabled = true;
    });
}

// 노트 섹션 숨기기
function hideNoteSection() {
    noteSection.style.display = 'none';
    noteContent.value = '';
    pinDigits.forEach(digit => {
        digit.value = '';
        digit.classList.remove('filled');
        digit.disabled = false;  // PIN 입력 다시 활성화
    });
    currentPin = '';
    pinDigits[0].focus();
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

// 페이지 로드 시 첫 번째 PIN 입력에 포커스
window.addEventListener('load', () => {
    pinDigits[0].focus();
});