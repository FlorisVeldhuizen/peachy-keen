/**
 * Hand Tracking Module
 * Uses MediaPipe Hands to track hand positions and detect slapping gestures
 */

import { Vector2, Vector3 } from 'three';

// Hand tracking state
const handState = {
    isEnabled: false,
    isInitialized: false,
    hands: null, // MediaPipe Hands instance
    camera: null, // Camera reference for screen-to-world conversion
    video: null,
    canvas: null,
    canvasCtx: null,
    previousHandPositions: new Map(), // Track previous positions for velocity calculation
    velocityHistory: new Map(), // Track velocity history for smoothing
    maxHistorySize: 5,
    lastSlapTime: 0,
    slapCooldown: 150, // ms between slaps - reduced for better responsiveness
    minSlapVelocity: 0.02, // Minimum velocity to trigger a slap (normalized screen space) - very low for easy detection
    slapCallback: null, // Callback to trigger when slap is detected
    handVisible: new Map(), // Track which hands are currently visible
    gestureState: new Map(), // Track gesture state per hand
    pinchThreshold: 0.06, // Distance threshold for pinch detection (normalized) - slightly higher for stability
    pinchReleaseThreshold: 0.08, // Higher threshold for releasing pinch (hysteresis to prevent flicker)
    lastClickTime: 0,
    clickCooldown: 500, // ms between clicks
    smoothedPinchDistance: 0, // Smoothed pinch distance to reduce jitter
    pinchSmoothingFactor: 0.4, // Smoothing for pinch detection
    lastCursorEmoji: '✋', // Track last cursor emoji to prevent flicker
    cursorEmojiChangeTime: 0, // Time of last cursor emoji change
    cursorEmojiDebounce: 100, // ms to wait before changing cursor emoji
    smoothedCursorPosition: { x: 0, y: 0 }, // Smoothed cursor position to reduce jitter
    smoothingFactor: 0.65, // Higher = more responsive, lower = smoother (0.5 = good balance)
    sensitivity: 1.6 // Multiplier for cursor range (>1 makes edges easier to reach)
};

/**
 * Create control panel for adjusting hand tracking settings
 */
function createControlPanel() {
    const panel = document.createElement('div');
    panel.id = 'hand-tracking-controls';
    panel.style.position = 'fixed';
    panel.style.bottom = '245px';
    panel.style.right = '0';
    panel.style.width = '320px';
    panel.style.background = 'rgba(0, 0, 0, 0.85)';
    panel.style.backdropFilter = 'blur(10px)';
    panel.style.border = '2px solid rgba(255, 105, 180, 0.5)';
    panel.style.borderRadius = '8px 8px 0 0';
    panel.style.padding = '12px';
    panel.style.color = 'white';
    panel.style.fontSize = '12px';
    panel.style.zIndex = '1000';
    panel.style.display = 'none';
    panel.style.fontFamily = 'Arial, sans-serif';

    panel.innerHTML = `
        <div style="margin-bottom: 10px; font-weight: bold; color: #ff69b4;">Hand Tracking Settings</div>

        <div style="margin-bottom: 12px;">
            <label style="display: block; margin-bottom: 4px;">
                Smoothness: <span id="smoothing-value">${handState.smoothingFactor}</span>
            </label>
            <input type="range" id="smoothing-slider" min="0.2" max="0.8" step="0.05" value="${handState.smoothingFactor}"
                   style="width: 100%; cursor: pointer;">
            <div style="font-size: 10px; color: #aaa; margin-top: 2px;">Lower = smoother, Higher = faster</div>
        </div>

        <div style="margin-bottom: 0;">
            <label style="display: block; margin-bottom: 4px;">
                Sensitivity: <span id="sensitivity-value">${handState.sensitivity}</span>
            </label>
            <input type="range" id="sensitivity-slider" min="1.0" max="1.8" step="0.1" value="${handState.sensitivity}"
                   style="width: 100%; cursor: pointer;">
            <div style="font-size: 10px; color: #aaa; margin-top: 2px;">Lower = more movement needed, Higher = easier edges</div>
        </div>
    `;

    document.body.appendChild(panel);

    // Add event listeners
    const smoothingSlider = document.getElementById('smoothing-slider');
    const smoothingValue = document.getElementById('smoothing-value');
    const sensitivitySlider = document.getElementById('sensitivity-slider');
    const sensitivityValue = document.getElementById('sensitivity-value');

    smoothingSlider.addEventListener('input', (e) => {
        const value = parseFloat(e.target.value);
        handState.smoothingFactor = value;
        smoothingValue.textContent = value.toFixed(2);
    });

    sensitivitySlider.addEventListener('input', (e) => {
        const value = parseFloat(e.target.value);
        handState.sensitivity = value;
        sensitivityValue.textContent = value.toFixed(1);
    });

    // Make sliders interactive elements
    smoothingSlider.classList.add('interactive-element');
    sensitivitySlider.classList.add('interactive-element');
}

