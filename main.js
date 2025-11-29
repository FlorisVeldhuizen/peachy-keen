import * as THREE from 'three';
import { loadSounds } from './audio.js';
import { createBackgroundMaterial } from './shaders.js';
import { loadPeachModel } from './peach.js';
import { setupLighting } from './lighting.js';
import { initInteraction, setPeachMesh, updatePeachPhysics } from './interaction.js';
import { initScene, setupResizeHandler } from './scene.js';

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

// Load the peach model
loadPeachModel(peachGroup, (meshes) => {
    setPeachMesh(meshes);
});

// Initialize interaction system
initInteraction(peachGroup, camera);

// Setup window resize handler
setupResizeHandler(camera, renderer, backgroundMaterial);

// Idle floating animation timer
let idleTime = 0;

// Animation loop
function animate() {
    requestAnimationFrame(animate);
    
    const delta = 0.016; // ~60fps
    idleTime += delta;
    
    // Update background shader
    backgroundMaterial.uniforms.time.value += delta;
    
    // Update peach physics and animation
    updatePeachPhysics(delta, idleTime);
    
    renderer.render(scene, camera);
}

animate();
