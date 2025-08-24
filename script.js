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



// QR Code implementation with proper encoding
class QRCode {
    constructor() {
        this.size = 21; // Version 1
        this.modules = [];
        this.isFunction = [];
    }

    // Galois Field operations for Reed-Solomon
    static gfMul(a, b) {
        if (a === 0 || b === 0) return 0;
        return QRCode.gfExp[(QRCode.gfLog[a] + QRCode.gfLog[b]) % 255];
    }

    static gfDiv(a, b) {
        if (a === 0) return 0;
        if (b === 0) throw new Error('Division by zero');
        return QRCode.gfExp[(QRCode.gfLog[a] - QRCode.gfLog[b] + 255) % 255];
    }

    // Initialize Galois Field tables
    static initGF() {
        if (QRCode.gfExp) return;
        QRCode.gfExp = new Array(256);
        QRCode.gfLog = new Array(256);
        let x = 1;
        for (let i = 0; i < 255; i++) {
            QRCode.gfExp[i] = x;
            QRCode.gfLog[x] = i;
            x = (x * 2) ^ (x >= 128 ? 0x11d : 0);
        }
        QRCode.gfExp[255] = QRCode.gfExp[0];
    }

    // Reed-Solomon error correction - simplified
    static rsEncode(data, eccCount) {
        try {
            QRCode.initGF();
            const generator = QRCode.rsGeneratorPoly(eccCount);
            const result = [...data, ...new Array(eccCount).fill(0)];
            
            for (let i = 0; i < data.length; i++) {
                const coeff = result[i];
                if (coeff !== 0) {
                    for (let j = 0; j < generator.length; j++) {
                        if (i + j < result.length && j < generator.length) {
                            result[i + j] ^= QRCode.gfMul(generator[j], coeff);
                        }
                    }
                }
            }
            
            return result.slice(data.length);
        } catch (error) {
            console.error('Reed-Solomon error:', error);
            // Return simple ECC pattern as fallback
            return new Array(eccCount).fill(0).map((_, i) => i * 17 % 256);
        }
    }

    static rsGeneratorPoly(degree) {
        let result = [1];
        for (let i = 0; i < degree; i++) {
            const next = new Array(result.length + 1).fill(0);
            for (let j = 0; j < result.length; j++) {
                next[j] ^= result[j];
                next[j + 1] ^= QRCode.gfMul(result[j], QRCode.gfExp[i]);
            }
            result = next;
        }
        return result;
    }

    // Encode data - simplified version
    encodeData(text) {
        console.log('Encoding text:', text);
        
        // For URLs longer than 14 chars, just use first part
        if (text.length > 14) {
            text = text.substring(text.lastIndexOf('/') + 1) || text.substring(0, 14);
            console.log('Shortened text to:', text);
        }
        
        // Simple byte mode encoding
        const data = [];
        
        // Mode indicator (4 bits) - Byte mode = 0100
        data.push(0x4);
        
        // Character count (8 bits for Version 1)
        data.push(text.length);
        
        // Data
        for (let i = 0; i < text.length; i++) {
            data.push(text.charCodeAt(i));
        }
        
        // Terminator (4 bits of 0000)
        data.push(0);
        
        // Pad to 19 bytes (152 bits / 8)
        const padBytes = [0xEC, 0x11];
        let padIndex = 0;
        while (data.length < 19) {
            data.push(padBytes[padIndex % 2]);
            padIndex++;
        }
        
        console.log('Data before ECC:', data);
        
        try {
            // Add error correction
            const ecc = QRCode.rsEncode(data, 7); // 7 ECC bytes for Version 1-L
            const result = [...data, ...ecc];
            console.log('Final encoded data length:', result.length);
            return result;
        } catch (error) {
            console.error('Error in Reed-Solomon encoding:', error);
            // Return simple data without ECC as fallback
            return [...data, 0, 0, 0, 0, 0, 0, 0]; // 7 zero ECC bytes
        }
    }

    // Place function patterns
    setupFunctionPatterns() {
        this.modules = Array(this.size).fill().map(() => Array(this.size).fill(false));
        this.isFunction = Array(this.size).fill().map(() => Array(this.size).fill(false));
        
        // Finder patterns
        this.drawFinderPattern(0, 0);
        this.drawFinderPattern(0, this.size - 7);
        this.drawFinderPattern(this.size - 7, 0);
        
        // Separators
        this.drawSeparator(0, 0);
        this.drawSeparator(0, this.size - 7);
        this.drawSeparator(this.size - 7, 0);
        
        // Timing patterns
        for (let i = 8; i < this.size - 8; i++) {
            this.setModule(6, i, i % 2 === 0);
            this.setModule(i, 6, i % 2 === 0);
            this.isFunction[6][i] = true;
            this.isFunction[i][6] = true;
        }
        
        // Dark module
        this.setModule(4 * 1 + 9, 8, true);
        this.isFunction[4 * 1 + 9][8] = true;
    }

