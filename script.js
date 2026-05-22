// ============================
// GLOBAL VARIABLES
// ============================

let selectedPhotoIndex = null;
let currentFilterClass = "";
let currentBackground = "bg1";

const MAX_PHOTOS = 7;

const landing = document.getElementById("landing");
const app = document.getElementById("app");

const video = document.getElementById("cameraFeed");

const drawingCanvas =
document.getElementById("drawingCanvas");

const ctx =
drawingCanvas.getContext("2d");

const countdown =
document.getElementById("countdown");

const flashOverlay =
document.getElementById("flashOverlay");

const photoStripContainer =
document.getElementById("photoStripContainer");

const cameraContainer =
document.getElementById("cameraContainer");

let capturedPhotos = [];

let isFlipped = true;

let drawing = false;

let drawEnabled = false;
let drawColor = '#ff4fd8';
let drawPaletteTimer = null;
let drawLongPress = false;

drawingCanvas.style.pointerEvents = "none";

let currentUser = getCurrentUser ? getCurrentUser() : null;
let currentAuthType = "login";
const authModal = document.getElementById("authModal");
const authTitle = document.getElementById("authTitle");
const authSubtitle = document.getElementById("authSubtitle");
const authSubmitBtn = document.getElementById("authSubmitBtn");
const authSwitchText = document.getElementById("authSwitchText");
const authSwitchBtn = document.getElementById("authSwitchBtn");
const authEmail = document.getElementById("authEmail");
const authPassword = document.getElementById("authPassword");

// ============================
// PHOTBOOTH SETTINGS
// ============================
let timerSeconds = 0; // 0 = off
let flashEnabled = true;
let gridVisible = false;

const gridOverlay = document.getElementById("gridOverlay");
const flashToggleBtn = document.getElementById("flashToggleBtn");
const gridToggleBtn = document.getElementById("gridToggleBtn");

function setTimer(sec){
    timerSeconds = Number(sec) || 0;
    // update button styles
    document.querySelectorAll('.timer-btn').forEach(btn => {
        if(Number(btn.innerText.replace('s','')) === timerSeconds) {
            btn.classList.add('active');
        } else if(timerSeconds === 0 && btn.innerText.trim() === 'Off'){
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
}

function toggleFlash(){
    flashEnabled = !flashEnabled;
    if(flashToggleBtn) flashToggleBtn.innerText = `Flash: ${flashEnabled ? 'On' : 'Off'}`;
}

function toggleGrid(){
    gridVisible = !gridVisible;
    if(gridOverlay) gridOverlay.classList.toggle('hidden', !gridVisible);
    if(gridToggleBtn) gridToggleBtn.innerText = `Grid: ${gridVisible ? 'On' : 'Off'}`;
}

function downloadAllPhotos(){
    if(!capturedPhotos.length){
        alert('No photos to download.');
        return;
    }
    createMergedPhoto().then((mergedDataUrl) => {
        const link = document.createElement('a');
        link.href = mergedDataUrl;
        link.download = `vibebooth-collage.png`;
        document.body.appendChild(link);
        link.click();
        link.remove();
    }).catch((error) => {
        console.error(error);
        alert('Failed to create merged photo.');
    });
}

function getBackgroundGradientColors(bg) {
    const gradients = {
        bg1: ['#ff9a9e', '#fad0c4'],
        bg2: ['#00c6ff', '#0072ff'],
        bg3: ['#8e2de2', '#4a00e0'],
        bg4: ['#f7971e', '#ffd200'],
        bg5: ['#56ab2f', '#a8e063'],
        bg6: ['#cb2d3e', '#ef473a'],
        bg7: ['#2193b0', '#6dd5ed'],
        bg8: ['#ffffff', '#cccccc'],
        bg9: ['#c084fc', '#f5d0fe'],
        bg10: ['#34d399', '#a7f3d0'],
        bg11: ['#fb7185', '#fef3c7'],
        bg12: ['#0f172a', '#334155'],
        bg13: ['#facc15', '#f43f5e'],
        bg14: ['#0d9488', '#1e3a8a']
    };

    return gradients[bg] || gradients.bg1;
}

function loadImage(url) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = url;
    });
}

