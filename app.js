// API 설정
const GITHUB_API_URL = 'https://api.github.com';
const NETLIFY_FUNCTION_URL = window.location.hostname === 'localhost' 
    ? 'http://localhost:8888/.netlify/functions' 
    : 'https://qnote-backend.netlify.app/.netlify/functions';

// DOM 요소
const pinDigits = document.querySelectorAll('.pin-digit');
const noteSection = document.getElementById('noteSection');
const noteContent = document.getElementById('noteContent');
const cancelBtn = document.getElementById('cancelBtn');
const saveBtn = document.getElementById('saveBtn');
const copyBtn = document.getElementById('copyBtn');
const toast = document.getElementById('toast');
const pinSection = document.querySelector('.pin-section');
const loadingOverlay = document.getElementById('loadingOverlay');

let currentPin = '';

// Toast 메시지 표시
function showToast(message, type = 'success') {
    toast.textContent = message;
    toast.className = `toast ${type}`;
    toast.classList.add('show');
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

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
    const url = `${GITHUB_API_URL}/repos/PurpleShipHub/QNote/contents/${path}/Qnote.txt`;
    
    try {
        // 캐시 방지를 위해 timestamp 추가
        const response = await fetch(url + '?t=' + Date.now(), {
            cache: 'no-store'
        });
        
        if (response.ok) {
            const data = await response.json();
            const content = decodeURIComponent(escape(atob(data.content)));
            noteContent.value = content;
        } else if (response.status === 404) {
            // 파일이 없으면 빈 노트로 시작
            noteContent.value = '';
        } else {
            throw new Error('Failed to load note');
        }
        
        showNoteSection();
        // 콘텐츠 로드 후 스크롤을 최상단으로
        noteContent.scrollTop = 0;
        // 캐럿 위치를 맨 앞으로 설정
        noteContent.setSelectionRange(0, 0);
    } catch (error) {
        console.error('Error loading note:', error);
        noteContent.value = '';
        showNoteSection();
        // 콘텐츠 로드 후 스크롤을 최상단으로
        noteContent.scrollTop = 0;
        // 캐럿 위치를 맨 앞으로 설정
        noteContent.setSelectionRange(0, 0);
    }
}

// PIN을 경로로 변환
function getPathFromPin(pin) {
    return pin.split('').join('/');
}

// 노트 섹션 표시
function showNoteSection() {
    noteSection.style.display = 'block';
    
    // 텍스트 영역을 최상단으로 스크롤
    noteContent.scrollTop = 0;
    // 캐럿 위치를 맨 앞으로 설정
    noteContent.setSelectionRange(0, 0);
    noteContent.focus();
    
    // PIN 입력 비활성화
    pinDigits.forEach(digit => {
        digit.disabled = true;
    });
    
    // PIN 안내 문구 숨기기
    const pinInstruction = document.querySelector('.pin-instruction');
    if (pinInstruction) {
        pinInstruction.style.display = 'none';
    }
    
    // 부제목 숨기기
    const subtitle = document.querySelector('.subtitle');
    if (subtitle) {
        subtitle.style.display = 'none';
    }
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
    
    // PIN 안내 문구 다시 표시
    const pinInstruction = document.querySelector('.pin-instruction');
    if (pinInstruction) {
        pinInstruction.style.display = 'block';
    }
    
    // 부제목 다시 표시
    const subtitle = document.querySelector('.subtitle');
    if (subtitle) {
        subtitle.style.display = 'block';
    }
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
        showToast('Note size exceeds 10KB limit.', 'error');
        return;
    }
    
    // 로딩 시작
    loadingOverlay.classList.add('active');
    noteContent.disabled = true;
    cancelBtn.disabled = true;
    saveBtn.disabled = true;
    copyBtn.disabled = true;
    
    try {
        // Netlify 함수 호출
        const response = await fetch(`${NETLIFY_FUNCTION_URL}/save-note`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                pin: currentPin,
                content: content
            })
        });
        
        if (response.ok) {
            showToast('Note saved successfully!', 'success');
        } else {
            showToast('Save failed. Netlify function not available.', 'error');
        }
    } catch (error) {
        console.error('Error saving note:', error);
        showToast('Save failed. Please try again.', 'error');
    } finally {
        // 로딩 종료
        loadingOverlay.classList.remove('active');
        noteContent.disabled = false;
        cancelBtn.disabled = false;
        saveBtn.disabled = false;
        copyBtn.disabled = false;
    }
});

// 복사 버튼
copyBtn.addEventListener('click', async () => {
    try {
        await navigator.clipboard.writeText(noteContent.value);
        
        showToast('Copied!', 'success');
    } catch (error) {
        console.error('Error copying text:', error);
        showToast('Copy failed.', 'error');
    }
});

// 페이지 로드 시 첫 번째 PIN 입력에 포커스
window.addEventListener('load', () => {
    pinDigits[0].focus();
});

// QNote 타이틀 클릭 이벤트
const qnoteTitle = document.getElementById('qnoteTitle');
if (qnoteTitle) {
    qnoteTitle.addEventListener('click', () => {
        hideNoteSection();
    });
}


