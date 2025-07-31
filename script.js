// DOM Elements
const titleScreen = document.getElementById('titleScreen');
const noteScreen = document.getElementById('noteScreen');
const pinInputs = document.querySelectorAll('.pin-input');
const pinDigits = document.querySelectorAll('.pin-digit');
const randomRoomBtn = document.querySelector('.random-room-btn');
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
const shareModal = document.getElementById('shareModal');
const modalClose = shareModal.querySelector('.modal-close');
const shareUrlInput = document.getElementById('shareUrl');
const copyUrlBtn = shareModal.querySelector('.copy-url-btn');
const shareOptions = shareModal.querySelectorAll('.share-option');
const noteLogo = document.getElementById('noteLogo');

// State
let currentRoom = '';
let lastSaved = null;
let saveTimeout = null;
let placeholderIntervals = [];

// Initialize
initializeApp();

// Toast function
function showToast(message, type = 'info') {
    toastMessage.textContent = message;
    toast.className = `toast ${type} show`;
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

function initializeApp() {
    // Focus first input on load
    pinInputs[0].focus();
    
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
    randomRoomBtn.addEventListener('click', generateRandomRoom);

    // Note editor
    noteEditor.addEventListener('input', handleNoteInput);

    // Action buttons
    backBtn.addEventListener('click', goToTitleScreen);
    copyBtn.addEventListener('click', copyNote);
    saveBtn.addEventListener('click', saveNote);
    shareBtn.addEventListener('click', openShareModal);
    
    // Modal events
    modalClose.addEventListener('click', closeShareModal);
    shareModal.addEventListener('click', (e) => {
        if (e.target === shareModal) closeShareModal();
    });
    copyUrlBtn.addEventListener('click', copyShareUrl);
    shareOptions.forEach(option => {
        option.addEventListener('click', handleShare);
    });
    
    // Logo click to go home
    if (noteLogo) {
        noteLogo.addEventListener('click', goToTitleScreen);
    }

    // Check URL for room parameter
    const urlParams = new URLSearchParams(window.location.search);
    const room = urlParams.get('room');
    if (room && /^\d{6}$/.test(room)) {
        enterRoom(room);
    }
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
    
    // Update URL
    const url = new URL(window.location);
    url.searchParams.set('room', room);
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
    // Clear previous content first
    noteEditor.value = '';
    lastSaved = null;
    
    // Show loading state
    loadingOverlay.classList.add('active');
    
    try {
        // Load from GitHub repository directly
        const digits = room.split('');
        const path = `${digits[0]}/${digits[1]}/${digits[2]}/${digits[3]}/${digits[4]}/${digits[5]}/Qnote.txt`;
        const url = `https://raw.githubusercontent.com/PurpleShipHub/QNote/main/${path}`;
        
        const response = await fetch(url);
        
        if (response.ok) {
            const content = await response.text();
            noteEditor.value = content;
            lastSaved = new Date().toISOString(); // We don't have exact time from raw file
        } else if (response.status === 404) {
            // Room doesn't exist yet, that's okay
            console.log(`Room ${room} doesn't exist yet`);
        }
    } catch (error) {
        console.error('Error loading from GitHub:', error);
        showToast('Failed to load note from server', 'error');
    } finally {
        // Hide loading state
        loadingOverlay.classList.remove('active');
        
        // Always update UI
        updateCharCount();
        updateSaveStatus();
    }
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
    } else {
        saveStatus.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
                <path d="M12 6V12L16 14" stroke="currentColor" stroke-width="2"/>
            </svg>
            <span>Never saved</span>
        `;
        saveStatus.classList.remove('saved');
    }
}

async function saveNote() {
    const content = noteEditor.value;
    
    if (content.length > 10240) {
        showToast('Note exceeds maximum length of 10,240 characters', 'error');
        return;
    }
    
    // Show loading overlay
    loadingOverlay.classList.add('active');
    
    try {
        // Call Netlify Function to save to GitHub
        const response = await fetch('/.netlify/functions/save-note', {
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
    if (!noteEditor.value.trim()) {
        showToast('Nothing to copy!', 'error');
        return;
    }
    
    noteEditor.select();
    document.execCommand('copy');
    
    // Show success toast
    showToast('Note copied to clipboard!', 'success');
}

function goToTitleScreen() {
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
    
    // Clear URL
    const url = new URL(window.location);
    url.searchParams.delete('room');
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

// Share modal functions
function openShareModal() {
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
                    // Fallback to custom modal if share failed
                    showCustomShareModal(shareUrl);
                }
            });
    } else {
        // Fallback to custom modal
        showCustomShareModal(shareUrl);
    }
}

function showCustomShareModal(shareUrl) {
    shareUrlInput.value = shareUrl;
    shareModal.classList.add('active');
}

function closeShareModal() {
    shareModal.classList.remove('active');
}

function copyShareUrl() {
    shareUrlInput.select();
    document.execCommand('copy');
    showToast('Link copied to clipboard!', 'success');
}

function handleShare(e) {
    const shareType = e.currentTarget.dataset.share;
    const shareUrl = shareUrlInput.value;
    const shareText = `Check out my note on QNote!`;
    
    let shareLink = '';
    
    switch(shareType) {
        case 'twitter':
            shareLink = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`;
            break;
        case 'facebook':
            shareLink = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;
            break;
        case 'whatsapp':
            shareLink = `https://wa.me/?text=${encodeURIComponent(shareText + ' ' + shareUrl)}`;
            break;
        case 'email':
            shareLink = `mailto:?subject=${encodeURIComponent('QNote - Shared Note')}&body=${encodeURIComponent(shareText + '\n\n' + shareUrl)}`;
            break;
    }
    
    if (shareLink) {
        window.open(shareLink, '_blank');
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