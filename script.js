// DOM Elements
const titleScreen = document.getElementById('titleScreen');
const noteScreen = document.getElementById('noteScreen');
const pinInputs = document.querySelectorAll('.pin-input');
const pinDigits = document.querySelectorAll('.pin-digit');
const randomRoomBtn = document.querySelector('.random-btn'); // 올바른 클래스명
const backBtn = document.getElementById('backBtn');
const copyBtn = document.getElementById('copyBtn');
const saveBtn = document.getElementById('saveBtn');
const noteEditor = document.querySelector('.note-editor');
const charCount = document.getElementById('charCount');
const saveStatus = document.querySelector('.save-status');
const loadingOverlay = document.getElementById('loadingOverlay');
const toast = document.getElementById('toast');
const toastMessage = toast.querySelector('.toast-message');
const shareBtn = document.querySelector('.share-btn');
const noteLogo = document.getElementById('noteLogo');

// State
let currentRoom = '';
let lastSaved = null;
let saveTimeout = null;
let placeholderIntervals = [];

// Clear all browser caches on startup
function clearAllCaches() {
    if ('caches' in window) {
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => caches.delete(cacheName))
            );
        }).then(() => {
            console.log('All browser caches cleared successfully.');
        }).catch(error => {
            console.log('Error clearing browser caches:', error.message);
        });
    } else {
        console.log('Web Cache API not supported in this browser.');
    }
}

// Auto-resize textarea function
function autoResizeTextarea() {
    if (noteEditor) {
        noteEditor.style.height = 'auto';
        noteEditor.style.height = Math.max(noteEditor.scrollHeight, 300) + 'px';
    }
}

// Initialize App
function initializeApp() {
    console.log('Initializing app...');
    
    // Clear all caches first
    clearAllCaches();
    
    // Focus first input on load
    if (pinInputs[0]) {
        pinInputs[0].focus();
    }
    
    // Start placeholder animation
    startPlaceholderAnimation();
    
    // Setup PIN input handlers
    pinInputs.forEach((input, index) => {
        input.addEventListener('input', (e) => handlePinInput(e, index));
        input.addEventListener('keydown', (e) => handlePinKeydown(e, index));
        input.addEventListener('paste', handlePinPaste);
        input.addEventListener('focus', stopPlaceholderForInput);
        input.addEventListener('blur', (e) => {
            if (!e.target.value) {
                startPlaceholderForInput(index);
            }
        });
    });

    // Random room button
    if (randomRoomBtn) {
        randomRoomBtn.addEventListener('click', generateRandomRoom);
    }

    // Note editor
    if (noteEditor) {
        noteEditor.addEventListener('input', () => {
            handleNoteInput();
            autoResizeTextarea();
        });
    }

    // Action buttons with null checks
    if (backBtn) {
        backBtn.addEventListener('click', goToTitleScreen);
        console.log('Back button listener added');
    } else {
        console.log('Back button not found');
    }
    
    if (copyBtn) {
        copyBtn.addEventListener('click', copyNote);
        console.log('Copy button listener added');
    } else {
        console.log('Copy button not found');
    }
    
    if (saveBtn) {
        saveBtn.addEventListener('click', saveNote);
        console.log('Save button listener added');
    } else {
        console.log('Save button not found');
    }
    
    if (shareBtn) {
        shareBtn.addEventListener('click', shareNote);
        console.log('Share button listener added');
    } else {
        console.log('Share button not found');
    }
    
    // Logo click to go home
    if (noteLogo) {
        noteLogo.addEventListener('click', goToTitleScreen);
    }

    // Check URL for room number (multiple formats supported)
    let room = null;
    
    // 1. Check hash format: qnote.io#123456
    if (window.location.hash) {
        const hashRoom = window.location.hash.substring(1); // Remove # symbol
        if (/^\d{6}$/.test(hashRoom)) {
            room = hashRoom;
        }
    }
    
    // 2. Check path format: qnote.io/123456
    if (!room && window.location.pathname && window.location.pathname !== '/') {
        const pathRoom = window.location.pathname.substring(1); // Remove / symbol
        if (/^\d{6}$/.test(pathRoom)) {
            room = pathRoom;
        }
    }
    
    // 3. Check query format (legacy): qnote.io?room=123456
    if (!room) {
        const urlParams = new URLSearchParams(window.location.search);
        const queryRoom = urlParams.get('room');
        if (queryRoom && /^\d{6}$/.test(queryRoom)) {
            room = queryRoom;
        }
    }
    
    if (room) {
        enterRoom(room);
    }
}

