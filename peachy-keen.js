/**
 * Peachy Keen - Interactive 3D Peach Component
 * 
 * Main entry point for using Peachy Keen in other projects.
 * 
 * @example
 * import { createPeachyKeen } from './peachy-keen.js';
 * 
 * const peachy = createPeachyKeen({
 *   scene: myThreeScene,
 *   camera: myCamera,
 *   showLoadingUI: false // if you're handling loading yourself
 * });
 * 
 * // In your animation loop
 * peachy.update(deltaTime);
 */

import { Group, Clock } from 'three';
import { loadPeachModel } from './peach.js';
import { setupLighting } from './lighting.js';
import { initInteraction, setPeachMesh, updatePeachPhysics } from './interaction.js';
import { resumeAudioContext } from './audio.js';
import { PerformanceMonitor } from './performance.js';

/**
 * Create a new Peachy Keen instance
 * @param {Object} options - Configuration options
 * @param {THREE.Scene} options.scene - Three.js scene to add peach to
 * @param {THREE.Camera} options.camera - Three.js camera for interaction
 * @param {boolean} [options.showLoadingUI=true] - Show default loading UI
 * @param {Function} [options.onLoad] - Callback when peach is loaded
 * @param {Function} [options.onProgress] - Progress callback (percent, status)
 * @returns {Object} Peachy Keen instance with update() method
 */
export function createPeachyKeen(options = {}) {
    const {
        scene,
        camera,
        showLoadingUI = true,
        onLoad,
        onProgress
    } = options;

    if (!scene || !camera) {
        throw new Error('Peachy Keen requires a Three.js scene and camera');
    }

    // Create the peach group
    const peachGroup = new Group();
    scene.add(peachGroup);

    // Initialize performance monitor
    const perfMonitor = new PerformanceMonitor();
    perfMonitor.setScene(scene);

    // Setup lighting
    const { ringLights, otherLights } = setupLighting(scene);
    perfMonitor.setRingLights(ringLights);

    // Loading progress handling
    const updateProgress = (percent, status) => {
        if (onProgress) {
            onProgress(percent, status);
        }
        if (showLoadingUI) {
            const loadingProgress = document.getElementById('loading-progress');
            const loadingStatus = document.getElementById('loading-status');
            if (loadingProgress) loadingProgress.style.width = `${percent}%`;
            if (loadingStatus) loadingStatus.textContent = status;
        }
    };

    let isLoaded = false;
    let idleTime = 0;

    // Load the peach model
    updateProgress(50, 'Loading peach model...');
    loadPeachModel(peachGroup, (meshes) => {
        updateProgress(80, 'Preparing physics...');
        setPeachMesh(meshes);
        updateProgress(100, 'Ready!');
        
        isLoaded = true;
        if (onLoad) {
            onLoad();
        }

        if (showLoadingUI) {
            setTimeout(() => {
                const loadingItems = document.getElementById('loading-items');
                const soundOverlayContent = document.getElementById('sound-overlay-content');
                if (loadingItems) {
                    loadingItems.style.opacity = '0';
                    setTimeout(() => {
                        loadingItems.style.display = 'none';
                        if (soundOverlayContent) {
                            soundOverlayContent.style.display = 'block';
                        }
                    }, 300);
                }
            }, 300);
        }
    });

    // Initialize interaction system
    updateProgress(60, 'Setting up interactions...');
    initInteraction(peachGroup, camera, scene, perfMonitor);

    // Public API
    return {
        /**
         * Update the peach (call this in your animation loop)
         * @param {number} deltaTime - Time since last frame in seconds
         */
        update(deltaTime) {
            if (!isLoaded) return;

            idleTime += deltaTime;
            updatePeachPhysics(deltaTime, idleTime, perfMonitor);
            perfMonitor.update();
        },

        /**
         * Get the peach group (for positioning, scaling, etc.)
         * @returns {THREE.Group}
         */
        getGroup() {
            return peachGroup;
        },

        /**
         * Get the performance monitor
         * @returns {PerformanceMonitor}
         */
        getPerformanceMonitor() {
            return perfMonitor;
        },

        /**
         * Remove the peach from the scene
         */
        dispose() {
            scene.remove(peachGroup);
            // Clean up lights
            ringLights.forEach(light => scene.remove(light));
            otherLights.forEach(light => scene.remove(light));
        },

        /**
         * Resume audio context (call after user interaction)
         */
        async enableAudio() {
            await resumeAudioContext();
        },

        /**
         * Check if the peach is loaded
         * @returns {boolean}
         */
        isLoaded() {
            return isLoaded;
        }
    };
}

// Re-export utilities that might be useful
export { toggleOilEffect, isOiledState } from './peach.js';
export { PerformanceMonitor } from './performance.js';
export { resumeAudioContext } from './audio.js';



