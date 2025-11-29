import * as THREE from 'three';

// Setup all scene lighting with angled, dramatic three-point lighting
export function setupLighting(scene) {
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
}

