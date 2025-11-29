import * as THREE from 'three';
import { loadSounds, resumeAudioContext } from './audio.js';
import { createBackgroundMaterial } from './shaders.js';
import { loadPeachModel } from './peach.js';
import { setupLighting } from './lighting.js';
import { initInteraction, setPeachMesh, updatePeachPhysics } from './interaction.js';
import { initScene, setupResizeHandler } from './scene.js';

// Constants
const TARGET_FPS = 60;
const FIXED_DELTA = 1 / TARGET_FPS;

// Setup sound overlay
const soundOverlay = document.getElementById('sound-overlay');
if (soundOverlay) {
    const handleSoundEnable = async () => {
        // Resume audio context
        await resumeAudioContext();
        
        // Hide overlay with fade out
        soundOverlay.classList.add('hidden');
        
        // Remove element after transition
        setTimeout(() => {
            soundOverlay.remove();
        }, 300);
        
        // Remove event listeners
        soundOverlay.removeEventListener('click', handleSoundEnable);
        soundOverlay.removeEventListener('touchstart', handleSoundEnable);
    };
    
    // Add event listeners for both click and touch
    soundOverlay.addEventListener('click', handleSoundEnable);
    soundOverlay.addEventListener('touchstart', handleSoundEnable, { passive: true });
}

// Initialize audio
loadSounds();

// Initialize scene, camera, and renderer
const { scene, camera, renderer } = initScene();

// Create and add background
const backgroundMaterial = createBackgroundMaterial();
const backgroundGeometry = new THREE.PlaneGeometry(2, 2);
const background = new THREE.Mesh(backgroundGeometry, backgroundMaterial);
scene.add(background);

// Create the peach group
const peachGroup = new THREE.Group();
scene.add(peachGroup);

// Setup lighting
setupLighting(scene);

// Initialize interaction system (pass scene for particle effects)
initInteraction(peachGroup, camera, scene);

// Load the peach model
loadPeachModel(peachGroup, (meshes) => {
    setPeachMesh(meshes);
});

// Setup window resize handler
setupResizeHandler(camera, renderer, backgroundMaterial);

// Animation loop with clock for accurate timing
const clock = new THREE.Clock();
let idleTime = 0;

function animate() {
    requestAnimationFrame(animate);
    
    // Use clock for accurate delta time (capped to avoid large jumps)
    const delta = Math.min(clock.getDelta(), 0.1);
    idleTime += delta;
    
    // Update background shader
    backgroundMaterial.uniforms.time.value += delta;
    
    // Update peach physics and animation
    updatePeachPhysics(delta, idleTime);
    
    renderer.render(scene, camera);
}

animate();