async function createMergedPhoto() {
    const images = await Promise.all(capturedPhotos.map(src => loadImage(src)));
    const cols = Math.min(3, images.length);
    const rows = Math.ceil(images.length / cols);
    const firstImage = images[0];
    const targetCellWidth = Math.min(900, firstImage.naturalWidth || 800);
    const targetCellHeight = Math.round(targetCellWidth * (firstImage.naturalHeight / firstImage.naturalWidth));
    const canvas = document.createElement('canvas');
    canvas.width = cols * targetCellWidth;
    canvas.height = rows * targetCellHeight;
    const ctx = canvas.getContext('2d');
    const [startColor, endColor] = getBackgroundGradientColors(currentBackground);
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, startColor);
    gradient.addColorStop(1, endColor);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    images.forEach((img, index) => {
        const x = (index % cols) * targetCellWidth;
        const y = Math.floor(index / cols) * targetCellHeight;
        ctx.drawImage(img, x, y, targetCellWidth, targetCellHeight);
    });

    return canvas.toDataURL('image/png');
}

// ============================
// AUTH STORAGE
// ============================

function validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

// ============================
// AUTH
// ============================

function showAuth(type) {

    currentAuthType = type;

    if (!authModal) return;

    authModal.classList.add("active");

    if (type === "signup") {
        authTitle.innerText = "Create your account";
        authSubtitle.innerText = "Sign up and begin your VibeBooth journey.";
        authSubmitBtn.innerText = "Sign Up";
        authSwitchText.innerText = "Already have an account?";
        authSwitchBtn.innerText = "Login";
    } else {
        authTitle.innerText = "Welcome back";
        authSubtitle.innerText = "Login to access your VibeBooth session.";
        authSubmitBtn.innerText = "Login";
        authSwitchText.innerText = "Don't have an account?";
        authSwitchBtn.innerText = "Sign Up";
    }

    authEmail.value = "";
    authPassword.value = "";
}

function toggleAuthType() {
    showAuth(currentAuthType === "login" ? "signup" : "login");
}

function closeAuth(event) {
    if (event && event.target !== event.currentTarget) return;
    if (!authModal) return;
    authModal.classList.remove("active");
}

function submitAuth() {
    const email = authEmail.value.trim();
    const password = authPassword.value.trim();

    if (!validateEmail(email)) {
        alert("Please enter a valid email address.");
        return;
    }

    if (password.length < 6) {
        alert("Password must be at least 6 characters long.");
        return;
    }

    const accounts = getStoredAccounts();

    if (currentAuthType === "signup") {
        if (accounts[email]) {
            alert("This email is already registered. Please log in instead.");
            return;
        }

        accounts[email] = { password };
        saveStoredAccounts(accounts);
        setCurrentUser(email);
        currentUser = email;

        alert("Sign up successful! Welcome to VibeBooth.");
        closeAuth();
        startApp();
        return;
    }

    if (!accounts[email]) {
        alert("No account found with this email. Please sign up first.");
        return;
    }

    if (accounts[email].password !== password) {
        alert("Incorrect password. Please try again.");
        return;
    }

    setCurrentUser(email);
    currentUser = email;

    alert("Login successful! Redirecting to VibeBooth.");
    closeAuth();
    startApp();
}


// ============================
// START APP
// ============================

function startApp(mode) {

    landing.classList.add("hidden");

    app.classList.remove("hidden");

    gsap.from("#app", {
        opacity: 0,
        y: 30,
        duration: 1
    });

    startCamera();
    resizeDrawingCanvas();

    // set a default pleasant background for photobooth
    changeBackground('bg1');
}

function resizeDrawingCanvas() {
    if (!cameraContainer) return;
    const rect = cameraContainer.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = drawingCanvas.width;
    tempCanvas.height = drawingCanvas.height;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.drawImage(drawingCanvas, 0, 0);

    drawingCanvas.width = Math.round(rect.width);
    drawingCanvas.height = Math.round(rect.height);
    drawingCanvas.style.width = '100%';
    drawingCanvas.style.height = '100%';
    ctx.drawImage(tempCanvas, 0, 0, drawingCanvas.width, drawingCanvas.height);
}


