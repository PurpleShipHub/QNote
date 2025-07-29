// GitHub Gist 설정
const GIST_API_URL = 'https://api.github.com/gists';
// 토큰은 환경에 따라 자동 설정됨
let GITHUB_TOKEN = localStorage.getItem('github_token') || window.GIST_TOKEN || '';

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
    // 토큰 확인
    if (!GITHUB_TOKEN) {
        const token = prompt('GitHub Personal Access Token을 입력하세요:\n\n한 번만 입력하면 브라우저에 저장됩니다.\n토큰은 https://github.com/settings/tokens 에서 생성할 수 있습니다.\n\n필요한 권한: gist');
        if (token) {
            localStorage.setItem('github_token', token);
            GITHUB_TOKEN = token;
        } else {
            return;
        }
    }
    
    try {
        // 해당 PIN의 Gist ID 찾기
        const gistId = localStorage.getItem(`gist_${pin}`);
        
        if (gistId) {
            // 기존 Gist 불러오기
            const response = await fetch(`${GIST_API_URL}/${gistId}`, {
                headers: {
                    'Authorization': `token ${GITHUB_TOKEN}`
                }
            });
            
            if (response.ok) {
                const gist = await response.json();
                noteContent.value = gist.files['note.txt'].content || '';
            } else {
                noteContent.value = '';
            }
        } else {
            // 새 노트
            noteContent.value = '';
        }
        
        showNoteSection();
    } catch (error) {
        console.error('Error loading note:', error);
        noteContent.value = '';
        showNoteSection();
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
    if (!currentPin || !GITHUB_TOKEN) return;
    
    const content = noteContent.value;
    const encoder = new TextEncoder();
    const bytes = encoder.encode(content);
    
    // 10KB 제한 확인
    if (bytes.length > 10240) {
        alert('노트 크기가 10KB를 초과합니다.');
        return;
    }
    
    try {
        const gistId = localStorage.getItem(`gist_${currentPin}`);
        
        if (gistId) {
            // 기존 Gist 업데이트
            const response = await fetch(`${GIST_API_URL}/${gistId}`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `token ${GITHUB_TOKEN}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    files: {
                        'note.txt': {
                            content: content
                        }
                    }
                })
            });
            
            if (response.ok) {
                alert('노트가 저장되었습니다!');
            } else {
                throw new Error('Failed to update gist');
            }
        } else {
            // 새 Gist 생성
            const response = await fetch(GIST_API_URL, {
                method: 'POST',
                headers: {
                    'Authorization': `token ${GITHUB_TOKEN}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    description: `QNote - PIN: ${currentPin}`,
                    public: false,
                    files: {
                        'note.txt': {
                            content: content || ' '
                        }
                    }
                })
            });
            
            if (response.ok) {
                const gist = await response.json();
                localStorage.setItem(`gist_${currentPin}`, gist.id);
                alert('노트가 저장되었습니다!');
            } else {
                throw new Error('Failed to create gist');
            }
        }
    } catch (error) {
        console.error('Error saving note:', error);
        if (error.message.includes('401')) {
            alert('토큰이 유효하지 않습니다. 다시 입력해주세요.');
            localStorage.removeItem('github_token');
            GITHUB_TOKEN = '';
        } else {
            alert('저장 중 오류가 발생했습니다.');
        }
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