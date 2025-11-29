import * as THREE from 'three';
import { playSmackSound } from './audio.js';
import { SoftBodyPhysics } from './softbody.js';

// Physics and interaction state
export const peachState = {
    velocity: new THREE.Vector3(0, 0, 0),
    angularVelocity: new THREE.Vector3(0, 0, 0),
    defaultPosition: new THREE.Vector3(0, 0, 0),
    defaultRotation: new THREE.Euler(0, 0, 0),
    isWobbling: false,
    softBodies: [] // Array of soft body physics instances for each mesh
};

// Physics constants
const damping = 0.95;
const returnForce = 0.05;
const angularDamping = 0.92;

// Mouse tracking state
const mouseState = {
    position: { x: 0, y: 0 },
    lastPosition: { x: 0, y: 0 },
    velocity: { x: 0, y: 0 },
    lastSmackTime: 0,
    smackCooldown: 200 // ms between smacks
};

// Raycaster for mouse interaction
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

let peachMesh = null;
let peachGroup = null;
let camera = null;
let handCursor = null;

// Initialize interaction system
export function initInteraction(peachGroupRef, cameraRef) {
    peachGroup = peachGroupRef;
    camera = cameraRef;
    handCursor = document.getElementById('hand-cursor');
    
    window.addEventListener('mousemove', onMouseMove);
}

// Set the peach mesh for raycasting and initialize soft body physics
export function setPeachMesh(meshes) {
    peachMesh = meshes;
    
    // Initialize soft body physics for each mesh
    peachState.softBodies = [];
    const meshArray = Array.isArray(meshes) ? meshes : [meshes];
    
    meshArray.forEach(mesh => {
        if (mesh.geometry && mesh.geometry.attributes.position) {
            // Make sure geometry is not shared/indexed in a way that prevents modification
            if (!mesh.geometry.attributes.position.array) {
                console.warn('⚠️ Mesh geometry cannot be modified, skipping soft body physics');
                return;
            }
            
            const softBody = new SoftBodyPhysics(mesh);
            peachState.softBodies.push(softBody);
            console.log('🍑 Soft body physics enabled for mesh:', mesh.name || 'unnamed');
        }
    });
}

// Track mouse movement for velocity calculation
function onMouseMove(event) {
    // Update hand cursor position
    if (handCursor) {
        handCursor.style.left = event.clientX + 'px';
        handCursor.style.top = event.clientY + 'px';
    }
    
    // Store last position
    mouseState.lastPosition.x = mouseState.position.x;
    mouseState.lastPosition.y = mouseState.position.y;
    
    // Update current position
    mouseState.position.x = event.clientX;
    mouseState.position.y = event.clientY;
    
    // Calculate velocity (pixels per frame)
    mouseState.velocity.x = mouseState.position.x - mouseState.lastPosition.x;
    mouseState.velocity.y = mouseState.position.y - mouseState.lastPosition.y;
    
    // Update normalized mouse coordinates for raycasting
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    
    // Check for hover and smack
    checkHoverSmack();
}

function checkHoverSmack() {
    // Only process if the model is loaded
    if (!peachMesh || !peachGroup || !camera) return;
    
    // Cooldown to prevent too many smacks
    const currentTime = Date.now();
    if (currentTime - mouseState.lastSmackTime < mouseState.smackCooldown) return;
    
    raycaster.setFromCamera(mouse, camera);
    
    // Handle both array of meshes (GLTF) and single mesh (procedural)
    const meshesToCheck = Array.isArray(peachMesh) ? peachMesh : [peachMesh];
    const intersects = raycaster.intersectObjects(meshesToCheck, true);
    
    if (intersects.length > 0) {
        // Calculate velocity magnitude
        const velocityMagnitude = Math.sqrt(
            mouseState.velocity.x * mouseState.velocity.x + 
            mouseState.velocity.y * mouseState.velocity.y
        );
        
        // Only smack if moving fast enough (minimum threshold)
        const minVelocity = 2; // pixels per frame
        if (velocityMagnitude < minVelocity) return;
        
        mouseState.lastSmackTime = currentTime;
        
        console.log('🍑 SMACK! Velocity:', velocityMagnitude.toFixed(2));
        
        // Add smack animation to cursor
        if (handCursor) {
            handCursor.classList.remove('smacking');
            void handCursor.offsetWidth; // Trigger reflow
            handCursor.classList.add('smacking');
            setTimeout(() => handCursor.classList.remove('smacking'), 200);
        }
        
        // Calculate smack direction
        const intersectPoint = intersects[0].point;
        const direction = intersectPoint.clone().sub(peachGroup.position).normalize();
        
        // Invert X and Y so peach moves away from where you hit it
        direction.x *= -1;
        direction.y *= -1;
        // Keep Z positive (toward camera)
        direction.z = Math.abs(direction.z);
        
        // Scale force based on velocity (faster movement = harder hit)
        const velocityScale = Math.min(velocityMagnitude / 20, 3); // Cap at 3x
        const force = 2.0 * velocityScale;
        peachState.velocity.add(direction.multiplyScalar(force));
        
        // Add angular velocity based on impact force
        peachState.angularVelocity.set(
            (Math.random() - 0.5) * 5 * velocityScale,
            (Math.random() - 0.5) * 5 * velocityScale,
            (Math.random() - 0.5) * 5 * velocityScale
        );
        
        peachState.isWobbling = true;
        
        // Apply soft body impulse for jiggle effect (subtle!)
        const jiggleForce = 0.15 * velocityScale; // Force for vertex deformation
        peachState.softBodies.forEach(softBody => {
            softBody.applyImpulse(intersectPoint, direction.clone(), jiggleForce);
        });
        
        // Sound intensity based on velocity
        const intensity = Math.min(0.4 + velocityMagnitude / 30, 1.0);
        playSmackSound(intensity);
    }
}

// Update peach physics
export function updatePeachPhysics(delta, idleTime) {
    if (!peachGroup) return;
    
    // Update soft body physics (jiggle)
    peachState.softBodies.forEach(softBody => {
        softBody.update(delta);
    });
    
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
}