// ============================
// START CAMERA
// ============================

async function startCamera() {

    try {

        const stream =
        await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false
        });

        video.srcObject = stream;
        video.addEventListener('loadedmetadata', resizeDrawingCanvas);
        window.addEventListener('resize', resizeDrawingCanvas);

    } catch(error) {

        console.error(error);

        alert("Camera access denied 😭");
    }
}


// ============================
// APPLY FILTER
// ============================

const FILTER_STYLES = {
    "filter-retro": "sepia(0.4) contrast(1.1) brightness(0.9) hue-rotate(-20deg)",
    "filter-cyber": "hue-rotate(90deg) saturate(1.5) contrast(1.2) drop-shadow(0 0 5px #0ff)",
    "filter-kawaii": "brightness(1.1) saturate(1.2) contrast(0.9)",
    "filter-bw": "grayscale(1) contrast(1.5)",
    "filter-dreamy": "brightness(1.2) contrast(0.8) blur(0.5px)",
    "filter-anime": "saturate(1.4) contrast(1.1)",
    "filter-vhs": "hue-rotate(180deg) saturate(0.8) blur(1px)",
    "filter-absurd": "contrast(2.0) saturate(1.5) blur(3px)",
};

function applyFilter(filterClass) {

    currentFilterClass = filterClass;

    const preview =
    document.getElementById("selectedPreview");

    if(preview) {

        preview.className =
        `
        absolute
        inset-0
        w-full
        h-full
        object-cover
        z-10
        ${filterClass}
        `;

    } else {

        video.className =
        `
        w-full
        h-full
        object-cover
        ${filterClass}
        `;
    }
}


// ============================
// FLIP CAMERA
// ============================

function flipCamera() {

    isFlipped = !isFlipped;

    if(isFlipped) {

        video.style.transform =
        "scaleX(-1)";

    } else {

        video.style.transform =
        "scaleX(1)";
    }
}

function flashEffect() {
    if (!flashOverlay) return;
    flashOverlay.style.transition = 'none';
    flashOverlay.style.opacity = '0.8';
    setTimeout(() => {
        flashOverlay.style.transition = 'opacity 0.4s ease';
        flashOverlay.style.opacity = '0';
    }, 50);
}

function runCountdown(seconds) {
    if (!countdown) return Promise.resolve();
    return new Promise((resolve) => {
        let count = seconds;
        countdown.innerText = count;
        countdown.style.opacity = '1';
        const interval = setInterval(() => {
            count -= 1;
            if (count <= 0) {
                clearInterval(interval);
                countdown.style.opacity = '0';
                resolve();
                return;
            }
            countdown.innerText = count;
        }, 1000);
    });
}


// ============================
// TAKE SINGLE PHOTO
// ============================

async function takeSinglePhoto() {
    if(capturedPhotos.length >= MAX_PHOTOS) {
        alert(
            "Maaf sesi potret photo anda telah max. Hapus salah satu atau ulangi photo untuk melanjutkan 😭"
        );
        return;
    }

    if(timerSeconds && timerSeconds > 0) {
        await runCountdown(timerSeconds);
        if(flashEnabled) flashEffect();
        takePhoto();
    } else {
        if(flashEnabled) flashEffect();
        takePhoto();
    }
}

