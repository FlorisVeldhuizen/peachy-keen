import * as THREE from 'three';

/**
 * Initialize the Three.js scene, camera, and renderer
 * @returns {Object} Object containing scene, camera, and renderer
 */
export function initScene() {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ antialias: true });

    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    document.body.appendChild(renderer.domElement);

    camera.position.z = 5;

    // Enable shadows and tone mapping for dramatic contrast
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.5;

    return { scene, camera, renderer };
}

/**
 * Setup window resize handler to keep canvas responsive
 * @param {THREE.Camera} camera - The camera
 * @param {THREE.Renderer} renderer - The renderer
 * @param {THREE.ShaderMaterial} backgroundMaterial - The background shader material
 */
export function setupResizeHandler(camera, renderer, backgroundMaterial) {
    if (!camera || !renderer || !backgroundMaterial) {
        console.error('setupResizeHandler: Missing required parameters');
        return;
    }
    
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
        backgroundMaterial.uniforms.resolution.value.set(window.innerWidth, window.innerHeight);
    });
}