/**
 * Initialize hand tracking with MediaPipe Hands
 * @param {THREE.Camera} camera - Three.js camera for coordinate conversion
 * @param {Function} onSlapDetected - Callback when slap gesture is detected (x, y, velocityX, velocityY)
 * @returns {Promise<boolean>} - Success status
 */
export async function initHandTracking(camera, onSlapDetected) {
    if (handState.isInitialized) {
        console.log('Hand tracking already initialized');
        return true;
    }

    handState.camera = camera;
    handState.slapCallback = onSlapDetected;

    try {
        // Create video element for webcam
        handState.video = document.createElement('video');
        handState.video.style.display = 'none';
        document.body.appendChild(handState.video);

        // Create canvas for visualization (optional) - positioned at bottom-right
        handState.canvas = document.createElement('canvas');
        handState.canvas.id = 'hand-tracking-canvas';
        handState.canvas.style.position = 'fixed';
        handState.canvas.style.bottom = '0'; // Bottom of screen
        handState.canvas.style.right = '0';
        handState.canvas.style.width = '320px';
        handState.canvas.style.height = '240px';
        handState.canvas.style.zIndex = '1000';
        handState.canvas.style.display = 'none'; // Hidden by default
        handState.canvas.style.border = '2px solid #ff69b4';
        handState.canvas.style.borderRadius = '8px';
        document.body.appendChild(handState.canvas);
        handState.canvasCtx = handState.canvas.getContext('2d');

        // Create control panel for adjusting hand tracking settings
        createControlPanel();

        handState.isInitialized = true;
        console.log('Hand tracking initialized');
        return true;
    } catch (error) {
        console.error('Failed to initialize hand tracking:', error);
        return false;
    }
}

/**
 * Start the webcam and hand tracking
 * @returns {Promise<boolean>} - Success status
 */
export async function startHandTracking() {
    if (!handState.isInitialized) {
        console.error('Hand tracking not initialized. Call initHandTracking first.');
        return false;
    }

    if (handState.isEnabled) {
        console.log('Hand tracking already running');
        return true;
    }

    try {
        // Request webcam access
        const stream = await navigator.mediaDevices.getUserMedia({
            video: {
                width: 640,
                height: 480,
                facingMode: 'user'
            }
        });

        handState.video.srcObject = stream;
        handState.video.play();

        // Wait for video metadata to load
        await new Promise((resolve) => {
            handState.video.onloadedmetadata = () => {
                handState.canvas.width = handState.video.videoWidth;
                handState.canvas.height = handState.video.videoHeight;
                resolve();
            };
        });

        console.log('Video metadata loaded, waiting for video data...');

        // Wait for video to have actual frame data
        await new Promise((resolve) => {
            const checkVideoReady = () => {
                if (handState.video.readyState >= handState.video.HAVE_CURRENT_DATA) {
                    console.log('Video has frame data, ready to process!');
                    resolve();
                } else {
                    console.log(`Video readyState: ${handState.video.readyState}, waiting...`);
                    setTimeout(checkVideoReady, 100);
                }
            };
            checkVideoReady();
        });

        // Initialize MediaPipe Hands
        console.log('Loading MediaPipe Hands library...');

        // Load MediaPipe Hands from CDN
        if (!window.Hands) {
            // Dynamically load the script
            await new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/hands.js';
                script.crossOrigin = 'anonymous';
                script.onload = resolve;
                script.onerror = reject;
                document.head.appendChild(script);
            });
        }

        console.log('MediaPipe Hands library loaded, initializing...');

        handState.hands = new window.Hands({
            locateFile: (file) => {
                return `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/${file}`;
            }
        });

        handState.hands.setOptions({
            maxNumHands: 2,
            modelComplexity: 1,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5
        });

        handState.hands.onResults(onHandsResults);

        // Enable hand tracking BEFORE starting the processing loop
        handState.isEnabled = true;

        // Set global flag so mouse doesn't override hand cursor
        window.isHandTrackingActive = true;

        // Change cursor style to indicate hand tracking mode
        const handCursor = document.getElementById('hand-cursor');
        if (handCursor) {
            handCursor.textContent = '✋'; // Open hand for hand tracking mode
            handCursor.style.transform = 'translate(-50%, -50%)'; // Center it
            handCursor.classList.add('hand-tracking-mode'); // Add glow effect
        }

        console.log('Starting video frame processing...');

        // Start processing video frames
        processVideoFrame();

        console.log('Hand tracking started successfully!');
        return true;
    } catch (error) {
        console.error('Failed to start hand tracking:', error);
        alert('Could not access webcam. Please grant camera permissions and try again.');
        return false;
    }
}