function takePhoto() {
    const captureCanvas = document.createElement("canvas");
    const captureCtx = captureCanvas.getContext("2d");

    captureCanvas.width = video.videoWidth || cameraContainer.clientWidth;
    captureCanvas.height = video.videoHeight || cameraContainer.clientHeight;

    if (captureCanvas.width === 0 || captureCanvas.height === 0) {
        alert('Kamera belum siap, coba lagi sebentar.');
        return;
    }

    captureCtx.filter = FILTER_STYLES[currentFilterClass] || getComputedStyle(video).filter || "none";
    captureCtx.drawImage(video, 0, 0, captureCanvas.width, captureCanvas.height);

    const wrapperElements = cameraContainer.querySelectorAll('.sticker-wrapper');
    const containerRect = cameraContainer.getBoundingClientRect();
    const scaleX = captureCanvas.width / containerRect.width;
    const scaleY = captureCanvas.height / containerRect.height;

    wrapperElements.forEach((wrapper) => {
        if (wrapper.dataset.include === 'false') return;
        const sticker = wrapper.querySelector('.cute-sticker');
        if (!sticker) return;

        const wrapperRect = wrapper.getBoundingClientRect();
        const width = sticker.offsetWidth * Number(wrapper.dataset.scale || 1) * scaleX;
        const height = sticker.offsetHeight * Number(wrapper.dataset.scale || 1) * scaleY;
        const centerX = (wrapperRect.left + wrapperRect.right) / 2 - containerRect.left;
        const centerY = (wrapperRect.top + wrapperRect.bottom) / 2 - containerRect.top;
        const x = centerX * scaleX;
        const y = centerY * scaleY;
        const rotation = Number(wrapper.dataset.rotate || 0) * Math.PI / 180;

        captureCtx.save();
        captureCtx.translate(x, y);
        captureCtx.rotate(rotation);
        if (sticker.tagName === 'IMG') {
            captureCtx.drawImage(sticker, -width / 2, -height / 2, width, height);
        } else {
            const fontSize = Math.max(12, sticker.offsetHeight * Number(wrapper.dataset.scale || 1) * scaleY * 0.8);
            captureCtx.font = `${fontSize}px serif`;
            captureCtx.fillStyle = '#fff';
            captureCtx.textAlign = 'center';
            captureCtx.textBaseline = 'middle';
            captureCtx.fillText(sticker.innerText || '', 0, 0);
        }
        captureCtx.restore();
    });

    if (drawingCanvas.width > 0 && drawingCanvas.height > 0) {
        captureCtx.drawImage(drawingCanvas, 0, 0, captureCanvas.width, captureCanvas.height);
    }

    const image = captureCanvas.toDataURL("image/png");
    capturedPhotos.push(image);
    renderPhotoStrip();
}

