import { AmbientLight, TorusGeometry, MeshStandardMaterial, Mesh, PointLight, DirectionalLight } from 'three';

// Configuration for different lighting modes
const LIGHTING_CONFIG = {
    // Number of lights
    NORMAL_MODE_LIGHTS: 6,    // Simplified lighting for normal mode (performance)
    OILED_MODE_LIGHTS: 24,    // Full quality lighting for oiled mode (quality)
    
    // Ring light geometry
    RING_RADIUS: 3.5,
    RING_TUBE_RADIUS: 0.15,
    RING_RADIAL_SEGMENTS: 16,
    RING_TUBULAR_SEGMENTS: 100,
    RING_POSITION_Z: 6,
    
    // Ring light properties
    RING_COLOR: 0xffd9a8,
    RING_EMISSIVE_INTENSITY: 2,
    RING_LIGHT_DISTANCE: 100,
    RING_LIGHT_INTENSITY_OILED: 1.3,
    RING_LIGHT_INTENSITY_NORMAL: 4.7,  // Boosted to compensate for fewer lights
    
    // Ambient light
    AMBIENT_COLOR: 0xffeedd,
    AMBIENT_INTENSITY: 0.25,
    
    // Key light (directional)
    KEY_LIGHT_COLOR: 0xffffff,
    KEY_LIGHT_INTENSITY: 1.2,
    KEY_LIGHT_POSITION: { x: 2, y: 5, z: 8 },
    
    // Rim light (back highlight)
    RIM_LIGHT_COLOR: 0xffe4d6,
    RIM_LIGHT_INTENSITY: 2.0,
    RIM_LIGHT_DISTANCE: 100,
    RIM_LIGHT_POSITION: { x: 0, y: 1, z: -6 },
    
    // Bottom fill light
    BOTTOM_FILL_COLOR: 0xffd9c8,
    BOTTOM_FILL_INTENSITY: 0.6,
    BOTTOM_FILL_DISTANCE: 100,
    BOTTOM_FILL_POSITION: { x: 0, y: -3, z: 4 },
};

/**
 * Setup atmospheric lighting with influencer-style ring light
 * @param {THREE.Scene} scene - The scene to add lights to
 * @returns {Object} Object containing references to all lights and mode control
 */
