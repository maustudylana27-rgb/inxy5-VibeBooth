// ============================
// GLOBAL VARIABLES
// ============================

let selectedPhotoIndex = null;
let currentFilterClass = "";
let currentBackground = null;
let currentBackgroundImage = null;
let availableBackgrounds = [];
let transparentAreas = []; // Store detected transparent areas
let currentCaptureAreaIndex = 0;
let isCapturing = false;

let MAX_PHOTOS = 7;

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

// Load backgrounds from JSON
async function loadAvailableBackgrounds() {
    try {
        const response = await fetch('backgrounds.json');
        const data = await response.json();
        if (data.backgrounds && data.backgrounds.length > 0) {
            availableBackgrounds = data.backgrounds;
            renderBackgroundButtons();
            // Set first background as default
            if (availableBackgrounds.length > 0) {
                changeBackground(availableBackgrounds[0].id);
            }
        }
    } catch (error) {
        console.error('Error loading backgrounds:', error);
    }
}

// Get background by ID
function getBackgroundById(id) {
    return availableBackgrounds.find(bg => bg.id === id);
}

// Detect transparent areas from background image
async function detectTransparentAreas(imagePath) {
    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;
            const transparentPixels = [];
            
            // Find all transparent pixels
            for (let i = 3; i < data.length; i += 4) {
                const alpha = data[i];
                if (alpha < 128) {
                    const pixelIndex = (i - 3) / 4;
                    const x = pixelIndex % canvas.width;
                    const y = Math.floor(pixelIndex / canvas.width);
                    transparentPixels.push({ x, y });
                }
            }
            
            // Group transparent pixels into clusters (areas)
            const areas = clusterTransparentPixels(transparentPixels, canvas.width, canvas.height);
            resolve(areas);
        };
        img.onerror = () => {
            console.error('Failed to load background image for analysis');
            resolve([]);
        };
        img.src = imagePath;
    });
}

// Cluster transparent pixels into separate areas
function clusterTransparentPixels(pixels, imgWidth, imgHeight) {
    if (pixels.length === 0) return [];
    
    const visited = new Set();
    const clusters = [];
    
    for (const pixel of pixels) {
        const key = `${pixel.x},${pixel.y}`;
        if (visited.has(key)) continue;
        
        const cluster = floodFill(pixels, pixel, visited, imgWidth, imgHeight);
        if (cluster.length > 100) { // Only consider clusters with significant size
            clusters.push(cluster);
        }
    }
    
    // Convert clusters to bounding boxes
    const boundingBoxes = clusters.map(cluster => {
        const xs = cluster.map(p => p.x);
        const ys = cluster.map(p => p.y);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);
        
        return {
            x: minX,
            y: minY,
            width: maxX - minX,
            height: maxY - minY,
            centerX: (minX + maxX) / 2,
            centerY: (minY + maxY) / 2
        };
    });
    
    return boundingBoxes;
}