function createStickerWrapper(content) {
    const wrapper = document.createElement('div');
    wrapper.className = 'sticker-wrapper';
    wrapper.style.left = '50%';
    wrapper.style.top = '50%';
    wrapper.dataset.x = 0;
    wrapper.dataset.y = 0;
    wrapper.dataset.scale = 1;
    wrapper.dataset.rotate = 0;
    wrapper.dataset.include = 'true';

    const toolbar = document.createElement('div');
    toolbar.className = 'sticker-toolbar';

    const delBtn = document.createElement('button');
    delBtn.innerText = '✕';
    delBtn.title = 'Delete sticker';
    toolbar.appendChild(delBtn);

    const lockBtn = document.createElement('button');
    lockBtn.innerText = '🔒';
    lockBtn.title = 'Toggle capture include';
    toolbar.appendChild(lockBtn);

    const handle = document.createElement('div');
    handle.className = 'sticker-handle';
    handle.innerText = '↻';

    content.classList.add('cute-sticker');
    content.style.transformOrigin = 'center center';

    wrapper.appendChild(toolbar);
    wrapper.appendChild(content);
    wrapper.appendChild(handle);
    cameraContainer.appendChild(wrapper);

    function applyTransform() {
        const x = Number(wrapper.dataset.x) || 0;
        const y = Number(wrapper.dataset.y) || 0;
        const s = Number(wrapper.dataset.scale) || 1;
        const r = Number(wrapper.dataset.rotate) || 0;
        wrapper.style.transform = `translate(-50%, -50%) translate(${x}px, ${y}px) scale(${s}) rotate(${r}deg)`;
    }

    applyTransform();

    const activePointers = new Map();
    let startX = 0;
    let startY = 0;
    let initialDistance = 0;
    let initialAngle = 0;
    let initialScale = 1;
    let initialRotate = 0;
    let isHandleGesture = false;

    const getDistance = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);
    const getAngle = (a, b) => Math.atan2(b.y - a.y, b.x - a.x);

    function updateTransformFromPointers() {
        if (activePointers.size === 1) {
            const pointer = [...activePointers.values()][0];
            if (isHandleGesture) {
                const dx = pointer.x - startX;
                const dy = pointer.y - startY;
                wrapper.dataset.rotate = Number(initialRotate || 0) + dx * 0.5;
                wrapper.dataset.scale = Math.max(0.2, initialScale + dy * -0.003);
                applyTransform();
                return;
            }
            const dx = pointer.x - startX;
            const dy = pointer.y - startY;
            wrapper.dataset.x = Number(wrapper.dataset.x || 0) + dx;
            wrapper.dataset.y = Number(wrapper.dataset.y || 0) + dy;
            startX = pointer.x;
            startY = pointer.y;
            applyTransform();
            return;
        }

        if (activePointers.size === 2) {
            const [p1, p2] = [...activePointers.values()];
            const currentDistance = getDistance(p1, p2);
            const currentAngle = getAngle(p1, p2);
            const scaleFactor = currentDistance / initialDistance;
            const angleDiff = currentAngle - initialAngle;
            wrapper.dataset.scale = Math.max(0.2, initialScale * scaleFactor);
            wrapper.dataset.rotate = Number(initialRotate || 0) + angleDiff * 180 / Math.PI;
            applyTransform();
        }
    }

    wrapper.addEventListener('pointerdown', (e) => {
        if (e.target === delBtn || e.target === lockBtn) return;
        wrapper.setPointerCapture(e.pointerId);
        activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

        if (activePointers.size === 1) {
            startX = e.clientX;
            startY = e.clientY;
            isHandleGesture = e.target === handle;
            initialScale = Number(wrapper.dataset.scale || 1);
            initialRotate = Number(wrapper.dataset.rotate || 0);
        }

        if (activePointers.size === 2) {
            const [p1, p2] = [...activePointers.values()];
            initialDistance = getDistance(p1, p2);
            initialAngle = getAngle(p1, p2);
            initialScale = Number(wrapper.dataset.scale || 1);
            initialRotate = Number(wrapper.dataset.rotate || 0);
        }
    });

    wrapper.addEventListener('pointermove', (e) => {
        if (!activePointers.has(e.pointerId)) return;
        activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (activePointers.size > 0) {
            updateTransformFromPointers();
        }
    });

    wrapper.addEventListener('pointerup', (e) => {
        activePointers.delete(e.pointerId);
        try { wrapper.releasePointerCapture(e.pointerId); } catch (err) {}
        if (activePointers.size === 1) {
            const remaining = [...activePointers.values()][0];
            startX = remaining.x;
            startY = remaining.y;
        }
        if (activePointers.size === 0) {
            isHandleGesture = false;
        }
    });

    delBtn.addEventListener('click', () => wrapper.remove());
    lockBtn.addEventListener('click', () => {
        const included = wrapper.dataset.include === 'true';
        wrapper.dataset.include = included ? 'false' : 'true';
        lockBtn.innerText = included ? '🔓' : '🔒';
        wrapper.style.opacity = included ? '1' : '0.6';
    });

    return wrapper;
}

function addSticker(emoji, className) {
    const sticker = document.createElement('div');
    sticker.className = className;
    sticker.innerText = emoji;
    sticker.style.position = 'absolute';
    sticker.style.left = '0';
    sticker.style.top = '0';
    sticker.style.fontSize = '70px';
    return createStickerWrapper(sticker);
}

function convertDrawingToSticker() {
    const data = drawingCanvas.toDataURL('image/png');
    const img = document.createElement('img');
    img.src = data;
    img.style.position = 'absolute';
    img.style.left = '0';
    img.style.top = '0';
    img.style.width = '220px';
    img.style.height = 'auto';
    const wrapper = createStickerWrapper(img);
    wrapper.style.opacity = '0';
    wrapper.style.transition = 'opacity 0.2s ease';
    img.onload = () => {
        wrapper.style.opacity = '1';
    };
    return wrapper;
}

// ============================
// RENDER PHOTO STRIP
// ============================

