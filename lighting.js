import * as THREE from 'three';

/**
 * Setup atmospheric lighting with influencer-style ring light
 * @param {THREE.Scene} scene - The scene to add lights to
 */
export function setupLighting(scene) {
    if (!scene) {
        console.error('setupLighting: No scene provided');
        return;
    }
    
    // Soft ambient base
    const ambientLight = new THREE.AmbientLight(0xffeedd, 0.4);
    scene.add(ambientLight);

    // Create the physical ring light (like influencer/beauty ring lights)
    const ringLightGeometry = new THREE.TorusGeometry(3.5, 0.15, 16, 100);
    const ringLightMaterial = new THREE.MeshStandardMaterial({
        color: 0xffd9a8,
        emissive: 0xffd9a8,
        emissiveIntensity: 2,
        toneMapped: false // Make it super bright
    });
    const ringLightMesh = new THREE.Mesh(ringLightGeometry, ringLightMaterial);
    
    // Position it in front of the peach, facing it
    ringLightMesh.position.set(0, 0, 6);
    ringLightMesh.rotation.x = 0; // Face the camera/peach
    scene.add(ringLightMesh);

    // Add point lights around the ring to actually illuminate the scene
    const numLights = 24;
    const ringRadius = 3.5;
    for (let i = 0; i < numLights; i++) {
        const angle = (i / numLights) * Math.PI * 2;
        const x = Math.cos(angle) * ringRadius;
        const y = Math.sin(angle) * ringRadius;
        
        const light = new THREE.PointLight(0xffd9a8, 1.5, 100);
        light.position.set(x, y, 6);
        scene.add(light);
    }

    // Soft key light from above for gentle definition
    const keyLight = new THREE.DirectionalLight(0xffffff, 0.8);
    keyLight.position.set(0, 5, 8);
    scene.add(keyLight);

    // Rim light from behind to enhance contours
    const rimLight = new THREE.PointLight(0xffe4d6, 2.0, 100);
    rimLight.position.set(0, 1, -6);
    scene.add(rimLight);

    // Subtle fill from below
    const bottomFill = new THREE.PointLight(0xffd9c8, 0.6, 100);
    bottomFill.position.set(0, -3, 4);
    scene.add(bottomFill);
}