/**
 * Stop hand tracking and release webcam
 */
export function stopHandTracking() {
    if (!handState.isEnabled) return;

    // Stop video stream
    if (handState.video && handState.video.srcObject) {
        const tracks = handState.video.srcObject.getTracks();
        tracks.forEach(track => track.stop());
        handState.video.srcObject = null;
    }

    // Close MediaPipe Hands
    if (handState.hands) {
        handState.hands.close();
        handState.hands = null;
    }

    handState.isEnabled = false;
    handState.previousHandPositions.clear();
    handState.velocityHistory.clear();
    handState.handVisible.clear();
    handState.gestureState.clear();

    // Reset smoothed cursor position and pinch distance
    handState.smoothedCursorPosition = { x: 0, y: 0 };
    handState.smoothedPinchDistance = 0;

    // Reset cursor emoji tracking
    handState.lastCursorEmoji = '✋';
    handState.cursorEmojiChangeTime = 0;

    // Hide all hand tracking UI elements
    if (handState.canvas) {
        handState.canvas.style.display = 'none';
    }
    const controlPanel = document.getElementById('hand-tracking-controls');
    if (controlPanel) {
        controlPanel.style.display = 'none';
    }
    const handTrackingStatus = document.getElementById('hand-tracking-status');
    if (handTrackingStatus) {
        handTrackingStatus.style.display = 'none';
    }

    // Remove any lingering hover states from hand tracking
    const interactiveElements = document.querySelectorAll('.hand-hover');
    interactiveElements.forEach(element => {
        element.classList.remove('hand-hover');
    });

    // Reset global flag and cursor
    window.isHandTrackingActive = false;
    const handCursor = document.getElementById('hand-cursor');
    if (handCursor) {
        handCursor.textContent = '🤚'; // Back to normal hand
        handCursor.style.transform = 'translate(-50%, -15%)'; // Reset transform
        handCursor.classList.remove('hand-tracking-mode'); // Remove glow effect
    }

    console.log('Hand tracking stopped');
}

/**
 * Toggle hand tracking visualization
 * @param {boolean} show - Whether to show the debug canvas
 */
export function toggleVisualization(show) {
    if (handState.canvas) {
        handState.canvas.style.display = show ? 'block' : 'none';
    }
    const controlPanel = document.getElementById('hand-tracking-controls');
    if (controlPanel) {
        controlPanel.style.display = show ? 'block' : 'none';
    }
}

/**
 * Process video frame through MediaPipe
 */
async function processVideoFrame() {
    if (!handState.isEnabled || !handState.hands || !handState.video) {
        // Only log on first error to avoid spam
        if (!window.processVideoFrameErrorLogged) {
            console.error('processVideoFrame: Missing required state', {
                isEnabled: handState.isEnabled,
                hasHands: !!handState.hands,
                hasVideo: !!handState.video
            });
            window.processVideoFrameErrorLogged = true;
        }
        return;
    }

    try {
        // Video should be ready at this point
        await handState.hands.send({ image: handState.video });
    } catch (error) {
        console.error('Error processing video frame:', error);
    }

    // Continue processing frames
    if (handState.isEnabled) {
        requestAnimationFrame(processVideoFrame);
    }
}