// Simple flood fill to find connected transparent pixels
function floodFill(allPixels, startPixel, visited, width, height) {
    const cluster = [];
    const queue = [startPixel];
    const pixelMap = new Map();
    
    for (const pixel of allPixels) {
        pixelMap.set(`${pixel.x},${pixel.y}`, pixel);
    }
    
    while (queue.length > 0) {
        const pixel = queue.shift();
        const key = `${pixel.x},${pixel.y}`;
        
        if (visited.has(key)) continue;
        visited.add(key);
        cluster.push(pixel);
        
        // Check neighbors
        const neighbors = [
            { x: pixel.x + 1, y: pixel.y },
            { x: pixel.x - 1, y: pixel.y },
            { x: pixel.x, y: pixel.y + 1 },
            { x: pixel.x, y: pixel.y - 1 }
        ];
        
        for (const neighbor of neighbors) {
            const nKey = `${neighbor.x},${neighbor.y}`;
            if (!visited.has(nKey) && pixelMap.has(nKey)) {
                queue.push(neighbor);
            }
        }
    }
    
    return cluster;
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
    const cols = 1;
    const rows = Math.ceil(images.length / cols);
    const firstImage = images[0];
    const targetCellWidth = Math.min(900, firstImage.naturalWidth || 800);
    const targetCellHeight = Math.round(targetCellWidth * (firstImage.naturalHeight / firstImage.naturalWidth));
    const canvas = document.createElement('canvas');
    canvas.width = cols * targetCellWidth;
    canvas.height = rows * targetCellHeight;
    const ctx = canvas.getContext('2d');
    
    // Photos already contain background from capture process, so draw them directly
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

// Initialize drawing canvas with proper dimensions after container is ready
function initializeDrawingCanvas() {
    if (!cameraContainer) return;
    const rect = cameraContainer.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    
    // Set canvas to match container dimensions (now square)
    drawingCanvas.width = Math.round(rect.width);
    drawingCanvas.height = Math.round(rect.height);
    drawingCanvas.style.width = '100%';
    drawingCanvas.style.height = '100%';
}

// Call on app start
function startApp(mode) {

    landing.classList.add("hidden");

    app.classList.remove("hidden");

    gsap.from("#app", {
        opacity: 0,
        y: 30,
        duration: 1
    });

    initializeDrawingCanvas();
    startCamera();
    resizeDrawingCanvas();

    // Load backgrounds from JSON
    loadAvailableBackgrounds();

    // Ensure capture is enabled when app starts
    const captureButton = document.querySelector('.camera-btn');
    if (captureButton) captureButton.disabled = false;
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
    
    // Reposition video when resizing
    if (transparentAreas.length > 0) {
        positionVideoInTransparentArea(0);
    }
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
    "filter-absurd": "contrast(2.0) saturate(1.5) blur(10px)",

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
        countdown.style.visibility = 'visible';
        const interval = setInterval(() => {
            count -= 1;
            if (count <= 0) {
                clearInterval(interval);
                countdown.style.opacity = '0';
                countdown.style.visibility = 'hidden';
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
    if (isCapturing) {
        return;
    }

    if(capturedPhotos.length >= MAX_PHOTOS) {
        alert(
            "Maaf sesi potret photo anda telah max. Hapus salah satu atau ulangi photo untuk melanjutkan 😭"
        );
        return;
    }

    isCapturing = true;
    const captureButton = document.querySelector('.camera-btn');
    if (captureButton) captureButton.disabled = true;

    try {
        if(timerSeconds && timerSeconds > 0) {
            await runCountdown(timerSeconds);
            if(flashEnabled) flashEffect();
            await takePhoto();
        } else {
            if(flashEnabled) flashEffect();
            await takePhoto();
        }
    } finally {
        isCapturing = false;
        if (captureButton) captureButton.disabled = false;
    }
}

function takePhoto() {
    return new Promise((resolve, reject) => {
        const captureCanvas = document.createElement("canvas");
        const captureCtx = captureCanvas.getContext("2d");

        // Use container dimensions to match display exactly
        const containerRect = cameraContainer.getBoundingClientRect();
        const size = Math.round(containerRect.width);
        
        captureCanvas.width = size;
        captureCanvas.height = size;

        if (captureCanvas.width === 0 || captureCanvas.height === 0) {
            alert('Kamera belum siap, coba lagi sebentar.');
            reject(new Error('Camera not ready'));
            return;
        }

        // Draw background image first
        if (currentBackgroundImage) {
            const bgImg = new Image();
            bgImg.onload = () => {
                // Draw background with proper scaling
                captureCtx.drawImage(bgImg, 0, 0, size, size);
                
                // Draw video and other elements on top
                drawVideoAndElements(captureCanvas, captureCtx, size).then(resolve).catch(reject);
            };
            bgImg.onerror = reject;
            bgImg.src = currentBackgroundImage;
        } else {
            drawVideoAndElements(captureCanvas, captureCtx, size).then(resolve).catch(reject);
        }
    });
}

function drawVideoAndElements(captureCanvas, captureCtx, size) {
    return new Promise((resolve, reject) => {
        const containerRect = cameraContainer.getBoundingClientRect();
        
        captureCtx.filter = FILTER_STYLES[currentFilterClass] || getComputedStyle(video).filter || "none";
        
        // Draw video from transparent area
        if (transparentAreas.length > 0) {
            const area = transparentAreas[currentCaptureAreaIndex] || transparentAreas[0];
            
            // Get background image dimensions
            const bgImg = new Image();
            bgImg.onload = () => {
                const imgAspect = bgImg.naturalWidth / bgImg.naturalHeight;
                const containerAspect = size / size;
                
                let scaleX, scaleY, offsetX = 0, offsetY = 0;
                
                if (imgAspect > containerAspect) {
                    scaleY = size / bgImg.naturalHeight;
                    scaleX = scaleY;
                    offsetX = (size - bgImg.naturalWidth * scaleX) / 2;
                } else {
                    scaleX = size / bgImg.naturalWidth;
                    scaleY = scaleX;
                    offsetY = (size - bgImg.naturalHeight * scaleY) / 2;
                }
                
                // Calculate video position and size in canvas
                const videoX = area.x * scaleX + offsetX;
                const videoY = area.y * scaleY + offsetY;
                const videoWidth = area.width * scaleX;
                const videoHeight = area.height * scaleY;
                
                // Draw video with flip
                captureCtx.save();
                captureCtx.translate(videoX + videoWidth, videoY);
                captureCtx.scale(-1, 1);
                captureCtx.drawImage(video, 0, 0, videoWidth, videoHeight);
                captureCtx.restore();
                
                // Draw drawing canvas overlay
                if (drawingCanvas.width > 0 && drawingCanvas.height > 0) {
                    captureCtx.drawImage(drawingCanvas, videoX, videoY, videoWidth, videoHeight);
                }
                
                // Draw stickers
                drawStickersOnCapture(captureCanvas, captureCtx, containerRect, size);
                
                finalizeCapturedPhoto(captureCanvas);
                resolve();
            };
            bgImg.onerror = reject;
            bgImg.src = currentBackgroundImage;
        } else {
            // Fallback: draw video normally without background
            const videoAspect = video.videoWidth / video.videoHeight;
            let drawWidth = size;
            let drawHeight = size;
            let drawX = 0;
            let drawY = 0;
            
            if (videoAspect > 1) {
                drawHeight = Math.round(size / videoAspect);
                drawY = (size - drawHeight) / 2;
            } else {
                drawWidth = Math.round(size * videoAspect);
                drawX = (size - drawWidth) / 2;
            }
            
            captureCtx.drawImage(video, drawX, drawY, drawWidth, drawHeight);
            
            if (drawingCanvas.width > 0 && drawingCanvas.height > 0) {
                captureCtx.drawImage(drawingCanvas, 0, 0, size, size);
            }
            
            drawStickersOnCapture(captureCanvas, captureCtx, cameraContainer.getBoundingClientRect(), size);
            finalizeCapturedPhoto(captureCanvas);
            resolve();
        }
    });
}

function drawStickersOnCapture(captureCanvas, captureCtx, containerRect, size) {
    const wrapperElements = cameraContainer.querySelectorAll('.sticker-wrapper');
    const scaleX = 1;
    const scaleY = 1;

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
}

function finalizeCapturedPhoto(captureCanvas) {
    const image = captureCanvas.toDataURL("image/png");
    capturedPhotos.push(image);
    renderPhotoStrip();

    // Advance to next transparent capture area
    currentCaptureAreaIndex = Math.min(capturedPhotos.length, transparentAreas.length - 1);
    if (transparentAreas.length > 0) {
        positionVideoInTransparentArea(currentCaptureAreaIndex);
    }

    const captureButton = document.querySelector('.camera-btn');
    if (captureButton) {
        captureButton.disabled = capturedPhotos.length >= MAX_PHOTOS;
    }
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

async function changeBackground(bgId) {
    currentBackground = bgId;
    const background = getBackgroundById(bgId);
    
    if (background) {
        currentBackgroundImage = background.path;
        
        // Detect transparent areas
        transparentAreas = await detectTransparentAreas(background.path);
        
        // Set MAX_PHOTOS based on number of transparent areas, fallback to 7
        if (transparentAreas.length > 0) {
            MAX_PHOTOS = transparentAreas.length;
        } else {
            MAX_PHOTOS = 7; // Default fallback
        }
        
        // Set background image for camera container
        cameraContainer.style.backgroundImage = `url('${background.path}')`;
        cameraContainer.style.backgroundSize = 'cover';
        cameraContainer.style.backgroundPosition = 'center';
        cameraContainer.style.backgroundAttachment = 'fixed';
        
        // Set background for photo strip
        const photoStrip = document.getElementById('photoStripContainer');
        if(photoStrip) {
            photoStrip.style.backgroundImage = `url('${background.path}')`;
            photoStrip.style.backgroundSize = 'cover';
            photoStrip.style.backgroundPosition = 'center';
            photoStrip.style.backgroundBlendMode = 'overlay';
        }
        
        // Reset capture area index and position camera feed
        currentCaptureAreaIndex = Math.min(capturedPhotos.length, transparentAreas.length - 1);
        if (transparentAreas.length > 0) {
            positionVideoInTransparentArea(currentCaptureAreaIndex);
        } else {
            // Reset to default fullscreen positioning
            video.style.position = 'relative';
            video.style.left = 'auto';
            video.style.top = 'auto';
            video.style.width = '100%';
            video.style.height = '100%';
        }
    }
    
    updateBackgroundButtons(bgId);
}

// Position video element in transparent area
function positionVideoInTransparentArea(areaIndex) {
    if (areaIndex >= transparentAreas.length) return;
    currentCaptureAreaIndex = areaIndex;
    
    const area = transparentAreas[areaIndex];
    const containerRect = cameraContainer.getBoundingClientRect();
    
    // Calculate scale factor from image to container display size
    const displayWidth = containerRect.width;
    const displayHeight = containerRect.height;
    
    // Assume background is displayed as cover, calculate actual visible dimensions
    const backgroundImg = new Image();
    backgroundImg.onload = () => {
        const imgAspect = backgroundImg.naturalWidth / backgroundImg.naturalHeight;
        const containerAspect = displayWidth / displayHeight;
        
        let scaleX, scaleY, offsetX = 0, offsetY = 0;
        
        if (imgAspect > containerAspect) {
            // Image is wider, crop sides
            scaleY = displayHeight / backgroundImg.naturalHeight;
            scaleX = scaleY;
            offsetX = (displayWidth - backgroundImg.naturalWidth * scaleX) / 2;
        } else {
            // Image is taller, crop top/bottom
            scaleX = displayWidth / backgroundImg.naturalWidth;
            scaleY = scaleX;
            offsetY = (displayHeight - backgroundImg.naturalHeight * scaleY) / 2;
        }
        
        // Position and size video
        const videoX = area.x * scaleX + offsetX;
        const videoY = area.y * scaleY + offsetY;
        const videoWidth = area.width * scaleX;
        const videoHeight = area.height * scaleY;
        
        video.style.position = 'absolute';
        video.style.left = videoX + 'px';
        video.style.top = videoY + 'px';
        video.style.width = videoWidth + 'px';
        video.style.height = videoHeight + 'px';
        video.style.objectFit = 'cover';
        video.style.borderRadius = '0px';
    };
    backgroundImg.src = currentBackgroundImage;
}

function updateBackgroundButtons(bgId) {
    document.querySelectorAll('.background-btn').forEach(btn => {
        if(btn.dataset.bg === bgId) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
}

// Render background buttons dynamically
function renderBackgroundButtons() {
    const backgroundsContainer = document.getElementById('backgroundsContainer');
    if (!backgroundsContainer) return;
    
    backgroundsContainer.innerHTML = '';
    
    availableBackgrounds.forEach(bg => {
        const button = document.createElement('button');
        button.className = 'background-btn';
        button.dataset.bg = bg.id;
        button.title = bg.name;
        button.onclick = () => changeBackground(bg.id);
        
        const thumbnail = document.createElement('img');
        thumbnail.className = 'background-thumb';
        thumbnail.src = bg.thumbnail;
        thumbnail.alt = bg.name;
        
        button.appendChild(thumbnail);
        backgroundsContainer.appendChild(button);
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

// Remove hardcoded dimensions - they will be set by initializeDrawingCanvas()

drawingCanvas.addEventListener('pointerdown', (e) => {
    if (!drawEnabled) return;
    e.preventDefault();
    drawing = true;
    hasDrawings = false;
    const rect = drawingCanvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    ctx.beginPath();
    ctx.lineWidth = 6;
    ctx.lineCap = "round";
    ctx.strokeStyle = drawColor;
    ctx.shadowBlur = 10;
    ctx.shadowColor = drawColor;
    ctx.moveTo(x, y);
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y);
    if (e.pointerId !== undefined && drawingCanvas.setPointerCapture) {
        drawingCanvas.setPointerCapture(e.pointerId);
    }
});

drawingCanvas.addEventListener('pointerup', (e) => {
    if (e.pointerId !== undefined && drawingCanvas.releasePointerCapture) {
        try { drawingCanvas.releasePointerCapture(e.pointerId); } catch (err) {}
    }
    finishDrawing();
});

drawingCanvas.addEventListener('pointercancel', (e) => {
    if (e.pointerId !== undefined && drawingCanvas.releasePointerCapture) {
        try { drawingCanvas.releasePointerCapture(e.pointerId); } catch (err) {}
    }
    finishDrawing();
});

drawingCanvas.addEventListener('pointerleave', (e) => {
    if (!drawing) return;
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