function renderPhotoStrip() {

    photoStripContainer.innerHTML = "";

    let imageSize = "";

    if(capturedPhotos.length <= 3) {

        imageSize = "h-48";

    } else if(capturedPhotos.length <= 5) {

        imageSize = "h-32";

    } else {

        imageSize = "h-24";
    }

    capturedPhotos.forEach((photo, index) => {

        const wrapper =
        document.createElement("div");

        wrapper.className =
        "relative group";



        // IMAGE

        const img =
        document.createElement("img");

        img.src = photo;

        img.className =
        `
        ${imageSize}
        w-full
        object-cover
        rounded-2xl
        border
        border-white/10
        cursor-pointer
        `;



        // CLICK PHOTO

        img.onclick = () => {

            selectedPhotoIndex = index;

            clearDrawing();

            showSelectedPhoto(photo);
        };



        // DELETE BUTTON

        const deleteBtn =
        document.createElement("button");

        deleteBtn.innerHTML = "✕";

        deleteBtn.className =
        `
        absolute
        top-2
        right-2
        w-7
        h-7
        rounded-full
        bg-red-500
        text-white
        font-bold
        opacity-0
        group-hover:opacity-100
        transition
        `;

        deleteBtn.onclick = () => {

            capturedPhotos.splice(index, 1);

            renderPhotoStrip();
        };



        wrapper.appendChild(img);

        wrapper.appendChild(deleteBtn);

        photoStripContainer.appendChild(wrapper);

    });
}


// ============================
// SHOW SELECTED PHOTO
// ============================

function showSelectedPhoto(photo) {

    video.style.display = "none";

    let preview =
    document.getElementById("selectedPreview");

    if(!preview) {

        preview =
        document.createElement("img");

        preview.id = "selectedPreview";

        preview.className =
        `
        absolute
        inset-0
        w-full
        h-full
        object-cover
        z-10
        `;

        cameraContainer
        .appendChild(preview);
    }

    preview.src = photo;
}


// ============================
// BACK TO CAMERA
// ============================

function backToCamera() {

    video.style.display = "block";

    const preview =
    document.getElementById("selectedPreview");

    if(preview) {

        preview.remove();
    }

    selectedPhotoIndex = null;
}


// ============================
// CHANGE BACKGROUND
// ============================

function changeBackground(bg) {

    const backgrounds = {

        bg1:
        "linear-gradient(to bottom, #ff9a9e, #fad0c4)",

        bg2:
        "linear-gradient(to bottom, #00c6ff, #0072ff)",

        bg3:
        "linear-gradient(to bottom, #8e2de2, #4a00e0)",

        bg4:
        "linear-gradient(to bottom, #f7971e, #ffd200)",

        bg5:
        "linear-gradient(to bottom, #56ab2f, #a8e063)",

        bg6:
        "linear-gradient(to bottom, #cb2d3e, #ef473a)",

        bg7:
        "linear-gradient(to bottom, #2193b0, #6dd5ed)",

        bg8:
        "linear-gradient(to bottom, #ffffff, #cccccc)",

        bg9:
        "linear-gradient(to bottom, #c084fc, #f5d0fe)",

        bg10:
        "linear-gradient(to bottom, #34d399, #a7f3d0)",

        bg11:
        "linear-gradient(to bottom, #fb7185, #fef3c7)",

        bg12:
        "linear-gradient(to bottom, #0f172a, #334155)",

        bg13:
        "linear-gradient(to bottom, #facc15, #f43f5e)",

        bg14:
        "linear-gradient(to bottom, #0d9488, #1e3a8a)"
    };

    currentBackground = bg;

    const selectedBackground = backgrounds[bg] || backgrounds.bg1;

    cameraContainer.style.background = selectedBackground;

    const photoStrip = document.getElementById('photoStripContainer');
    if(photoStrip) {
        photoStrip.style.backgroundImage = `${selectedBackground}, linear-gradient(rgba(0,0,0,0.22), rgba(0,0,0,0.22))`;
        photoStrip.style.backgroundBlendMode = 'overlay';
    }

    updateBackgroundButtons(bg);
}