/**
 * Update the hand tracking status display
 * @param {number} handCount - Number of hands detected
 */
function updateStatusDisplay(handCount) {
    const statusElement = document.getElementById('hand-tracking-status');
    const statusText = document.getElementById('hand-status-text');

    if (!statusElement || !statusText) return;

    if (handCount === 0) {
        statusText.textContent = '👋 Wave your hand!';
        statusElement.classList.remove('hands-detected');
    } else if (handCount === 1) {
        statusText.textContent = '✋ 1 hand detected';
        statusElement.classList.add('hands-detected');
    } else {
        statusText.textContent = `🙌 ${handCount} hands detected`;
        statusElement.classList.add('hands-detected');
    }
}

/**
 * Handle results from MediaPipe Hands
 * @param {Object} results - MediaPipe results containing detected hands
 */
function onHandsResults(results) {
    if (!handState.canvasCtx) {
        console.error('onHandsResults: No canvas context available');
        return;
    }

    // Log first few callbacks to verify it's working
    if (!window.handTrackingCallbackCount) {
        window.handTrackingCallbackCount = 0;
    }
    window.handTrackingCallbackCount++;

    if (window.handTrackingCallbackCount <= 5) {
        console.log(`onHandsResults callback #${window.handTrackingCallbackCount} - Hands detected: ${results.multiHandLandmarks?.length || 0}`);
    }

    // Clear canvas
    handState.canvasCtx.clearRect(0, 0, handState.canvas.width, handState.canvas.height);

    // Draw video frame (if visualization is enabled)
    if (handState.canvas.style.display !== 'none') {
        // Mirror the canvas for natural feedback
        handState.canvasCtx.save();
        handState.canvasCtx.scale(-1, 1);
        handState.canvasCtx.drawImage(results.image, -handState.canvas.width, 0, handState.canvas.width, handState.canvas.height);
        // Keep the mirrored state for drawing landmarks
    }

    // Track which hands are visible in this frame
    const currentVisibleHands = new Set();

    // Update status display
    const handCount = results.multiHandLandmarks ? results.multiHandLandmarks.length : 0;
    updateStatusDisplay(handCount);

    if (results.multiHandLandmarks && results.multiHandedness) {
        for (let i = 0; i < results.multiHandLandmarks.length; i++) {
            const landmarks = results.multiHandLandmarks[i];
            const handedness = results.multiHandedness[i].label; // "Left" or "Right"
            const handId = `${handedness}_${i}`;

            currentVisibleHands.add(handId);
            handState.handVisible.set(handId, true);

            // Draw hand landmarks (if visualization is enabled)
            // Draw while canvas is still mirrored
            if (handState.canvas.style.display !== 'none') {
                drawHandLandmarks(landmarks);
            }

            // Detect slapping gesture
            detectSlapGesture(landmarks, handId);

            // Detect pinch gesture for clicking (use first hand only)
            if (handId.includes('_0')) {
                detectPinchGesture(landmarks);
            }
        }
    }

    // Restore canvas state after drawing everything
    if (handState.canvas.style.display !== 'none') {
        handState.canvasCtx.restore();
    }

    // Clean up tracking data for hands that are no longer visible
    for (const [handId, visible] of handState.handVisible.entries()) {
        if (!currentVisibleHands.has(handId)) {
            handState.handVisible.delete(handId);
            handState.previousHandPositions.delete(handId);
            handState.velocityHistory.delete(handId);
            handState.gestureState.delete(handId);
        }
    }
}

/**
 * Draw hand landmarks on canvas
 * @param {Array} landmarks - Hand landmarks from MediaPipe
 */
