import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// Audio context for sound effects
const audioContext = new (window.AudioContext || window.webkitAudioContext)();

// Load slap sound effects
const slapSounds = [];
const slapSoundPaths = [
    '/assets/Slap sound effect 1.mp3',
    '/assets/Slap sound effect 2.mp3',
    '/assets/Slap sound effect 3.mp3'
];

// Load all sound files
async function loadSounds() {
    for (let i = 0; i < slapSoundPaths.length; i++) {
        try {
            const response = await fetch(slapSoundPaths[i]);
            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
            slapSounds.push(audioBuffer);
            console.log(`✅ Loaded sound ${i + 1}`);
        } catch (error) {
            console.error(`❌ Error loading sound ${i + 1}:`, error);
        }
    }
}

// Initialize sounds
loadSounds();

// Function to play slap sounds with modulation
function playSmackSound(intensity = 1.0) {
    if (slapSounds.length === 0) {
        console.log('Sounds not loaded yet...');
        return;
    }
    
    const now = audioContext.currentTime;
    
    // Randomly select one of the loaded sounds
    const randomSound = slapSounds[Math.floor(Math.random() * slapSounds.length)];
    
    // Create buffer source
    const source = audioContext.createBufferSource();
    source.buffer = randomSound;
    
    // Add pitch/speed variation for variety
    const pitchVariation = 0.85 + Math.random() * 0.3; // Random pitch between 0.85x and 1.15x
    source.playbackRate.value = pitchVariation;
    
    // Create gain node for volume control
    const gainNode = audioContext.createGain();
    gainNode.gain.setValueAtTime(intensity * 0.7, now);
    
    // Optional: Add a high-shelf EQ for brightness control
    const highShelf = audioContext.createBiquadFilter();
    highShelf.type = 'highshelf';
    highShelf.frequency.value = 2000;
    highShelf.gain.value = 3 + Math.random() * 3; // Random brightness boost 3-6dB
    
    // Optional: Add a slight low-pass variation for tonal variety
    const lowpass = audioContext.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 8000 + Math.random() * 4000; // Random cutoff 8-12kHz
    lowpass.Q.value = 0.7;
    
    // Connect the audio graph
    source.connect(lowpass);
    lowpass.connect(highShelf);
    highShelf.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    // Play the sound with offset to skip silent beginning
    // Typical slap sounds have ~0.05-0.1s of silence at the start
    const silentOffset = 0.08; // Skip first 80ms
    source.start(now, silentOffset);
}

// Scene setup
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });

renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
document.body.appendChild(renderer.domElement);

camera.position.z = 5;