    drawFinderPattern(x, y) {
        for (let dy = -1; dy <= 7; dy++) {
            for (let dx = -1; dx <= 7; dx++) {
                const xx = x + dx;
                const yy = y + dy;
                if (xx >= 0 && xx < this.size && yy >= 0 && yy < this.size) {
                    const dist = Math.max(Math.abs(dx), Math.abs(dy));
                    this.setModule(xx, yy, dist !== 1 && dist !== 5);
                    this.isFunction[xx][yy] = true;
                }
            }
        }
    }

    drawSeparator(x, y) {
        for (let dy = -1; dy <= 7; dy++) {
            for (let dx = -1; dx <= 7; dx++) {
                const xx = x + dx;
                const yy = y + dy;
                if (xx >= 0 && xx < this.size && yy >= 0 && yy < this.size) {
                    const dist = Math.max(Math.abs(dx), Math.abs(dy));
                    if (dist === 7) {
                        this.setModule(xx, yy, false);
                        this.isFunction[xx][yy] = true;
                    }
                }
            }
        }
    }

    setModule(x, y, dark) {
        if (x >= 0 && x < this.size && y >= 0 && y < this.size) {
            this.modules[y][x] = dark;
        }
    }

    getModule(x, y) {
        return x >= 0 && x < this.size && y >= 0 && y < this.size && this.modules[y][x];
    }

    // Place data bits
    placeData(data) {
        let bitIndex = 0;
        const dataBits = [];
        
        // Convert bytes to bits
        for (const byte of data) {
            for (let i = 7; i >= 0; i--) {
                dataBits.push((byte >> i) & 1);
            }
        }
        
        // Place data in zigzag pattern
        for (let right = this.size - 1; right >= 1; right -= 2) {
            if (right === 6) right--; // Skip timing column
            
            for (let vert = 0; vert < this.size; vert++) {
                for (let j = 0; j < 2; j++) {
                    const x = right - j;
                    const upward = ((right + 1) & 2) === 0;
                    const y = upward ? this.size - 1 - vert : vert;
                    
                    if (!this.isFunction[y][x] && bitIndex < dataBits.length) {
                        this.modules[y][x] = dataBits[bitIndex] === 1;
                        bitIndex++;
                    }
                }
            }
        }
    }