function drawHandLandmarks(landmarks) {
    const ctx = handState.canvasCtx;

    // Draw connections
    ctx.strokeStyle = '#00ff00';
    ctx.lineWidth = 3;

    const connections = [
        [0, 1], [1, 2], [2, 3], [3, 4], // Thumb
        [0, 5], [5, 6], [6, 7], [7, 8], // Index
        [0, 9], [9, 10], [10, 11], [11, 12], // Middle
        [0, 13], [13, 14], [14, 15], [15, 16], // Ring
        [0, 17], [17, 18], [18, 19], [19, 20], // Pinky
        [5, 9], [9, 13], [13, 17] // Palm
    ];

    // Map landmarks to mirrored canvas coordinates
    // Video is drawn from -canvas.width to 0, so landmarks need to match
    for (const [start, end] of connections) {
        const startPoint = landmarks[start];
        const endPoint = landmarks[end];

        ctx.beginPath();
        ctx.moveTo(
            (startPoint.x - 1) * handState.canvas.width,
            startPoint.y * handState.canvas.height
        );
        ctx.lineTo(
            (endPoint.x - 1) * handState.canvas.width,
            endPoint.y * handState.canvas.height
        );
        ctx.stroke();
    }

    // Draw points
    ctx.fillStyle = '#ff0000';
    for (const landmark of landmarks) {
        ctx.beginPath();
        ctx.arc(
            (landmark.x - 1) * handState.canvas.width,
            landmark.y * handState.canvas.height,
            6,
            0,
            2 * Math.PI
        );
        ctx.fill();
    }
}

/**
 * Update cursor position based on hand position
 * @param {Vector2} position - Normalized hand position (0-1)
 */
function updateCursorPosition(position) {
    const handCursor = document.getElementById('hand-cursor');
    if (!handCursor) return;

    // Convert normalized coordinates to screen coordinates with sensitivity multiplier
    // This makes the edges easier to reach
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;

    // Calculate position from center with sensitivity
    // Invert X axis to mirror the webcam (feels more natural)
    let targetX = centerX + ((1 - position.x) - 0.5) * window.innerWidth * handState.sensitivity;
    let targetY = centerY + (position.y - 0.5) * window.innerHeight * handState.sensitivity;

    // Clamp to screen bounds
    targetX = Math.max(0, Math.min(window.innerWidth, targetX));
    targetY = Math.max(0, Math.min(window.innerHeight, targetY));

    // Initialize smoothed position on first run
    if (handState.smoothedCursorPosition.x === 0 && handState.smoothedCursorPosition.y === 0) {
        handState.smoothedCursorPosition.x = targetX;
        handState.smoothedCursorPosition.y = targetY;
    }

    // Apply exponential smoothing (lerp) to reduce jitter
    // smoothedPosition = smoothedPosition + (target - smoothedPosition) * smoothingFactor
    handState.smoothedCursorPosition.x += (targetX - handState.smoothedCursorPosition.x) * handState.smoothingFactor;
    handState.smoothedCursorPosition.y += (targetY - handState.smoothedCursorPosition.y) * handState.smoothingFactor;

    // Update cursor position with smoothed values
    handCursor.style.left = handState.smoothedCursorPosition.x + 'px';
    handCursor.style.top = handState.smoothedCursorPosition.y + 'px';

    // Check for interactive elements under the hand cursor (use smoothed position)
    simulateHoverOnInteractiveElements(handState.smoothedCursorPosition.x, handState.smoothedCursorPosition.y);
}

/**
 * Simulate hover effects on interactive elements
 * @param {number} x - Screen X position
 * @param {number} y - Screen Y position
 */
function simulateHoverOnInteractiveElements(x, y) {
    // Get all interactive elements
    const interactiveElements = document.querySelectorAll('.interactive-element, button, a');

    // Check which element is under the cursor
    let hoveredElement = null;
    interactiveElements.forEach(element => {
        const rect = element.getBoundingClientRect();
        if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
            hoveredElement = element;
        }
    });

    // Update hover state
    interactiveElements.forEach(element => {
        if (element === hoveredElement) {
            if (!element.classList.contains('hand-hover')) {
                element.classList.add('hand-hover');
                // Update hand cursor to pointing finger when over interactive element
                const handCursor = document.getElementById('hand-cursor');
                if (handCursor) {
                    handCursor.textContent = '👆';
                }
            }
        } else {
            element.classList.remove('hand-hover');
        }
    });

    // Reset cursor if not over any interactive element
    if (!hoveredElement) {
        const handCursor = document.getElementById('hand-cursor');
        if (handCursor && window.isHandTrackingActive && handCursor.textContent === '👆') {
            handCursor.textContent = '✋';
        }
    }
}

/**
 * Detect slapping gesture based on hand velocity
 * @param {Array} landmarks - Hand landmarks from MediaPipe
 * @param {string} handId - Unique identifier for this hand
 */
