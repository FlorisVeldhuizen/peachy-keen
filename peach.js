import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// Texture generation constants
const NORMAL_MAP_SIZE = 512;
const NORMAL_MAP_OCTAVES = 4;
const NORMAL_MAP_HEIGHT_SCALE = 0.3;

// Model constants
const TARGET_MODEL_HEIGHT = 3;
const MODEL_ROTATION_DEGREES = 300;

/**
 * Generate a procedural normal map for smooth peach skin texture
 * @returns {THREE.CanvasTexture} Generated normal map texture
 */
function generatePeachNormalMap() {
    const size = NORMAL_MAP_SIZE;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    
    // Create image data
    const imageData = ctx.createImageData(size, size);
    const data = imageData.data;
    
    // Noise function for peach fuzz texture
    const noise = (x, y) => {
        const random = (n) => {
            const val = Math.sin(n) * 43758.5453123;
            return val - Math.floor(val);
        };
        return random(x * 12.9898 + y * 78.233);
    };
    
    // Multi-octave noise for detail (Fractal Brownian Motion)
    const fbm = (x, y) => {
        let value = 0;
        let amplitude = 1;
        let frequency = 1;
        
        for (let i = 0; i < NORMAL_MAP_OCTAVES; i++) {
            value += amplitude * noise(x * frequency, y * frequency);
            amplitude *= 0.5;
            frequency *= 2;
        }
        return value;
    };
    
    // Generate normal map data
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const idx = (y * size + x) * 4;
            
            // Sample neighboring pixels for height
            const h0 = fbm(x / size, y / size) * NORMAL_MAP_HEIGHT_SCALE;
            const h1 = fbm((x + 1) / size, y / size) * NORMAL_MAP_HEIGHT_SCALE;
            const h2 = fbm(x / size, (y + 1) / size) * NORMAL_MAP_HEIGHT_SCALE;
            
            // Calculate normal from height differences
            const dx = h1 - h0;
            const dy = h2 - h0;
            
            // Normal vector (z is always positive for a bump)
            const nx = -dx;
            const ny = -dy;
            const nz = 1.0;
            
            // Normalize
            const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
            
            // Convert to 0-255 range (normal maps store normals as RGB)
            data[idx] = ((nx / len) * 0.5 + 0.5) * 255;      // R
            data[idx + 1] = ((ny / len) * 0.5 + 0.5) * 255;  // G
            data[idx + 2] = ((nz / len) * 0.5 + 0.5) * 255;  // B
            data[idx + 3] = 255;                              // A
        }
    }
    
    ctx.putImageData(imageData, 0, 0);
    
    // Create texture from canvas
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.needsUpdate = true;
    
    return texture;
}

/**
 * Create a procedural peach as fallback when GLTF model fails to load
 * @returns {Object} Object containing meshes array and leaf mesh
 */
function createProceduralPeach() {
    
    // Peach body (sphere with deformations)
    const peachGeometry = new THREE.SphereGeometry(1.5, 64, 64);
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

    const normalMap = generatePeachNormalMap();
    const peachMaterial = new THREE.MeshStandardMaterial({
        color: 0xffb347,
        roughness: 0.7,
        metalness: 0.0,
        emissive: 0xff8c42,
        emissiveIntensity: 0.1,
        normalMap: normalMap,
        normalScale: new THREE.Vector2(0.5, 0.5) // Subtle effect
    });

    const peachMesh = new THREE.Mesh(peachGeometry, peachMaterial);

    // Add a leaf on top
    const leafGeometry = new THREE.BoxGeometry(0.15, 0.4, 0.05);
    const leafMaterial = new THREE.MeshStandardMaterial({
        color: 0x2d5016,
        roughness: 0.7
    });

    const leaf = new THREE.Mesh(leafGeometry, leafMaterial);
    leaf.position.y = 0.9;
    leaf.rotation.x = -0.3;
    
    return { meshes: [peachMesh], leaf };
}

/**
 * Load the peach GLTF model, with fallback to procedural generation
 * @param {THREE.Group} peachGroup - The group to add the peach to
 * @param {Function} onMeshesLoaded - Callback function when meshes are loaded
 */
export function loadPeachModel(peachGroup, onMeshesLoaded) {
    const loader = new GLTFLoader();
    const normalMap = generatePeachNormalMap();
    
    loader.load(
        `${import.meta.env.BASE_URL}assets/peachy.glb`,
        (gltf) => {
            const model = gltf.scene;
            
            // Get the bounding box to understand the model size
            const box = new THREE.Box3().setFromObject(model);
            const size = box.getSize(new THREE.Vector3());
            const center = box.getCenter(new THREE.Vector3());
            
            // Scale the model to target height
            const scaleFactor = TARGET_MODEL_HEIGHT / size.y;
            model.scale.set(scaleFactor, scaleFactor, scaleFactor);
            
            // Recalculate box after scaling
            box.setFromObject(model);
            box.getCenter(center);
            
            // Center the model at origin
            model.position.sub(center);
            
            // Rotate the peach to face the camera nicely - crease towards user
            model.rotation.y = (MODEL_ROTATION_DEGREES * Math.PI) / 180;
            
            // Store all meshes for raycasting
            const meshes = [];
            model.traverse((child) => {
                if (child.isMesh) {
                    meshes.push(child);
                    
                    // Don't recompute normals - use the ones from the GLTF file
                    // (The model has duplicate vertices at UV seams, so computeVertexNormals
                    // would create flat shading. The original normals are smooth.)
                    
                    // Force smooth shading on the material and add normal map with peachy pink tint
                    if (child.material) {
                        child.material.flatShading = false;
                        child.material.normalMap = normalMap;
                        child.material.normalScale = new THREE.Vector2(0.5, 0.5); // Subtle effect
                        // Add peachy pink tint (FFB3BA is a soft peachy pink color)
                        child.material.color = new THREE.Color(0xFFB3BA);
                        child.material.needsUpdate = true;
                    }
                }
            });
            
            peachGroup.add(model);
            onMeshesLoaded(meshes);
        },
        undefined,
        (error) => {
            console.error('Could not load GLTF model, using procedural peach instead:', error);
            
            const { meshes, leaf } = createProceduralPeach();
            peachGroup.add(meshes[0]);
            peachGroup.add(leaf);
            onMeshesLoaded(meshes);
        }
    );
}