// Toast function
function showToast(message, type = 'info') {
    toastMessage.textContent = message;
    toast.className = `toast ${type} show`;
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

function handlePinInput(e, index) {
    const value = e.target.value;
    
    // Only allow digits
    if (!/^\d*$/.test(value)) {
        e.target.value = '';
        return;
    }

    if (value.length === 1) {
        // Move to next input
        if (index < pinInputs.length - 1) {
            pinInputs[index + 1].focus();
        } else {
            // All inputs filled, check room
            checkRoom();
        }
    }
}

function handlePinKeydown(e, index) {
    // Handle backspace
    if (e.key === 'Backspace' && e.target.value === '' && index > 0) {
        pinInputs[index - 1].focus();
    }
    
    // Handle Enter
    if (e.key === 'Enter') {
        checkRoom();
    }
}

function handlePinPaste(e) {
    e.preventDefault();
    const pasteData = e.clipboardData.getData('text');
    
    // Only handle 6-digit paste
    if (/^\d{6}$/.test(pasteData)) {
        const digits = pasteData.split('');
        pinInputs.forEach((input, index) => {
            input.value = digits[index] || '';
        });
        checkRoom();
    }
}

function generateRandomRoom() {
    const room = Math.floor(100000 + Math.random() * 900000).toString();
    const digits = room.split('');
    
    pinInputs.forEach((input, index) => {
        input.value = digits[index];
    });
    
    setTimeout(() => checkRoom(), 300);
}

function checkRoom() {
    const room = Array.from(pinInputs).map(input => input.value).join('');
    
    if (room.length === 6) {
        enterRoom(room);
    }
}

async function enterRoom(room) {
    currentRoom = room;
    
    // Stop placeholder animations
    stopAllPlaceholderAnimations();
    
    // Update URL (prefer hash format for simplicity)
    const url = new URL(window.location);
    
    // Clear all existing room indicators
    url.searchParams.delete('room');
    url.hash = '';
    
    // Set room as hash
    url.hash = room;
    
    window.history.pushState({}, '', url);
    
    // Update PIN display
    const digits = room.split('');
    pinDigits.forEach((digit, index) => {
        digit.textContent = digits[index];
    });
    
    // Load room data
    await loadRoomData(room);
    
    // Show note screen
    titleScreen.classList.remove('active');
    noteScreen.classList.add('active');
}

async function loadRoomData(room) {
    // Clear previous content first - force complete reset
    noteEditor.value = '';
    noteEditor.textContent = '';
    noteEditor.innerHTML = '';
    
    // Force clear any browser form cache/autofill
    noteEditor.setAttribute('autocomplete', 'off');
    noteEditor.setAttribute('autocorrect', 'off');
    noteEditor.setAttribute('autocapitalize', 'off');
    noteEditor.setAttribute('spellcheck', 'false');
    
    // Reset editor state completely
    if (noteEditor.setSelectionRange) {
        noteEditor.setSelectionRange(0, 0);
    }
    
    // Force DOM update
    noteEditor.blur();
    setTimeout(() => noteEditor.focus(), 10);
    
    lastSaved = null;
    
    // Show loading state with specific message
    const loadingMessage = document.querySelector('.loading-message');
    loadingMessage.textContent = `Loading room ${room}...`;
    loadingOverlay.classList.add('active');
    
    // Add minimum loading time for better UX (at least 300ms)
    const minLoadingTime = 300;
    const loadingStartTime = Date.now();

    // Check if we're in local environment
    const isLocal = window.location.protocol === 'file:' || 
                   window.location.hostname === 'localhost' || 
                   window.location.hostname === '127.0.0.1';

    let content = '';
    let success = false;

    // Only try to read from GitHub in deployed environment
    if (!isLocal) {
        // Force clear browser cache for this domain (async, don't wait)
        clearAllCaches();

        try {
            // Create strong cache busting parameters
            const timestamp = Date.now();
            const random = Math.random().toString(36).substring(7);
            const uuid = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
            const nonce = Math.random().toString(36).substring(2, 15);
            const bust = Math.floor(Math.random() * 9999999999);
            
            // 올바른 경로 구조로 수정
            const digits = room.split('');
            const path = `${digits[0]}/${digits[1]}/${digits[2]}/${digits[3]}/${digits[4]}/${digits[5]}/Qnote.txt`;
            
            // Only use GitHub API to avoid CORS issues
            try {
                const apiUrl = `https://api.github.com/repos/PurpleShipHub/QNote/contents/${path}?_=${timestamp}&r=${random}`;
                console.log('Trying GitHub API:', apiUrl);
                
                const apiResponse = await fetch(apiUrl, {
                    headers: {
                        'Accept': 'application/vnd.github.v3+json',
                        'User-Agent': 'QNote-App'
                    },
                    cache: 'no-store'
                });
                
                if (apiResponse.ok) {
                    const data = await apiResponse.json();
                    content = atob(data.content); // Decode base64
                    success = true;
                    console.log(`Successfully loaded from GitHub API, content length: ${content.length}`);
                } else if (apiResponse.status === 404) {
                    console.log(`Room ${room} is new (API confirms file doesn't exist)`);
                    success = false;
                } else if (apiResponse.status === 403) {
                    console.log('GitHub API rate limit exceeded, using empty content for new room');
                    success = false;
                } else {
                    console.log(`GitHub API failed with status ${apiResponse.status}`);
                    success = false;
                }
            } catch (apiError) {
                console.log('GitHub API failed:', apiError.message);
                success = false;
            }
        } catch (error) {
            console.error('Error loading from GitHub:', error);
            showToast('Failed to load note from server', 'error');
        }
    } else {
        // Local environment - skip reading, start with empty content
        console.log('Local environment detected - starting with empty content. Deploy to Netlify to enable reading existing notes.');
        success = false;
    }
    
    // Force clear editor again before setting new content
    noteEditor.value = '';
    noteEditor.textContent = '';
    
    // Set the editor content (empty for new rooms is normal)
    console.log(`Setting editor content: "${content}" (length: ${content.length})`);
    noteEditor.value = content;
    
    // Auto-resize textarea after setting content
    autoResizeTextarea();
    
    // Force DOM update
    noteEditor.dispatchEvent(new Event('input', { bubbles: true }));
    
    if (success) {
        lastSaved = new Date().toISOString();
    } else {
        lastSaved = null;
        if (isLocal) {
            console.log(`Room ${room} ready for editing (local mode - no reading from GitHub)`);
        } else {
            console.log(`Room ${room} is ready for new content`);
        }
    }
    
    // Force refresh the UI to ensure no cached states
    setTimeout(() => {
        updateCharCount();
        updateSaveStatus();
        autoResizeTextarea();
    }, 50);
    
    // Always hide loading state
    const loadingElapsed = Date.now() - loadingStartTime;
    const remainingTime = Math.max(0, minLoadingTime - loadingElapsed);
    
    setTimeout(() => {
        // Hide loading state
        loadingOverlay.classList.remove('active');
        
        // Always update UI
        updateCharCount();
        updateSaveStatus();
        autoResizeTextarea();
    }, remainingTime);
}

function handleNoteInput() {
    updateCharCount();
}

function updateCharCount() {
    const count = noteEditor.value.length;
    charCount.textContent = count;
    
    // Warning color if approaching limit
    if (count > 9000) {
        charCount.style.color = '#ff4444';
    } else {
        charCount.style.color = '';
    }
}

function updateSaveStatus() {
    if (lastSaved) {
        const now = new Date();
        const saved = new Date(lastSaved);
        const diff = Math.floor((now - saved) / 1000);
        
        let timeText;
        if (diff < 60) {
            timeText = 'Just saved';
        } else if (diff < 3600) {
            timeText = `Saved ${Math.floor(diff / 60)} minutes ago`;
        } else if (diff < 86400) {
            timeText = `Saved ${Math.floor(diff / 3600)} hours ago`;
        } else {
            timeText = `Saved ${Math.floor(diff / 86400)} days ago`;
        }
        
        saveStatus.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M9 11L12 14L20 6" stroke="#22c55e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M20 12V18C20 19.1046 19.1046 20 18 20H6C4.89543 20 4 19.1046 4 18V6C4 4.89543 4.89543 4 6 4H15" stroke="#22c55e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <span>${timeText}</span>
        `;
        saveStatus.classList.add('saved');
        saveStatus.style.display = 'flex';
    } else {
        // Never saved 상태는 숨김
        saveStatus.style.display = 'none';
        saveStatus.classList.remove('saved');
    }
}

// Track last save time to prevent too frequent saves
let lastSaveTime = 0;
const MIN_SAVE_INTERVAL = 2000; // 2 seconds minimum between saves

async function saveNote() {
    console.log('Save button clicked');
    const content = noteEditor.value;
    
    if (content.length > 10240) {
        showToast('Note exceeds maximum length of 10,240 characters', 'error');
        return;
    }
    
    // Prevent too frequent saves
    const now = Date.now();
    if (now - lastSaveTime < MIN_SAVE_INTERVAL) {
        const remainingTime = Math.ceil((MIN_SAVE_INTERVAL - (now - lastSaveTime)) / 1000);
        showToast(`Please wait ${remainingTime} more second(s) before saving again`, 'warning');
        return;
    }
    
    lastSaveTime = now;
    
    // Show loading overlay
    loadingOverlay.classList.add('active');
    
    try {
        // Determine the correct API URL based on environment
        const isLocal = window.location.protocol === 'file:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        const apiUrl = isLocal 
            ? 'https://qnote-backend.netlify.app/.netlify/functions/save-note'
            : '/.netlify/functions/save-note';
        
        console.log('Save API URL:', apiUrl);
        
        // Call Netlify Function to save to GitHub
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                room: currentRoom,
                content: content
            })
        });
        
        if (response.ok) {
            const result = await response.json();
            lastSaved = result.lastSaved;
            updateSaveStatus();
            showToast('Note saved successfully!', 'success');
            
            // Don't reload from server immediately after save - use local content
            // This prevents issues with GitHub raw URL cache delays
            console.log('Note saved successfully, keeping current editor content');
            
            // Mark that we just saved to avoid unnecessary reloads
            window.justSavedTimestamp = Date.now();
            window.lastSavedRoom = currentRoom; // Store the room for recent check
        } else {
            const error = await response.json();
            throw new Error(error.error || 'Failed to save note');
        }
    } catch (error) {
        console.error('Error saving note:', error);
        showToast('Failed to save note: ' + error.message, 'error');
    } finally {
        // Hide loading overlay
        loadingOverlay.classList.remove('active');
    }
}

function copyNote() {
    console.log('Copy button clicked');
    if (!noteEditor.value.trim()) {
        showToast('Nothing to copy!', 'error');
        return;
    }
    
    copyToClipboard(noteEditor.value);
}

function copyToClipboard(text) {
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(() => {
            showToast('Note copied to clipboard!', 'success');
        }).catch(err => {
            console.error('Failed to copy: ', err);
            // Fallback to older method
            fallbackCopyToClipboard(text);
        });
    } else {
        // Fallback for older browsers
        fallbackCopyToClipboard(text);
    }
}

function fallbackCopyToClipboard(text) {
    noteEditor.select();
    try {
        document.execCommand('copy');
        showToast('Note copied to clipboard!', 'success');
    } catch (err) {
        console.error('Failed to copy: ', err);
        showToast('Failed to copy to clipboard', 'error');
    }
}

function goToTitleScreen() {
    console.log('Back button clicked');
    // Clear current room data
    currentRoom = '';
    noteEditor.value = '';
    lastSaved = null;
    updateCharCount();
    updateSaveStatus();
    
    // Stop any existing animations first
    stopAllPlaceholderAnimations();
    
    // Clear PIN inputs
    pinInputs.forEach(input => {
        input.value = '';
        input.placeholder = '';
    });
    
    // Clear URL (remove all room indicators)
    const url = new URL(window.location);
    url.searchParams.delete('room');
    url.hash = '';
    url.pathname = '/';
    window.history.pushState({}, '', url);
    
    // Show title screen
    noteScreen.classList.remove('active');
    titleScreen.classList.add('active');
    
    // Focus first input and restart animation after a small delay
    setTimeout(() => {
        pinInputs[0].focus();
        startPlaceholderAnimation();
    }, 100);
}

// Share function using Web Share API or clipboard fallback
function shareNote() {
    console.log('Share button clicked');
    const shareUrl = `${window.location.origin}${window.location.pathname}?room=${currentRoom}`;
    const shareData = {
        title: 'QNote - Shared Note',
        text: 'Check out my note on QNote!',
        url: shareUrl
    };
    
    // Check if Web Share API is available
    if (navigator.share) {
        // Use native share
        navigator.share(shareData)
            .then(() => showToast('Shared successfully!', 'success'))
            .catch((error) => {
                if (error.name !== 'AbortError') {
                    // Fallback to clipboard if share failed
                    copyToClipboard(shareUrl);
                }
            });
    } else {
        // Fallback to clipboard
        copyToClipboard(shareUrl);
        showToast('Share link copied to clipboard!', 'success');
    }
}

// Placeholder animation functions
function startPlaceholderAnimation() {
    pinInputs.forEach((input, index) => {
        if (!input.value) {
            startPlaceholderForInput(index);
        }
    });
}

function startPlaceholderForInput(index) {
    // Clear any existing interval for this input
    if (placeholderIntervals[index]) {
        clearInterval(placeholderIntervals[index]);
    }
    
    // Start new interval
    placeholderIntervals[index] = setInterval(() => {
        const randomNum = Math.floor(Math.random() * 10);
        pinInputs[index].placeholder = randomNum.toString();
    }, 100); // Change every 100ms for fast animation
}

function stopPlaceholderForInput(e) {
    const index = Array.from(pinInputs).indexOf(e.target);
    if (placeholderIntervals[index]) {
        clearInterval(placeholderIntervals[index]);
        placeholderIntervals[index] = null;
        e.target.placeholder = '';
    }
}

function stopAllPlaceholderAnimations() {
    placeholderIntervals.forEach(interval => {
        if (interval) clearInterval(interval);
    });
    placeholderIntervals = [];
    pinInputs.forEach(input => {
        input.placeholder = '';
    });
}

// Update save status periodically
setInterval(() => {
    if (lastSaved) {
        updateSaveStatus();
    }
}, 60000); // Every minute

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', initializeApp);

// Clear caches on page load and unload
window.addEventListener('load', function() {
    clearAllCaches();
});

window.addEventListener('beforeunload', function() {
    clearAllCaches();
});