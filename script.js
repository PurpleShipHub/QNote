// DOM Elements
const titleScreen = document.getElementById('titleScreen');
const noteScreen = document.getElementById('noteScreen');
const pinInputs = document.querySelectorAll('.pin-input');
const pinDigits = document.querySelectorAll('.pin-digit');
const randomPinBtn = document.querySelector('.random-btn'); // 랜덤 PIN 버튼
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
let currentPin = '';
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

// Generate QR code for current URL
let qrCodeInstance = null;

function generateQRCode() {
    const qrContainer = document.getElementById('qrcode');
    
    // Check if QRCode library is loaded
    if (typeof QRCode === 'undefined') {
        console.error('QRCode library is not loaded');
        return;
    }
    
    // Log browser info for debugging
    console.log('User Agent:', navigator.userAgent);
    console.log('Canvas support:', !!document.createElement('canvas').getContext);
    console.log('Is Android:', /Android/i.test(navigator.userAgent));
    
    // Clear existing QR code
    qrContainer.innerHTML = '';
    
    // Generate new QR code
    const currentUrl = window.location.href;
    
    console.log('Generating QR code for:', currentUrl);
    
    try {
        // Create QR code at 42x42px for clean 2x2 pixel modules
        qrCodeInstance = new QRCode(qrContainer, {
            text: currentUrl,
            width: 42,
            height: 42,
            colorDark: "#000000",
            colorLight: "#ffffff",
            correctLevel: QRCode.CorrectLevel.L, // Low error correction for simpler pattern
            useSVG: false,
            typeNumber: 1, // Force Version 1 (21x21 modules) for cleaner appearance
            margin: 0 // Remove quiet zone margin
        });
        
        // Ensure square aspect ratio
        setTimeout(() => {
            const img = qrContainer.querySelector('img');
            const canvas = qrContainer.querySelector('canvas');
            
            if (img) {
                // Set to 42x42 for Version 1 QR codes
                img.style.width = '42px';
                img.style.height = '42px';
                img.style.imageRendering = 'pixelated';
                
                // Function to crop to 41x41 from top-left
                const cropImage = () => {
                    try {
                        // Create canvas to crop the image
                        const cropCanvas = document.createElement('canvas');
                        const ctx = cropCanvas.getContext('2d');
                        
                        if (!ctx) {
                            console.error('Canvas context not available');
                            return;
                        }
                        
                        cropCanvas.width = 41;
                        cropCanvas.height = 41;
                        
                        // Draw only the top-left 41x41 portion of the image
                        ctx.drawImage(img, 0, 0, 41, 41, 0, 0, 41, 41);
                        
                        // Create a new image element with the cropped content
                        const croppedImg = new Image();
                        croppedImg.style.width = '41px';
                        croppedImg.style.height = '41px';
                        croppedImg.style.imageRendering = 'pixelated';
                        croppedImg.style.imageRendering = '-moz-crisp-edges';
                        croppedImg.style.imageRendering = 'crisp-edges';
                        croppedImg.style.imageRendering = '-webkit-crisp-edges';
                        croppedImg.style.imageRendering = '-o-crisp-edges';
                        croppedImg.style.msInterpolationMode = 'nearest-neighbor';
                        
                        // Add mobile-specific styles
                        croppedImg.style.display = 'block';
                        croppedImg.style.border = 'none';
                        croppedImg.style.outline = 'none';
                        croppedImg.style.webkitTouchCallout = 'none';
                        croppedImg.style.webkitUserSelect = 'none';
                        croppedImg.style.userSelect = 'none';
                        
                        croppedImg.src = cropCanvas.toDataURL('image/png');
                        
                        // Replace the original image with the cropped one
                        img.parentNode.replaceChild(croppedImg, img);
                        
                        console.log('QR Code cropped to 41x41 from top-left');
                    } catch (error) {
                        console.error('Error cropping QR code:', error);
                        // Fallback: just resize the original image
                        img.style.width = '41px';
                        img.style.height = '41px';
                    }
                };
                
                // Try to crop immediately if image is already loaded
                if (img.complete && img.naturalWidth > 0) {
                    setTimeout(cropImage, 100);
                } else {
                    // Otherwise wait for load
                    img.onload = cropImage;
                }
                
                console.log('QR Code set to 42x42px (Version 1: 21x21 modules, 2px per module)');
            }
            
            if (canvas) {
                console.log('Canvas dimensions:', canvas.width, 'x', canvas.height);
            }
        }, 50);
        
        console.log('QR code generated for URL:', currentUrl);
    } catch (error) {
        console.error('Error generating QR code:', error);
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
        // Prevent non-numeric characters from being entered
        input.addEventListener('keypress', (e) => {
            const char = String.fromCharCode(e.which || e.keyCode);
            if (!/[0-9]/.test(char)) {
                e.preventDefault();
                return false;
            }
        });
        input.addEventListener('paste', handlePinPaste);
        input.addEventListener('focus', stopPlaceholderForInput);
        input.addEventListener('blur', (e) => {
            if (!e.target.value) {
                startPlaceholderForInput(index);
            }
        });
    });

    // Random pin button
    if (randomPinBtn) {
        randomPinBtn.addEventListener('click', generateRandomPin);
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
    
    // Handle browser back button and hash changes
    window.addEventListener('hashchange', function(event) {
        console.log('Hash changed from:', event.oldURL, 'to:', event.newURL);
        console.log('Current hash:', window.location.hash);
        console.log('Current PIN:', currentPin);
        console.log('Note screen active:', noteScreen.classList.contains('active'));
        
        // If hash is empty or just '#', go to title screen
        if (!window.location.hash || window.location.hash === '#') {
            console.log('Empty hash detected, checking if should go to title screen');
            if (noteScreen.classList.contains('active')) {
                console.log('Going to title screen from hash change');
                goToTitleScreen();
            }
        } else {
            // If hash is a valid PIN, enter that PIN
            const pin = window.location.hash.substring(1);
            console.log('Hash has PIN:', pin);
            if (/^\d{6}$/.test(pin)) {
                if (pin !== currentPin) {
                    console.log('Entering different PIN:', pin);
                    enterPin(pin);
                } else {
                    console.log('Same PIN, no action needed');
                }
            }
        }
    });
    
    // Also handle popstate for browser navigation
    window.addEventListener('popstate', function(event) {
        console.log('Popstate event fired', event.state);
        console.log('Current URL:', window.location.href);
        console.log('Current hash:', window.location.hash);
        
        // Check if we should go back to title screen
        if (!window.location.hash || window.location.hash === '#') {
            if (noteScreen.classList.contains('active')) {
                console.log('Popstate: Going to title screen');
                goToTitleScreen();
            }
        } else {
            // Update QR code if we're on note screen
            if (noteScreen.classList.contains('active')) {
                generateQRCode();
            }
        }
    });
    
    // Logo click to go home
    if (noteLogo) {
        noteLogo.addEventListener('click', goToTitleScreen);
    }

    // Check URL for pin number (multiple formats supported)
    let pin = null;
    
    // 1. Check hash format: qnote.io#123456
    if (window.location.hash) {
        const hashPin = window.location.hash.substring(1); // Remove # symbol
        if (/^\d{6}$/.test(hashPin)) {
            pin = hashPin;
        }
    }
    
    // 2. Check path format: qnote.io/123456
    if (!pin && window.location.pathname && window.location.pathname !== '/') {
        const pathPin = window.location.pathname.substring(1); // Remove / symbol
        if (/^\d{6}$/.test(pathPin)) {
            pin = pathPin;
        }
    }
    
    // 3. Check query format (legacy): qnote.io?pin=123456
    if (!pin) {
        const urlParams = new URLSearchParams(window.location.search);
        const queryPin = urlParams.get('pin') || urlParams.get('room'); // support legacy 'room' param
        if (queryPin && /^\d{6}$/.test(queryPin)) {
            pin = queryPin;
        }
    }
    
    if (pin) {
        enterPin(pin);
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
    let value = e.target.value;
    
    // Remove any non-digit characters
    value = value.replace(/[^\d]/g, '');
    
    // Only keep the last digit if multiple digits were entered
    if (value.length > 1) {
        value = value.slice(-1);
    }
    
    e.target.value = value;
    
    if (value.length === 1) {
        // Move to next input
        if (index < pinInputs.length - 1) {
            pinInputs[index + 1].focus();
        } else {
            // All inputs filled, check pin
            checkPin();
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
        checkPin();
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
        checkPin();
    }
}

function generateRandomPin() {
    const pin = Math.floor(100000 + Math.random() * 900000).toString();
    const digits = pin.split('');
    
    pinInputs.forEach((input, index) => {
        input.value = digits[index];
    });
    
    setTimeout(() => checkPin(), 300);
}

function checkPin() {
    const pin = Array.from(pinInputs).map(input => input.value).join('');
    
    if (pin.length === 6) {
        enterPin(pin);
    }
}

async function enterPin(pin) {
    console.log('enterPin called with:', pin);
    currentPin = pin;
    
    // Stop placeholder animations
    stopAllPlaceholderAnimations();
    
    // Update URL with proper history management
    const newHash = '#' + pin;
    if (window.location.hash !== newHash) {
        console.log('Updating hash from', window.location.hash, 'to', newHash);
        // Use pushState for new entries, replaceState for updates
        if (!window.location.hash || window.location.hash === '#') {
            // Coming from home screen, push new state
            history.pushState({ pin: pin }, '', newHash);
        } else {
            // Switching between PINs, replace state
            history.replaceState({ pin: pin }, '', newHash);
        }
    }
    
    // Update PIN display
    const digits = pin.split('');
    pinDigits.forEach((digit, index) => {
        digit.textContent = digits[index];
    });
    
    // Load pin data
    await loadPinData(pin);
    
    // Show note screen
    titleScreen.classList.remove('active');
    noteScreen.classList.add('active');
    
    // Generate QR code for current URL
    generateQRCode();
}

async function loadPinData(pin) {
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
    loadingMessage.textContent = `Loading PIN ${pin}...`;
    loadingOverlay.classList.add('active');
    
    // Add minimum loading time for better UX (at least 300ms)
    const minLoadingTime = 300;
    const loadingStartTime = Date.now();

    let content = '';
    let success = false;

    // Always try to read from GitHub (remove local environment restriction)
    // Force clear browser cache for this domain (async, don't wait)
    clearAllCaches();

    try {
        // Use Netlify Function to read notes (avoids rate limits)
        try {
            // Determine the correct API URL based on environment
            const currentHostname = window.location.hostname;
            const currentProtocol = window.location.protocol;
            
            const isLocal = currentProtocol === 'file:' || 
                           currentHostname === 'localhost' || 
                           currentHostname === '127.0.0.1';
            
            const isNetlifyBackend = currentHostname.includes('qnote-backend.netlify.app');
            
            let apiUrl;
            if (isNetlifyBackend && !isLocal) {
                // qnote-backend.netlify.app에서는 상대 경로 사용
                apiUrl = '/.netlify/functions/read-note';
            } else {
                // 다른 모든 환경(로컬, qnote.io 등)에서는 직접 백엔드 URL 사용
                // This will be replaced during deployment
                apiUrl = 'https://xru7u6nnfd.execute-api.ap-northeast-2.amazonaws.com/api/read-note';
            }
            
            console.log('Reading from Netlify Function:', apiUrl);
            
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ room: pin }), // API still expects 'room' param
                cache: 'no-store'
            });
            
            if (response.ok) {
                const data = await response.json();
                content = data.content || '';
                success = data.exists;
                
                if (data.exists) {
                    console.log(`Successfully loaded existing note, content length: ${content.length}`);
                } else {
                    console.log(`PIN ${pin} is new (file doesn't exist)`);
                }
            } else {
                const error = await response.json();
                console.error('Failed to read note:', error);
                showToast('Failed to load note', 'error');
                success = false;
            }
        } catch (error) {
            console.error('Error calling read function:', error);
            showToast('Network error while loading note', 'error');
            success = false;
        }
    } catch (error) {
        console.error('Error loading from GitHub:', error);
        showToast('Failed to load note from server', 'error');
    }
    
    // Force clear editor again before setting new content
    noteEditor.value = '';
    noteEditor.textContent = '';
    
    // Set the editor content (empty for new pins is normal)
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
        console.log(`PIN ${pin} is ready for new content`);
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
        const currentHostname = window.location.hostname;
        const currentProtocol = window.location.protocol;
        
        console.log('Current hostname:', currentHostname);
        console.log('Current protocol:', currentProtocol);
        
        const isLocal = currentProtocol === 'file:' || 
                       currentHostname === 'localhost' || 
                       currentHostname === '127.0.0.1';
        
        const isNetlifyBackend = currentHostname.includes('qnote-backend.netlify.app');
        
        let apiUrl;
        if (isNetlifyBackend && !isLocal) {
            // qnote-backend.netlify.app에서는 상대 경로 사용
            apiUrl = '/.netlify/functions/save-note';
        } else {
            // 다른 모든 환경(로컬, qnote.io 등)에서는 직접 백엔드 URL 사용
            // This will be replaced during deployment
            apiUrl = 'https://xru7u6nnfd.execute-api.ap-northeast-2.amazonaws.com/api/save-note';
        }
        
        console.log('Environment detection:');
        console.log('- isLocal:', isLocal);
        console.log('- isNetlifyBackend:', isNetlifyBackend);
        console.log('- Selected API URL:', apiUrl);
        
        // Call Netlify Function to save to GitHub
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                room: currentPin, // API still expects 'room' param
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
            window.lastSavedPin = currentPin; // Store the pin for recent check
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
    console.log('goToTitleScreen called');
    console.log('Current hash before clear:', window.location.hash);
    
    // Prevent recursive calls
    if (titleScreen.classList.contains('active')) {
        console.log('Already on title screen, skipping');
        return;
    }
    
    // Clear current pin data
    currentPin = '';
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
    
    // Show title screen BEFORE clearing URL to avoid triggering events
    noteScreen.classList.remove('active');
    titleScreen.classList.add('active');
    
    // Clear URL without triggering hashchange event
    if (window.location.hash) {
        // Use replaceState to avoid adding to history
        const newUrl = window.location.pathname + window.location.search;
        console.log('Clearing hash, new URL:', newUrl);
        history.replaceState(null, '', newUrl);
    }
    
    // Focus first input and restart animation after a small delay
    setTimeout(() => {
        if (pinInputs[0]) {
            pinInputs[0].focus();
        }
        startPlaceholderAnimation();
    }, 100);
}

// Share function using Web Share API or clipboard fallback
function shareNote() {
    console.log('Share button clicked');
    const shareUrl = `${window.location.origin}${window.location.pathname}#${currentPin}`;
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