function updateBackgroundButtons(bg) {
    document.querySelectorAll('.background-btn').forEach(btn => {
        if(btn.dataset.bg === bg) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
}


// ============================
// CLEAR DRAWING
// ============================

function clearDrawing() {

    ctx.clearRect(
        0,
        0,
        drawingCanvas.width,
        drawingCanvas.height
    );
}


// ============================
// TOGGLE DRAW
// ============================

function startDrawPaletteTimer() {
    if (drawPaletteTimer) clearTimeout(drawPaletteTimer);
    drawPaletteTimer = setTimeout(() => {
        drawLongPress = true;
        const palette = document.getElementById('drawPalette');
        if (palette) palette.classList.remove('hidden');
    }, 700);
}

function cancelDrawPaletteTimer() {
    if (drawPaletteTimer) {
        clearTimeout(drawPaletteTimer);
        drawPaletteTimer = null;
    }
}

function handleDrawToggleClick(event) {
    if (drawLongPress) {
        drawLongPress = false;
        return;
    }
    const button = event.currentTarget;
    if (drawEnabled) {
        const palette = document.getElementById('drawPalette');
        if (palette) {
            palette.classList.toggle('hidden');
        }
        return;
    }
    toggleDraw(button);
}

function hideDrawPalette() {
    const palette = document.getElementById('drawPalette');
    if (palette) palette.classList.add('hidden');
}

function pickDrawColor(color) {
    drawColor = color;
    const button = document.getElementById('drawToggleBtn');
    if (button) {
        button.style.boxShadow = `0 0 0 3px ${color}55`;
    }
    hideDrawPalette();
}

function toggleDraw(button) {

    drawEnabled = !drawEnabled;
    hideDrawPalette();

    if(drawEnabled) {

        drawingCanvas.style.pointerEvents = "auto";
        button.classList.add('active');

    } else {

        drawingCanvas.style.pointerEvents = "none";
        button.classList.remove('active');
    }
}


// ============================
// DRAW SYSTEM
// ============================

drawingCanvas.width = 700;

drawingCanvas.height = 900;

drawingCanvas.addEventListener('pointerdown', (e) => {
    if (!drawEnabled) return;
    drawing = true;
    hasDrawings = false;
    const rect = drawingCanvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    ctx.beginPath();
    ctx.moveTo(x, y);
});

drawingCanvas.addEventListener('pointerup', () => {
    finishDrawing();
});

drawingCanvas.addEventListener('pointerleave', () => {
    finishDrawing();
});

function finishDrawing() {
    if (!drawing) return;
    drawing = false;
    ctx.closePath();
}

drawingCanvas.addEventListener('pointermove', draw);

function hasCanvasContent() {
    if (drawingCanvas.width === 0 || drawingCanvas.height === 0) return false;
    const imageData = ctx.getImageData(0, 0, drawingCanvas.width, drawingCanvas.height);
    return Array.from(imageData.data).some(value => value !== 0);
}

function convertDrawingToStickerButton() {
    if (!hasCanvasContent()) {
        alert('Please draw on the canvas first before converting to a sticker.');
        return;
    }

    const wrapper = convertDrawingToSticker();
    if (wrapper) {
        clearDrawing();
    }
}

function getCanvasCoords(e) {
    const rect = drawingCanvas.getBoundingClientRect();
    return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
    };
}

function draw(e) {
    if(!drawing) return;

    const { x, y } = getCanvasCoords(e);

    ctx.lineWidth = 6;
    ctx.lineCap = "round";
    ctx.strokeStyle = drawColor;
    ctx.shadowBlur = 10;
    ctx.shadowColor = drawColor;

    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y);
}


// ============================
// DOWNLOAD
// ============================

function downloadPhotos() {

    if(capturedPhotos.length === 0) {

        alert("No photos 😭");

        return;
    }

    const link =
    document.createElement("a");

    link.href =
    capturedPhotos[0];

    link.download =
    "vibebooth-photo.png";

    link.click();
}


// ============================
// PARTICLES
// ============================

function createParticles() {

    const container =
    document.getElementById(
    "particleContainer"
    );

    for(let i = 0; i < 30; i++) {

        const particle =
        document.createElement("div");

        particle.classList.add(
        "particle"
        );

        const size =
        Math.random() * 6 + 2;

        particle.style.width =
        size + "px";

        particle.style.height =
        size + "px";

        particle.style.left =
        Math.random() * 100 + "%";

        particle.style.animationDuration =
        (Math.random() * 10 + 5)
        + "s";

        particle.style.animationDelay =
        Math.random() * 5
        + "s";

        container.appendChild(
        particle
        );
    }
}

createParticles();
// initialize timer UI
setTimer(0);