function detectSlapGesture(landmarks, handId) {
    // Use the palm center (landmark 9 - middle finger base) as reference point
    const palmCenter = landmarks[9];
    const currentPosition = new Vector2(palmCenter.x, palmCenter.y);

    // Update cursor to follow hand (use first hand only)
    if (handId.includes('_0')) {
        updateCursorPosition(currentPosition);
    }

    // Get previous position
    const previousPosition = handState.previousHandPositions.get(handId);

    if (previousPosition) {
        // Calculate velocity (change in position)
        const velocity = new Vector2(
            currentPosition.x - previousPosition.x,
            currentPosition.y - previousPosition.y
        );

        // Add to velocity history
        if (!handState.velocityHistory.has(handId)) {
            handState.velocityHistory.set(handId, []);
        }
        const history = handState.velocityHistory.get(handId);
        history.push(velocity.clone());

        if (history.length > handState.maxHistorySize) {
            history.shift();
        }

        // Calculate average velocity for smoothing
        const avgVelocity = new Vector2(0, 0);
        for (const vel of history) {
            avgVelocity.add(vel);
        }
        avgVelocity.divideScalar(history.length);

        // Calculate velocity magnitude
        const velocityMagnitude = avgVelocity.length();

        // Get or initialize per-hand cooldown tracking
        if (!handState.gestureState.has(handId)) {
            handState.gestureState.set(handId, {
                lastSlapTime: 0
            });
        }
        const gestureState = handState.gestureState.get(handId);

        // Debug: Log velocity for first hand only to avoid spam
        if (handId.includes('_0') && Math.random() < 0.05) { // Log 5% of frames
            console.log(`Hand velocity: ${velocityMagnitude.toFixed(4)}, threshold: ${handState.minSlapVelocity}`);
        }

        // New approach: Trigger slap immediately when fast movement is detected
        // This feels more responsive and natural
        if (velocityMagnitude > handState.minSlapVelocity) {
            const currentTime = Date.now();

            // Check cooldown per hand (allows both hands to slap independently)
            if (currentTime - gestureState.lastSlapTime > handState.slapCooldown) {
                // Trigger slap callback
                if (handState.slapCallback) {
                    // Convert normalized coordinates to screen coordinates
                    // Invert X axis to match cursor position
                    const screenX = (1 - currentPosition.x) * window.innerWidth;
                    const screenY = currentPosition.y * window.innerHeight;

                    console.log(`🔥 SLAP TRIGGERED! Position: (${screenX.toFixed(0)}, ${screenY.toFixed(0)}), Velocity: ${velocityMagnitude.toFixed(4)}`);

                    // Pass velocity in screen coordinates for realistic interaction
                    // Invert X velocity to match inverted X axis
                    handState.slapCallback(
                        screenX,
                        screenY,
                        -avgVelocity.x * window.innerWidth,
                        avgVelocity.y * window.innerHeight,
                        velocityMagnitude
                    );
                }

                gestureState.lastSlapTime = currentTime;
            }
        }
    }

    // Store current position for next frame
    handState.previousHandPositions.set(handId, currentPosition.clone());
}

/**
 * Detect pinch gesture (thumb and index finger together) for clicking
 * @param {Array} landmarks - Hand landmarks from MediaPipe
 */