export function setupLighting(scene) {
    if (!scene) {
        console.error('setupLighting: No scene provided');
        return { ringLights: [], otherLights: [], normalModeLights: [], oiledModeLights: [], setOiledMode: () => {} };
    }
    
    const ringLights = [];
    const normalModeLights = []; // Lights for normal mode (subset)
    const oiledModeLights = [];  // Lights for oiled mode (full set)
    const otherLights = [];
    
    // Reduced ambient base for stronger shadows
    const ambientLight = new AmbientLight(
        LIGHTING_CONFIG.AMBIENT_COLOR, 
        LIGHTING_CONFIG.AMBIENT_INTENSITY
    );
    scene.add(ambientLight);
    otherLights.push(ambientLight);

    // Create the physical ring light (like influencer/beauty ring lights)
    const ringLightGeometry = new TorusGeometry(
        LIGHTING_CONFIG.RING_RADIUS,
        LIGHTING_CONFIG.RING_TUBE_RADIUS,
        LIGHTING_CONFIG.RING_RADIAL_SEGMENTS,
        LIGHTING_CONFIG.RING_TUBULAR_SEGMENTS
    );
    const ringLightMaterial = new MeshStandardMaterial({
        color: LIGHTING_CONFIG.RING_COLOR,
        emissive: LIGHTING_CONFIG.RING_COLOR,
        emissiveIntensity: LIGHTING_CONFIG.RING_EMISSIVE_INTENSITY,
        toneMapped: false // Make it super bright
    });
    const ringLightMesh = new Mesh(ringLightGeometry, ringLightMaterial);
    
    // Position it in front of the peach, facing it
    ringLightMesh.position.set(0, 0, LIGHTING_CONFIG.RING_POSITION_Z);
    ringLightMesh.rotation.x = 0; // Face the camera/peach
    scene.add(ringLightMesh);
    ringLights.push(ringLightMesh);

    // Add point lights around the ring to actually illuminate the scene
    // Create all lights, but split into normal and oiled mode groups
    const numLights = LIGHTING_CONFIG.OILED_MODE_LIGHTS;
    for (let i = 0; i < numLights; i++) {
        const angle = (i / numLights) * Math.PI * 2;
        const x = Math.cos(angle) * LIGHTING_CONFIG.RING_RADIUS;
        const y = Math.sin(angle) * LIGHTING_CONFIG.RING_RADIUS;
        
        // In oiled mode, all lights are at full intensity
        // In normal mode, fewer lights but slightly brighter to compensate
        const light = new PointLight(
            LIGHTING_CONFIG.RING_COLOR,
            LIGHTING_CONFIG.RING_LIGHT_INTENSITY_OILED,
            LIGHTING_CONFIG.RING_LIGHT_DISTANCE
        );
        light.position.set(x, y, LIGHTING_CONFIG.RING_POSITION_Z);
        scene.add(light);
        ringLights.push(light);
        oiledModeLights.push(light);
        
        // Only some lights are used in normal mode (evenly distributed)
        if (i % (numLights / LIGHTING_CONFIG.NORMAL_MODE_LIGHTS) === 0) {
            normalModeLights.push(light);
        }
    }
    
    // Start in normal mode (most lights disabled)
    oiledModeLights.forEach((light, idx) => {
        light.visible = normalModeLights.includes(light);
    });
    
    // Boost intensity of normal mode lights slightly to compensate for fewer lights
    normalModeLights.forEach(light => {
        light.intensity = LIGHTING_CONFIG.RING_LIGHT_INTENSITY_NORMAL;
    });

    // Stronger key light from above for defined shadows
    const keyLight = new DirectionalLight(
        LIGHTING_CONFIG.KEY_LIGHT_COLOR,
        LIGHTING_CONFIG.KEY_LIGHT_INTENSITY
    );
    keyLight.position.set(
        LIGHTING_CONFIG.KEY_LIGHT_POSITION.x,
        LIGHTING_CONFIG.KEY_LIGHT_POSITION.y,
        LIGHTING_CONFIG.KEY_LIGHT_POSITION.z
    );
    scene.add(keyLight);
    otherLights.push(keyLight);

    // Rim light from behind to enhance contours
    const rimLight = new PointLight(
        LIGHTING_CONFIG.RIM_LIGHT_COLOR,
        LIGHTING_CONFIG.RIM_LIGHT_INTENSITY,
        LIGHTING_CONFIG.RIM_LIGHT_DISTANCE
    );
    rimLight.position.set(
        LIGHTING_CONFIG.RIM_LIGHT_POSITION.x,
        LIGHTING_CONFIG.RIM_LIGHT_POSITION.y,
        LIGHTING_CONFIG.RIM_LIGHT_POSITION.z
    );
    scene.add(rimLight);
    otherLights.push(rimLight);

    // Subtle fill from below
    const bottomFill = new PointLight(
        LIGHTING_CONFIG.BOTTOM_FILL_COLOR,
        LIGHTING_CONFIG.BOTTOM_FILL_INTENSITY,
        LIGHTING_CONFIG.BOTTOM_FILL_DISTANCE
    );
    bottomFill.position.set(
        LIGHTING_CONFIG.BOTTOM_FILL_POSITION.x,
        LIGHTING_CONFIG.BOTTOM_FILL_POSITION.y,
        LIGHTING_CONFIG.BOTTOM_FILL_POSITION.z
    );
    scene.add(bottomFill);
    otherLights.push(bottomFill);
    
    // Function to switch between lighting modes
    const setOiledMode = (isOiled) => {
        if (isOiled) {
            // Enable all lights at standard intensity
            oiledModeLights.forEach(light => {
                light.visible = true;
                light.intensity = LIGHTING_CONFIG.RING_LIGHT_INTENSITY_OILED;
            });
        } else {
            // Enable only normal mode lights with boosted intensity
            oiledModeLights.forEach(light => {
                if (normalModeLights.includes(light)) {
                    light.visible = true;
                    light.intensity = LIGHTING_CONFIG.RING_LIGHT_INTENSITY_NORMAL;
                } else {
                    light.visible = false;
                }
            });
        }
    };
    
    return { ringLights, otherLights, normalModeLights, oiledModeLights, setOiledMode };
}

