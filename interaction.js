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
    smackCooldown: 200, // ms between smacks
    // Velocity history for smoothing (store last N frames)
    velocityHistory: [],
    maxHistorySize: 5 // Average over 5 frames for smooth direction
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
    
    // Store velocity in history for smoothing
    mouseState.velocityHistory.push({
        x: mouseState.velocity.x,
        y: mouseState.velocity.y,
        time: Date.now()
    });
    
    // Keep only recent history
    if (mouseState.velocityHistory.length > mouseState.maxHistorySize) {
        mouseState.velocityHistory.shift();
    }
    
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
        // Calculate average velocity from history for smoother, more accurate direction
        let avgVelocityX = 0;
        let avgVelocityY = 0;
        
        if (mouseState.velocityHistory.length > 0) {
            for (const vel of mouseState.velocityHistory) {
                avgVelocityX += vel.x;
                avgVelocityY += vel.y;
            }
            avgVelocityX /= mouseState.velocityHistory.length;
            avgVelocityY /= mouseState.velocityHistory.length;
        }
        
        // Calculate velocity magnitude from averaged values
        const velocityMagnitude = Math.sqrt(
            avgVelocityX * avgVelocityX + 
            avgVelocityY * avgVelocityY
        );
        
        // Only smack if moving fast enough (minimum threshold)
        const minVelocity = 2; // pixels per frame
        if (velocityMagnitude < minVelocity) return;
        
        mouseState.lastSmackTime = currentTime;
        
        console.log('🍑 SMACK! Velocity:', velocityMagnitude.toFixed(2), 
                    'Direction:', avgVelocityX.toFixed(1), avgVelocityY.toFixed(1));
        
        // Add smack animation to cursor
        if (handCursor) {
            handCursor.classList.remove('smacking');
            void handCursor.offsetWidth; // Trigger reflow
            handCursor.classList.add('smacking');
            setTimeout(() => handCursor.classList.remove('smacking'), 200);
        }
        
        // Convert 2D screen velocity to 3D world direction
        // Normalize the velocity to get direction
        const velocityDir = new THREE.Vector2(avgVelocityX, avgVelocityY).normalize();
        
        // Map screen space to world space direction
        // X: right is positive (keep as is)
        // Y: down is positive in screen space, but up is positive in 3D (invert)
        // Z: push towards camera for satisfying movement
        const direction = new THREE.Vector3(
            velocityDir.x,      // Horizontal movement matches screen
            -velocityDir.y,     // Vertical inverted (screen Y is flipped)
            0.4                 // Always push a bit toward camera for nice effect
        ).normalize();
        
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
        
        // Apply soft body impulse for jiggle effect at the intersection point
        const intersectPoint = intersects[0].point;
        const jiggleForce = 0.18 * velocityScale; // Force for vertex deformation
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
        // Check how close we are to settling
        const velocityLength = peachState.velocity.length();
        const angularVelLength = peachState.angularVelocity.length();
        const settleThreshold = 0.01;
        
        // Calculate blend factor for smooth transition to idle - synchronized with softbody lerping
        const blendStart = 0.15; // Start blending earlier when velocity < 0.15 (extended range)
        let idleBlend = 0;
        if (velocityLength < blendStart || angularVelLength < blendStart) {
            // Map velocity from [0, blendStart] to blend [1, 0]
            const velFactor = Math.max(velocityLength, angularVelLength);
            let t = 1.0 - (velFactor / blendStart);
            t = Math.max(0, Math.min(1, t));
            // Use same ease in-out curve as softbody for synchronized feel
            idleBlend = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
        }
        
        // Apply velocity
        peachGroup.position.add(peachState.velocity.clone().multiplyScalar(delta));
        
        // Apply angular velocity
        peachGroup.rotation.x += peachState.angularVelocity.x * delta;
        peachGroup.rotation.y += peachState.angularVelocity.y * delta;
        peachGroup.rotation.z += peachState.angularVelocity.z * delta;
        
        // Apply damping (increase damping as we blend to idle for smoother transition)
        const blendedDamping = damping - (idleBlend * 0.03); // Slightly more damping during transition
        const blendedAngularDamping = angularDamping - (idleBlend * 0.05);
        peachState.velocity.multiplyScalar(blendedDamping);
        peachState.angularVelocity.multiplyScalar(blendedAngularDamping);
        
        // Return to default position
        const toDefault = peachState.defaultPosition.clone().sub(peachGroup.position);
        peachState.velocity.add(toDefault.multiplyScalar(returnForce));
        
        // Return to default rotation gradually (faster as we approach idle)
        const rotationBlend = 0.05 + (idleBlend * 0.05);
        peachGroup.rotation.x += (peachState.defaultRotation.x - peachGroup.rotation.x) * rotationBlend;
        peachGroup.rotation.y += (peachState.defaultRotation.y - peachGroup.rotation.y) * rotationBlend;
        peachGroup.rotation.z += (peachState.defaultRotation.z - peachGroup.rotation.z) * rotationBlend;
        
        // Blend towards idle animation position as we settle (more gradual)
        if (idleBlend > 0) {
            const targetIdleY = Math.sin(idleTime * 1.5) * 0.2;
            const targetIdleRotY = Math.sin(idleTime * 0.5) * 0.3;
            
            // Gradually blend over time - use smaller multiplier for very subtle transition
            const blendStrength = idleBlend * 0.05;
            peachGroup.position.y += (targetIdleY - peachGroup.position.y) * blendStrength;
            peachGroup.rotation.y += (targetIdleRotY - peachGroup.rotation.y) * blendStrength;
        }
        
        // Check if peach has settled
        if (velocityLength < settleThreshold && angularVelLength < settleThreshold) {
            peachState.isWobbling = false;
            peachState.velocity.set(0, 0, 0);
            peachState.angularVelocity.set(0, 0, 0);
            // Position should already be very close to idle animation from blending
        }
    } else {
        // Idle floating animation
        peachGroup.position.y = Math.sin(idleTime * 1.5) * 0.2;
        peachGroup.rotation.y = Math.sin(idleTime * 0.5) * 0.3;
    }
}