function detectPinchGesture(landmarks) {
    // Get thumb tip (4) and index finger tip (8)
    const thumbTip = landmarks[4];
    const indexTip = landmarks[8];

    // Calculate distance between thumb and index finger
    const rawDistance = Math.sqrt(
        Math.pow(thumbTip.x - indexTip.x, 2) +
        Math.pow(thumbTip.y - indexTip.y, 2) +
        Math.pow(thumbTip.z - indexTip.z, 2)
    );

    // Initialize smoothed distance on first run
    if (handState.smoothedPinchDistance === 0) {
        handState.smoothedPinchDistance = rawDistance;
    }

    // Apply smoothing to reduce jitter
    handState.smoothedPinchDistance += (rawDistance - handState.smoothedPinchDistance) * handState.pinchSmoothingFactor;

    // Get or initialize pinch state
    if (!handState.gestureState.has('pinch')) {
        handState.gestureState.set('pinch', {
            isPinching: false,
            wasPinching: false
        });
    }
    const pinchState = handState.gestureState.get('pinch');

    // Detect pinch using smoothed distance with hysteresis to prevent flicker
    // Use different thresholds for entering vs exiting pinch state
    let isPinching;
    if (pinchState.isPinching) {
        // Already pinching - use higher threshold to release (prevents flicker)
        isPinching = handState.smoothedPinchDistance < handState.pinchReleaseThreshold;
    } else {
        // Not pinching - use lower threshold to enter
        isPinching = handState.smoothedPinchDistance < handState.pinchThreshold;
    }

    // Trigger click on pinch release (was pinching, now not)
    if (pinchState.wasPinching && !isPinching) {
        const currentTime = Date.now();
        if (currentTime - handState.lastClickTime > handState.clickCooldown) {
            // Get cursor position
            const handCursor = document.getElementById('hand-cursor');
            if (handCursor) {
                const cursorX = parseFloat(handCursor.style.left);
                const cursorY = parseFloat(handCursor.style.top);

                // Find element under cursor and click it
                simulateClick(cursorX, cursorY);

                console.log('🤏 PINCH CLICK!');
                handState.lastClickTime = currentTime;
            }
        }
    }

    // Update pinch state
    pinchState.wasPinching = isPinching;
    pinchState.isPinching = isPinching;

    // Visual feedback - change cursor when pinching (with debouncing to prevent flicker)
    const handCursor = document.getElementById('hand-cursor');
    if (handCursor && window.isHandTrackingActive) {
        const currentTime = Date.now();
        let desiredEmoji;

        if (isPinching) {
            desiredEmoji = '🤏';
        } else {
            // Reset to appropriate cursor
            const element = document.elementFromPoint(
                parseFloat(handCursor.style.left),
                parseFloat(handCursor.style.top)
            );
            if (element && (element.tagName === 'BUTTON' || element.classList.contains('interactive-element'))) {
                desiredEmoji = '👆';
            } else {
                desiredEmoji = '✋';
            }
        }

        // Only change emoji if it's different AND enough time has passed since last change
        if (desiredEmoji !== handState.lastCursorEmoji) {
            if (currentTime - handState.cursorEmojiChangeTime > handState.cursorEmojiDebounce) {
                handCursor.textContent = desiredEmoji;
                handState.lastCursorEmoji = desiredEmoji;
                handState.cursorEmojiChangeTime = currentTime;
            }
        } else {
            // Same emoji - update immediately (no flickering issue)
            handCursor.textContent = desiredEmoji;
        }
    }
}

/**
 * Simulate a click at the given coordinates
 * @param {number} x - Screen X position
 * @param {number} y - Screen Y position
 */
function simulateClick(x, y) {
    // Find the element at the given position
    const element = document.elementFromPoint(x, y);

    if (element) {
        console.log(`Clicking element: ${element.tagName} ${element.id || element.className}`);

        // Special handling for range sliders
        if (element.tagName === 'INPUT' && element.type === 'range') {
            handleSliderClick(element, x);
        } else {
            // Trigger click event for other elements
            element.click();
        }

        // No visual feedback flash in hand tracking mode - it's distracting
    }
}

/**
 * Handle slider interaction - set value based on cursor position
 * @param {HTMLInputElement} slider - The range input element
 * @param {number} cursorX - Cursor X position
 */
function handleSliderClick(slider, cursorX) {
    const rect = slider.getBoundingClientRect();
    const percentage = (cursorX - rect.left) / rect.width;
    const min = parseFloat(slider.min) || 0;
    const max = parseFloat(slider.max) || 100;
    const value = min + (max - min) * Math.max(0, Math.min(1, percentage));

    slider.value = value;

    // Trigger input event so the page responds to the change
    slider.dispatchEvent(new Event('input', { bubbles: true }));
    slider.dispatchEvent(new Event('change', { bubbles: true }));

    console.log(`Set slider value to ${value.toFixed(2)}`);
}

/**
 * Check if hand tracking is currently enabled
 * @returns {boolean}
 */
export function isHandTrackingEnabled() {
    return handState.isEnabled;
}

/**
 * Get current hand tracking state (for debugging)
 * @returns {Object}
 */
export function getHandTrackingState() {
    return {
        isEnabled: handState.isEnabled,
        isInitialized: handState.isInitialized,
        visibleHands: Array.from(handState.handVisible.keys())
    };
}
