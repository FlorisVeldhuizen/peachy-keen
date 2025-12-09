import { Group, PlaneGeometry, Mesh, Clock } from 'three';
import { createBackgroundMaterial, createGradientBackgroundMaterial } from './shaders.js';
import { loadPeachModel } from './peach.js';
import { setupLighting } from './lighting.js';
import { initInteraction, setPeachMesh, updatePeachPhysics, processHandSlap } from './interaction.js';
import { initScene, setupResizeHandler } from './scene.js';
import { resumeAudioContext } from './audio.js';
import { PerformanceMonitor } from './performance.js';
import { initHandTracking, startHandTracking, stopHandTracking, toggleVisualization, isHandTrackingEnabled } from './handTracking.js';

// Audio is now lazy-loaded on first interaction for better performance

// Loading screen management
const soundOverlay = document.getElementById('sound-overlay');
const loadingProgress = document.getElementById('loading-progress');
const loadingStatus = document.getElementById('loading-status');
const loadingItems = document.getElementById('loading-items');
const soundOverlayContent = document.getElementById('sound-overlay-content');
let loadingComplete = false;
let hasStarted = false;

function updateLoadingProgress(percent, status = 'Loading...') {
    if (loadingProgress) {
        loadingProgress.style.width = `${percent}%`;
    }
    if (loadingStatus) {
        loadingStatus.textContent = status;
    }
}

function showStartButton() {
    // Hide loading items
    if (loadingItems) {
        loadingItems.style.opacity = '0';
        setTimeout(() => {
            loadingItems.style.display = 'none';
            // Show click to start message
            if (soundOverlayContent) {
                soundOverlayContent.style.display = 'block';
            }
        }, 300);
    }
}

function hideLoadingScreen() {
    if (soundOverlay && loadingComplete && hasStarted) {
        soundOverlay.style.opacity = '0';
        setTimeout(() => {
            soundOverlay.style.display = 'none';
        }, 300);
    }
}

// Handle click anywhere on sound overlay to start
if (soundOverlay) {
    soundOverlay.addEventListener('click', async (event) => {
        if (!loadingComplete || hasStarted) return;
        
        // Stop event from propagating to prevent triggering peach smack
        event.stopPropagation();
        event.preventDefault();
        
        hasStarted = true;
        
        // Resume audio context (required by browsers)
        await resumeAudioContext();
        
        // Hide loading screen
        hideLoadingScreen();
    });
}

// Initialize scene, camera, and renderer
updateLoadingProgress(10, 'Initializing...');
const { scene, camera, renderer } = initScene();

// Initialize performance monitor
const perfMonitor = new PerformanceMonitor();
perfMonitor.setRenderer(renderer);
perfMonitor.setScene(scene);

updateLoadingProgress(20, 'Creating background...');

// Create both background materials
const animatedBackgroundMaterial = createBackgroundMaterial();
const gradientBackgroundMaterial = createGradientBackgroundMaterial();
const backgroundGeometry = new PlaneGeometry(2, 2);

// Start with the animated background
const background = new Mesh(backgroundGeometry, animatedBackgroundMaterial);
scene.add(background);

// Set reference for performance monitoring
perfMonitor.setBackgroundMesh(background);
perfMonitor.setBackgroundMaterials(animatedBackgroundMaterial, gradientBackgroundMaterial);

// Create the peach group
const peachGroup = new Group();
scene.add(peachGroup);

// Setup lighting
updateLoadingProgress(40, 'Setting up lights...');
const { ringLights, otherLights } = setupLighting(scene);

// Set ring lights reference for performance monitoring
perfMonitor.setRingLights(ringLights);

// Load the peach model
updateLoadingProgress(50, 'Loading peach model...');
loadPeachModel(peachGroup, (meshes) => {
    updateLoadingProgress(80, 'Preparing physics...');
    setPeachMesh(meshes);
    updateLoadingProgress(100, 'Ready!');
    
    // Show start button once model is loaded
    setTimeout(() => {
        loadingComplete = true;
        showStartButton();
    }, 300);
});

// Initialize interaction system
updateLoadingProgress(60, 'Setting up interactions...');
initInteraction(peachGroup, camera, scene, perfMonitor);

// Initialize hand tracking (but don't start it yet)
initHandTracking(camera, (screenX, screenY, velocityX, velocityY, peakVelocity) => {
    // Callback when hand slap is detected
    processHandSlap(screenX, screenY, velocityX, velocityY, peakVelocity);
});

// Function to toggle hand tracking (used by button and keyboard)
async function toggleHandTracking() {
    if (isHandTrackingEnabled()) {
        stopHandTracking();
        if (handTrackingButton) {
            handTrackingButton.textContent = '👋 Enable Hand Tracking (ESC)';
            handTrackingButton.classList.remove('active');
        }
        if (visualizationButton) {
            visualizationButton.style.display = 'none';
        }
        if (handTrackingStatus) {
            handTrackingStatus.style.display = 'none';
        }
    } else {
        const success = await startHandTracking();
        if (success) {
            if (handTrackingButton) {
                handTrackingButton.textContent = '👋 Disable Hand Tracking (ESC)';
                handTrackingButton.classList.add('active');
            }
            // Show visualization button when hand tracking is enabled
            if (visualizationButton) {
                visualizationButton.style.display = 'block';
            }
            // Show status indicator
            if (handTrackingStatus) {
                handTrackingStatus.style.display = 'block';
            }
            // Auto-enable visualization for debugging
            toggleVisualization(true);
            if (visualizationButton) {
                visualizationButton.classList.add('active');
            }
        }
    }
}

// Setup hand tracking button
const handTrackingButton = document.getElementById('hand-tracking-button');
const visualizationButton = document.getElementById('visualization-button');
const handTrackingStatus = document.getElementById('hand-tracking-status');

if (handTrackingButton) {
    handTrackingButton.addEventListener('click', toggleHandTracking);
    handTrackingButton.textContent = '👋 Enable Hand Tracking (ESC)';
    // Add interactive class for cursor handling
    handTrackingButton.classList.add('interactive-element');
}

// Keyboard shortcut: ESC to toggle hand tracking
window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
        event.preventDefault();
        toggleHandTracking();
    }
});

// Setup visualization toggle (for debugging)
if (visualizationButton) {
    visualizationButton.addEventListener('click', () => {
        const isVisible = document.getElementById('hand-tracking-canvas').style.display !== 'none';
        toggleVisualization(!isVisible);
        visualizationButton.classList.toggle('active');
    });

    visualizationButton.classList.add('interactive-element');
}

// Setup window resize handler
updateLoadingProgress(70, 'Finalizing...');
setupResizeHandler(camera, renderer, animatedBackgroundMaterial, gradientBackgroundMaterial);

// Animation loop with clock for accurate timing
const clock = new Clock();

// Idle floating animation timer
let idleTime = 0;

// Animation loop
function animate() {
    requestAnimationFrame(animate);
    
    // Use clock for accurate delta time (capped to avoid large jumps)
    const delta = Math.min(clock.getDelta(), 0.1);
    idleTime += delta;
    
    // Update background shader (only if enabled)
    if (perfMonitor.isFeatureEnabled('backgroundShader')) {
        animatedBackgroundMaterial.uniforms.time.value += delta;
    }
    
    // Update peach physics and animation
    // Pass performance monitor to check if physics is enabled
    updatePeachPhysics(delta, idleTime, perfMonitor);
    
    // Update performance monitor
    perfMonitor.update();
    
    renderer.render(scene, camera);
}

animate();