    // Apply mask pattern
    applyMask(pattern) {
        for (let y = 0; y < this.size; y++) {
            for (let x = 0; x < this.size; x++) {
                if (!this.isFunction[y][x]) {
                    let invert = false;
                    switch (pattern) {
                        case 0: invert = (x + y) % 2 === 0; break;
                        case 1: invert = y % 2 === 0; break;
                        case 2: invert = x % 3 === 0; break;
                        case 3: invert = (x + y) % 3 === 0; break;
                        case 4: invert = (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0; break;
                        case 5: invert = (x * y) % 2 + (x * y) % 3 === 0; break;
                        case 6: invert = ((x * y) % 2 + (x * y) % 3) % 2 === 0; break;
                        case 7: invert = ((x + y) % 2 + (x * y) % 3) % 2 === 0; break;
                    }
                    if (invert) {
                        this.modules[y][x] = !this.modules[y][x];
                    }
                }
            }
        }
    }

    // Add format information
    addFormatInfo(errorCorrectionLevel, maskPattern) {
        const data = (errorCorrectionLevel << 3) | maskPattern;
        let rem = data;
        for (let i = 0; i < 10; i++) {
            rem = (rem << 1) ^ ((rem >> 9) * 0x537);
        }
        const formatBits = ((data << 10) | rem) ^ 0x5412;
        
        // Place format bits
        for (let i = 0; i <= 5; i++) {
            this.setModule(8, i, ((formatBits >> i) & 1) !== 0);
        }
        this.setModule(8, 7, ((formatBits >> 6) & 1) !== 0);
        this.setModule(8, 8, ((formatBits >> 7) & 1) !== 0);
        this.setModule(7, 8, ((formatBits >> 8) & 1) !== 0);
        for (let i = 9; i < 15; i++) {
            this.setModule(14 - i, 8, ((formatBits >> i) & 1) !== 0);
        }
        
        for (let i = 0; i < 8; i++) {
            this.setModule(this.size - 1 - i, 8, ((formatBits >> i) & 1) !== 0);
        }
        for (let i = 8; i < 15; i++) {
            this.setModule(8, this.size - 15 + i, ((formatBits >> i) & 1) !== 0);
        }
    }

    generate(text) {
        this.setupFunctionPatterns();
        const data = this.encodeData(text);
        this.placeData(data);
        this.applyMask(0); // Use mask pattern 0
        this.addFormatInfo(1, 0); // Error correction level L, mask pattern 0
        return this.modules;
    }
}

function generateQRCode() {
    const qrContainer = document.getElementById('qrcode');
    
    // Log detailed browser info
    console.log('=== QR Code Generation Debug ===');
    console.log('User Agent:', navigator.userAgent);
    console.log('Platform:', navigator.platform);
    console.log('Is iOS:', /iPad|iPhone|iPod/.test(navigator.userAgent));
    console.log('Is Android:', /Android/i.test(navigator.userAgent));
    console.log('Canvas support:', !!document.createElement('canvas').getContext);
    
    // Clear existing QR code
    qrContainer.innerHTML = '';
    
    const currentUrl = window.location.href;
    console.log('Generating real QR code for:', currentUrl);
    console.log('URL length:', currentUrl.length);
    
    // Force use new QR implementation for ALL browsers
    try {
        console.log('Starting QR code generation...');
        
        // Test canvas support first
        const testCanvas = document.createElement('canvas');
        const testCtx = testCanvas.getContext('2d');
        if (!testCtx) {
            throw new Error('Canvas context not available');
        }
        console.log('Canvas context available');
        
        // Generate QR code matrix
        console.log('Creating QRCode instance...');
        const qr = new QRCode();
        console.log('QRCode instance created');
        
        console.log('Generating matrix...');
        const matrix = qr.generate(currentUrl);
        console.log('Matrix generated, size:', matrix.length + 'x' + matrix[0].length);
        
        // Create canvas
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // Set canvas size (2px per module for 42x42 total)
        const moduleSize = 2;
        const canvasSize = matrix.length * moduleSize;
        canvas.width = canvasSize;
        canvas.height = canvasSize;
        console.log('Canvas size set to:', canvasSize + 'x' + canvasSize);
        
        // Draw QR code
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvasSize, canvasSize);
        
        ctx.fillStyle = '#000000';
        let blackModules = 0;
        for (let y = 0; y < matrix.length; y++) {
            for (let x = 0; x < matrix[y].length; x++) {
                if (matrix[y][x]) {
                    ctx.fillRect(x * moduleSize, y * moduleSize, moduleSize, moduleSize);
                    blackModules++;
                }
            }
        }
        console.log('Drew', blackModules, 'black modules');
        
        // Convert to image
        const img = new Image();
        
        // Force consistent styling for all platforms
        img.style.cssText = `
            width: 42px !important;
            height: 42px !important;
            display: block !important;
            background-color: white !important;
            border: none !important;
            outline: none !important;
            border-radius: 2px !important;
            image-rendering: pixelated !important;
            image-rendering: -moz-crisp-edges !important;
            image-rendering: crisp-edges !important;
            -webkit-touch-callout: none !important;
            -webkit-user-select: none !important;
            user-select: none !important;
            -webkit-tap-highlight-color: transparent !important;
            object-fit: contain !important;
            max-width: 42px !important;
            max-height: 42px !important;
        `;
        
        img.onload = function() {
            console.log('QR code image loaded successfully');
            console.log('Image natural size:', img.naturalWidth + 'x' + img.naturalHeight);
        };
        
        img.onerror = function(e) {
            console.error('QR code image failed to load:', e);
            showFallback();
        };
        
        console.log('Converting canvas to data URL...');
        const dataUrl = canvas.toDataURL('image/png');
        console.log('Data URL length:', dataUrl.length);
        console.log('Data URL prefix:', dataUrl.substring(0, 50));
        
        img.src = dataUrl;
        qrContainer.appendChild(img);
        
        console.log('QR code generation completed successfully');
        return; // Success - exit function
        
    } catch (error) {
        console.error('Error in QR code generation:', error);
        console.error('Error stack:', error.stack);
        showFallback();
    }
    
    function showFallback() {
        console.log('Showing fallback QR placeholder');
        qrContainer.innerHTML = '<div style="width:42px;height:42px;background:#f0f0f0;display:flex;align-items:center;justify-content:center;font-size:8px;border-radius:2px;color:#666;">QR</div>';
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