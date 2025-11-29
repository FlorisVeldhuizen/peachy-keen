import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

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

// Lighting - Enhanced for better definition
const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
scene.add(ambientLight);

// Main directional light from top-right
const directionalLight = new THREE.DirectionalLight(0xffffff, 1.5);
directionalLight.position.set(3, 4, 5);
scene.add(directionalLight);

// Fill light from left to reduce harsh shadows
const fillLight = new THREE.DirectionalLight(0xffd9b3, 0.6);
fillLight.position.set(-3, 2, 3);
scene.add(fillLight);

// Rim light from behind for edge definition
const rimLight = new THREE.PointLight(0xffaaaa, 2, 100);
rimLight.position.set(0, 0, -3);
scene.add(rimLight);

// Accent lights for the psychedelic effect
const pointLight1 = new THREE.PointLight(0xff69b4, 0.8, 100);
pointLight1.position.set(-5, -5, 5);
scene.add(pointLight1);

const pointLight2 = new THREE.PointLight(0x00ffff, 0.6, 100);
pointLight2.position.set(5, -3, 4);
scene.add(pointLight2);

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