// Psychedelic background shader
const backgroundGeometry = new THREE.PlaneGeometry(20, 20);
const backgroundMaterial = new THREE.ShaderMaterial({
    uniforms: {
        time: { value: 0 },
        resolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) }
    },
    vertexShader: `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: `
        uniform float time;
        uniform vec2 resolution;
        varying vec2 vUv;
        
        void main() {
            vec2 uv = vUv * 2.0 - 1.0;
            uv.x *= resolution.x / resolution.y;
            
            // Psychedelic color waves
            float r = sin(length(uv) * 10.0 - time * 2.0) * 0.5 + 0.5;
            float g = sin(length(uv) * 8.0 - time * 1.5 + 2.0) * 0.5 + 0.5;
            float b = sin(length(uv) * 12.0 - time * 2.5 + 4.0) * 0.5 + 0.5;
            
            // Add swirling patterns
            float angle = atan(uv.y, uv.x);
            float radius = length(uv);
            
            r += sin(angle * 5.0 + time) * 0.3;
            g += sin(angle * 7.0 - time * 1.2) * 0.3;
            b += sin(angle * 3.0 + time * 0.8) * 0.3;
            
            // Add pulsing effect
            float pulse = sin(time * 3.0) * 0.1 + 0.9;
            
            vec3 color = vec3(r, g, b) * pulse;
            gl_FragColor = vec4(color, 1.0);
        }
    `,
    side: THREE.DoubleSide
});

const background = new THREE.Mesh(backgroundGeometry, backgroundMaterial);
background.position.z = -5;
scene.add(background);

// Create the peach group
const peachGroup = new THREE.Group();
scene.add(peachGroup);

// Variable to hold the peach mesh for raycasting
let peachMesh = null;

// Function to create a procedural peach as fallback
function createProceduralPeach() {
    console.log('🍑 Creating procedural peach...');
    
    // Peach body (sphere with deformations)
    const peachGeometry = new THREE.SphereGeometry(1, 64, 64);
    const peachPositions = peachGeometry.attributes.position;

    // Add peach features: dimple at top and vertical seam creating two round halves
    for (let i = 0; i < peachPositions.count; i++) {
        let x = peachPositions.getX(i);
        let y = peachPositions.getY(i);
        let z = peachPositions.getZ(i);
        
        // Create dimple effect at the top
        if (y > 0.7) {
            const factor = (y - 0.7) * 2.0;
            x = x * (1 - factor * 0.3);
            y = y - factor * 0.2;
            z = z * (1 - factor * 0.3);
        }
        
        // Create the characteristic peach seam: tight crease with round bulbous halves
        const radius = Math.sqrt(x * x + z * z);
        const angle = Math.atan2(x, z);
        
        // Tight crease in the center
        const seamInfluence = Math.exp(-Math.abs(angle) * 15.0);
        
        // Vertical fade - strongest in middle, fades at top and bottom
        const verticalFade = Math.exp(-y * y * 2.0);
        
        // Create a tight crease by pulling inward sharply at center
        const creaseDepth = seamInfluence * verticalFade * 0.25;
        
        // Each half should bulge outward with its own rounded shape
        const absAngle = Math.abs(angle);
        const sideInfluence = Math.exp(-(absAngle - Math.PI / 2) * (absAngle - Math.PI / 2) * 3.0);
        const bulgeFactor = sideInfluence * verticalFade * 0.15;
        
        // Combine: crease pulls in, bulge pushes out
        const finalRadius = radius * (1.0 - creaseDepth + bulgeFactor);
        
        // Convert back to cartesian
        x = Math.sin(angle) * finalRadius;
        z = Math.cos(angle) * finalRadius;
        
        peachPositions.setXYZ(i, x, y, z);
    }

    peachGeometry.computeVertexNormals();

    const peachMaterial = new THREE.MeshStandardMaterial({
        color: 0xffb347,
        roughness: 0.7,
        metalness: 0.0,
        emissive: 0xff8c42,
        emissiveIntensity: 0.1
    });

    peachMesh = new THREE.Mesh(peachGeometry, peachMaterial);
    peachGroup.add(peachMesh);

    // Add a leaf on top
    const leafGeometry = new THREE.BoxGeometry(0.15, 0.4, 0.05);
    const leafMaterial = new THREE.MeshStandardMaterial({
        color: 0x2d5016,
        roughness: 0.7
    });

    const leaf = new THREE.Mesh(leafGeometry, leafMaterial);
    leaf.position.y = 0.9;
    leaf.rotation.x = -0.3;
    peachGroup.add(leaf);
    
    console.log('✅ Procedural peach created!');
}

// Try to load the GLTF model, fallback to procedural if it fails
const loader = new GLTFLoader();
loader.load(
    '/assets/scene.gltf',
    (gltf) => {
        const model = gltf.scene;
        
        console.log('🍑 Peach model loaded from GLTF!');
        
        // Get the bounding box to understand the model size
        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        
        // Scale the model to be about 2 units tall
        const scaleFactor = 2 / size.y;
        model.scale.set(scaleFactor, scaleFactor, scaleFactor);
        
        // Recalculate box after scaling
        box.setFromObject(model);
        box.getCenter(center);
        
        // Center the model at origin
        model.position.sub(center);
        
        // Rotate the peach to face the camera nicely
        // Adjust these values to get the orientation you want
        model.rotation.y = Math.PI; // 180 degrees
        
        // Store all meshes for raycasting
        const meshes = [];
        model.traverse((child) => {
            if (child.isMesh) {
                meshes.push(child);
                console.log('Found mesh:', child.name);
            }
        });
        
        // Store the meshes array for raycasting
        peachMesh = meshes;
        
        peachGroup.add(model);
        console.log('✅ Peach is ready to be smacked!');
    },
    undefined,
    (error) => {
        console.warn('⚠️ Could not load GLTF model (missing scene.bin file?), using procedural peach instead');
        console.error('Error details:', error);
        createProceduralPeach();
    }
);

// Lighting - Angled for form definition
const ambientLight = new THREE.AmbientLight(0xffffff, 0.15); // Low ambient for contrast
scene.add(ambientLight);

// Key light at 45 degrees from upper left - classic three-point lighting angle
const keyLight = new THREE.DirectionalLight(0xffffff, 3.5);
keyLight.position.set(-5, 6, 5); // Angled from side for better form definition
keyLight.castShadow = true;
scene.add(keyLight);

// Fill light from opposite side at lower angle
const fillLight = new THREE.DirectionalLight(0xffd9b3, 0.5);
fillLight.position.set(4, 1, 3); // Lower and from the right
scene.add(fillLight);

// Strong rim light from behind-top to separate the peach from background
const rimLight = new THREE.PointLight(0xffffff, 4.5, 100);
rimLight.position.set(1, 3, -5); // Higher and more angled
scene.add(rimLight);

// Side accent lights at grazing angles to reveal curves and crease
const leftCreaseLight = new THREE.PointLight(0xffddaa, 2.0, 100);
leftCreaseLight.position.set(-4, 0.5, 3); // More from the side, slight height
scene.add(leftCreaseLight);

const rightCreaseLight = new THREE.PointLight(0xffddaa, 2.0, 100);
rightCreaseLight.position.set(4, 0.5, 3); // Mirror from right side
scene.add(rightCreaseLight);

// Bottom light to lift shadows slightly and show bottom curves
const bottomLight = new THREE.PointLight(0xffccaa, 0.8, 100);
bottomLight.position.set(0, -3, 2);
scene.add(bottomLight);

// Accent lights for the psychedelic effect
const pointLight1 = new THREE.PointLight(0xff69b4, 1.2, 100);
pointLight1.position.set(-5, -5, 5);
scene.add(pointLight1);

const pointLight2 = new THREE.PointLight(0x00ffff, 0.9, 100);
pointLight2.position.set(5, -3, 4);
scene.add(pointLight2);

// Enable shadows and tone mapping for dramatic contrast
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.5;

// Physics and interaction variables
const peachState = {
    velocity: new THREE.Vector3(0, 0, 0),
    angularVelocity: new THREE.Vector3(0, 0, 0),
    defaultPosition: new THREE.Vector3(0, 0, 0),
    defaultRotation: new THREE.Euler(0, 0, 0),
    isWobbling: false
};

const damping = 0.95;
const returnForce = 0.05;
const angularDamping = 0.92;

// Raycaster for mouse interaction
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

function onMouseClick(event) {
    // Only process clicks if the model is loaded
    if (!peachMesh) return;
    
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    
    raycaster.setFromCamera(mouse, camera);
    
    // Handle both array of meshes (GLTF) and single mesh (procedural)
    const meshesToCheck = Array.isArray(peachMesh) ? peachMesh : [peachMesh];
    const intersects = raycaster.intersectObjects(meshesToCheck, true);
    
    if (intersects.length > 0) {
        console.log('🍑 SMACK!');
        
        // Calculate smack direction
        const intersectPoint = intersects[0].point;
        const direction = intersectPoint.clone().sub(peachGroup.position).normalize();
        
        // Apply impulse
        const force = 3.0;
        peachState.velocity.add(direction.multiplyScalar(force));
        
        // Add random angular velocity for spinning
        peachState.angularVelocity.set(
            (Math.random() - 0.5) * 5,
            (Math.random() - 0.5) * 5,
            (Math.random() - 0.5) * 5
        );
        
        peachState.isWobbling = true;
        
        // Play smack sound with varying intensity
        const intensity = 0.7 + Math.random() * 0.3;
        playSmackSound(intensity);
    }
}

window.addEventListener('click', onMouseClick);

// Idle floating animation
let idleTime = 0;

// Animation loop
function animate() {
    requestAnimationFrame(animate);
    
    const delta = 0.016; // ~60fps
    idleTime += delta;
    
    // Update background shader
    backgroundMaterial.uniforms.time.value += delta;
    
    if (peachState.isWobbling) {
        // Apply velocity
        peachGroup.position.add(peachState.velocity.clone().multiplyScalar(delta));
        
        // Apply angular velocity
        peachGroup.rotation.x += peachState.angularVelocity.x * delta;
        peachGroup.rotation.y += peachState.angularVelocity.y * delta;
        peachGroup.rotation.z += peachState.angularVelocity.z * delta;
        
        // Apply damping
        peachState.velocity.multiplyScalar(damping);
        peachState.angularVelocity.multiplyScalar(angularDamping);
        
        // Return to default position
        const toDefault = peachState.defaultPosition.clone().sub(peachGroup.position);
        peachState.velocity.add(toDefault.multiplyScalar(returnForce));
        
        // Return to default rotation gradually
        peachGroup.rotation.x += (peachState.defaultRotation.x - peachGroup.rotation.x) * 0.05;
        peachGroup.rotation.y += (peachState.defaultRotation.y - peachGroup.rotation.y) * 0.05;
        peachGroup.rotation.z += (peachState.defaultRotation.z - peachGroup.rotation.z) * 0.05;
        
        // Check if peach has settled
        if (peachState.velocity.length() < 0.01 && peachState.angularVelocity.length() < 0.01) {
            peachState.isWobbling = false;
            peachState.velocity.set(0, 0, 0);
            peachState.angularVelocity.set(0, 0, 0);
        }
    } else {
        // Idle floating animation
        peachGroup.position.y = Math.sin(idleTime * 1.5) * 0.2;
        peachGroup.rotation.y = Math.sin(idleTime * 0.5) * 0.3;
    }
    
    renderer.render(scene, camera);
}

// Handle window resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    backgroundMaterial.uniforms.resolution.value.set(window.innerWidth, window.innerHeight);
});

animate();

