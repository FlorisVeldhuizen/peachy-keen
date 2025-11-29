import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// Function to create a procedural peach as fallback
function createProceduralPeach() {
    console.log('🍑 Creating procedural peach...');
    
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

    const peachMaterial = new THREE.MeshStandardMaterial({
        color: 0xffb347,
        roughness: 0.7,
        metalness: 0.0,
        emissive: 0xff8c42,
        emissiveIntensity: 0.1
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
    
    console.log('✅ Procedural peach created!');
    
    return { meshes: [peachMesh], leaf };
}

// Load the peach model
export function loadPeachModel(peachGroup, onMeshesLoaded) {
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
            
            // Scale the model to be about 3 units tall (1.5x bigger)
            const scaleFactor = 3 / size.y;
            model.scale.set(scaleFactor, scaleFactor, scaleFactor);
            
            // Recalculate box after scaling
            box.setFromObject(model);
            box.getCenter(center);
            
            // Center the model at origin
            model.position.sub(center);
            
            // Rotate the peach to face the camera nicely
            model.rotation.y = Math.PI; // 180 degrees
            
            // Store all meshes for raycasting
            const meshes = [];
            model.traverse((child) => {
                if (child.isMesh) {
                    meshes.push(child);
                    console.log('Found mesh:', child.name);
                    
                    // Recompute smooth vertex normals (this interpolates normals across the surface)
                    child.geometry.computeVertexNormals();
                    
                    // Force smooth shading on the material
                    if (child.material) {
                        child.material.flatShading = false;
                        child.material.needsUpdate = true;
                    }
                }
            });
            
            peachGroup.add(model);
            onMeshesLoaded(meshes);
            console.log('✅ Peach is ready to be smacked!');
        },
        undefined,
        (error) => {
            console.warn('⚠️ Could not load GLTF model (missing scene.bin file?), using procedural peach instead');
            console.error('Error details:', error);
            
            const { meshes, leaf } = createProceduralPeach();
            peachGroup.add(meshes[0]);
            peachGroup.add(leaf);
            onMeshesLoaded(meshes);
        }
    );
}

