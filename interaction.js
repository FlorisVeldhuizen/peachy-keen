import * as THREE from 'three';
import { playSmackSound } from './audio.js';
import { SoftBodyPhysics } from './softbody.js';
import { ParticleExplosion } from './particles.js';

// Physics and interaction state
export const peachState = {
    velocity: new THREE.Vector3(0, 0, 0),
    angularVelocity: new THREE.Vector3(0, 0, 0),
    physicsOffset: new THREE.Vector3(0, 0, 0), // Offset from default position due to physics
    physicsRotation: new THREE.Euler(0, 0, 0), // Rotation offset due to physics
    defaultPosition: new THREE.Vector3(0, 0, 0),
    defaultRotation: new THREE.Euler(0, 0, 0),
    isWobbling: false,
    softBodies: [], // Array of soft body physics instances for each mesh
    rageLevel: 0, // Builds up with each hit (0-100)
    rageDecayRate: 15, // Points per second that rage decays (even faster!)
    explosionThreshold: 100, // Rage level needed to trigger explosion
    particleExplosion: null, // Reference to particle explosion system
    isRespawning: false, // Is the peach currently respawning?
    respawnTimer: 0, // Timer for respawn animation
    respawnDuration: 1.5, // Duration of respawn animation in seconds
    idleAnimationTime: 0 // Separate time counter for idle animation (always running)
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
export function initInteraction(peachGroupRef, cameraRef, sceneRef) {
    peachGroup = peachGroupRef;
    camera = cameraRef;
    handCursor = document.getElementById('hand-cursor');
    
    // Initialize particle explosion system (will be set up once mesh is loaded)
    if (sceneRef) {
        // Store scene reference for later initialization
        peachState.sceneRef = sceneRef;
    }
    
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
    
    // Initialize particle explosion system with respawn callback
    if (peachState.sceneRef && !peachState.particleExplosion) {
        peachState.particleExplosion = new ParticleExplosion(meshArray, peachState.sceneRef, () => {
            // Callback when explosion is complete - spawn fresh peach
            console.log('🍑 Spawning fresh peach...');
            
            // Show meshes again
            meshArray.forEach(mesh => {
                mesh.visible = true;
            });
            
            // Start respawn animation
            peachState.isRespawning = true;
            peachState.respawnTimer = 0;
            
            // Reset soft body physics
            peachState.softBodies.forEach(softBody => {
                softBody.resetToOriginalImmediate();
            });
            
            // Reset physics state
            peachState.velocity.set(0, 0, 0);
            peachState.angularVelocity.set(0, 0, 0);
            peachState.physicsOffset.set(0, 0, 0);
            peachState.physicsRotation.set(0, 0, 0);
            peachState.isWobbling = false;
            // Don't reset idleAnimationTime here - let it continue running
            
            // Set initial state for animation (far away and small)
            if (peachGroup) {
                peachGroup.position.set(0, 0, -10); // Start far back
                peachGroup.rotation.set(0, 0, 0); // Start at 0 rotation
                peachGroup.scale.set(0.01, 0.01, 0.01); // Start tiny
            }
        });
        console.log('💥 Particle explosion system initialized');
    }
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
    
    // Can't slap during explosion or respawn!
    if (peachState.isRespawning) return;
    if (peachState.particleExplosion && peachState.particleExplosion.isActive()) return;
    
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
        // Keep idle animation running in the background
        
        // Apply soft body impulse for jiggle effect at the intersection point
        const intersectPoint = intersects[0].point;
        const jiggleForce = 0.18 * velocityScale; // Force for vertex deformation
        peachState.softBodies.forEach(softBody => {
            softBody.applyImpulse(intersectPoint, direction.clone(), jiggleForce);
        });
        
        // Sound intensity based on velocity
        const intensity = Math.min(0.4 + velocityMagnitude / 30, 1.0);
        playSmackSound(intensity);
        
        // Increase rage level based on hit intensity (even smaller increases now!)
        const rageIncrease = 4 + (velocityScale * 3);
        peachState.rageLevel = Math.min(100, peachState.rageLevel + rageIncrease);
        console.log(`🍑 Peach-O-Meter: ${peachState.rageLevel.toFixed(1)}/100`);
        
        // Update rage meter UI
        updateRageMeter();
        
        // Trigger explosion if rage threshold is reached
        if (peachState.rageLevel >= peachState.explosionThreshold && peachState.particleExplosion) {
            if (!peachState.particleExplosion.isActive()) {
                console.log('💥💥💥 RAGE EXPLOSION! 💥💥💥');
                peachState.particleExplosion.explode();
                peachState.rageLevel = 0; // Reset rage after explosion
                updateRageMeter();
            }
        }
    }
}

/**
 * Update the rage meter UI
 */
function updateRageMeter() {
    const rageMeter = document.getElementById('rage-meter-fill');
    const rageContainer = document.getElementById('rage-meter-container');
    
    if (rageMeter && rageContainer) {
        rageMeter.style.width = `${peachState.rageLevel}%`;
        
        // Change color based on rage level
        if (peachState.rageLevel < 33) {
            rageMeter.style.background = 'linear-gradient(90deg, #4CAF50, #8BC34A)';
        } else if (peachState.rageLevel < 66) {
            rageMeter.style.background = 'linear-gradient(90deg, #FF9800, #FFC107)';
        } else {
            rageMeter.style.background = 'linear-gradient(90deg, #F44336, #FF5722)';
            // Add pulsing effect when high rage
            rageMeter.style.animation = 'rage-pulse 0.5s infinite';
        }
        
        // Show container when rage > 0
        if (peachState.rageLevel > 0) {
            rageContainer.style.opacity = '1';
        } else {
            rageContainer.style.opacity = '0';
        }
    }
}

// Update peach physics
export function updatePeachPhysics(delta, idleTime) {
    if (!peachGroup) return;
    
    // Always update idle animation time (runs continuously as base layer)
    peachState.idleAnimationTime += delta;
    
    // Update particle explosion if active
    if (peachState.particleExplosion) {
        peachState.particleExplosion.update(delta);
        
        // Skip normal physics during explosion
        if (peachState.particleExplosion.isActive()) {
            return;
        }
    }
    
    // Handle respawn animation
    if (peachState.isRespawning) {
        peachState.respawnTimer += delta;
        
        // Calculate progress (0 to 1)
        let progress = Math.min(1.0, peachState.respawnTimer / peachState.respawnDuration);
        
        // Ease out cubic for smooth deceleration
        progress = 1 - Math.pow(1 - progress, 3);
        
        // Animate position (from far back to center)
        const startZ = -10;
        const endZ = peachState.defaultPosition.z;
        peachGroup.position.z = startZ + (endZ - startZ) * progress;
        peachGroup.position.x = peachState.defaultPosition.x;
        peachGroup.position.y = peachState.defaultPosition.y;
        
        // Animate scale (from tiny to normal size)
        const scale = 0.01 + (1.0 - 0.01) * progress;
        peachGroup.scale.set(scale, scale, scale);
        
        // Spin slows down and ends at rotation 0 (matching idle animation start)
        const remainingSpin = (1 - progress);
        peachGroup.rotation.x = peachState.defaultRotation.x;
        peachGroup.rotation.y = remainingSpin * Math.PI * 2;
        peachGroup.rotation.z = peachState.defaultRotation.z;
        
        // Check if animation is complete
        if (progress >= 1.0) {
            peachState.isRespawning = false;
            peachGroup.scale.set(1, 1, 1); // Ensure exact final scale
            // Reset idle animation so it starts from 0 (facing forward)
            peachState.idleAnimationTime = 0;
            console.log('✨ Fresh peach ready!');
        }
        
        return; // Skip normal physics during respawn
    }
    
    // Decay rage level over time
    if (peachState.rageLevel > 0) {
        peachState.rageLevel = Math.max(0, peachState.rageLevel - peachState.rageDecayRate * delta);
        updateRageMeter();
    }
    
    // Update soft body physics (jiggle)
    peachState.softBodies.forEach(softBody => {
        softBody.update(delta);
    });
    
    // If wobbling, update physics offset
    if (peachState.isWobbling) {
        const velocityLength = peachState.velocity.length();
        const angularVelLength = peachState.angularVelocity.length();
        const settleThreshold = 0.01;
        
        // Apply velocity to physics offset
        peachState.physicsOffset.add(peachState.velocity.clone().multiplyScalar(delta));
        
        // Apply angular velocity to physics rotation
        peachState.physicsRotation.x += peachState.angularVelocity.x * delta;
        peachState.physicsRotation.y += peachState.angularVelocity.y * delta;
        peachState.physicsRotation.z += peachState.angularVelocity.z * delta;
        
        // Apply damping
        peachState.velocity.multiplyScalar(damping);
        peachState.angularVelocity.multiplyScalar(angularDamping);
        
        // Return force pulls physics offset back to zero
        const toDefault = peachState.physicsOffset.clone().multiplyScalar(-returnForce);
        peachState.velocity.add(toDefault);
        
        // Return to default rotation gradually
        peachState.physicsRotation.x += (0 - peachState.physicsRotation.x) * 0.05;
        peachState.physicsRotation.y += (0 - peachState.physicsRotation.y) * 0.05;
        peachState.physicsRotation.z += (0 - peachState.physicsRotation.z) * 0.05;
        
        // Check if peach has settled
        if (velocityLength < settleThreshold && angularVelLength < settleThreshold) {
            peachState.isWobbling = false;
            peachState.velocity.set(0, 0, 0);
            peachState.angularVelocity.set(0, 0, 0);
            peachState.physicsOffset.set(0, 0, 0);
            peachState.physicsRotation.set(0, 0, 0);
        }
    }
    
    // ALWAYS apply idle animation as base layer
    const idleY = Math.sin(peachState.idleAnimationTime * 1.5) * 0.2;
    const idleRotY = Math.sin(peachState.idleAnimationTime * 0.5) * 0.3;
    
    // Apply: default + idle + physics offset
    peachGroup.position.x = peachState.defaultPosition.x + peachState.physicsOffset.x;
    peachGroup.position.y = peachState.defaultPosition.y + idleY + peachState.physicsOffset.y;
    peachGroup.position.z = peachState.defaultPosition.z + peachState.physicsOffset.z;
    
    peachGroup.rotation.x = peachState.defaultRotation.x + peachState.physicsRotation.x;
    peachGroup.rotation.y = peachState.defaultRotation.y + idleRotY + peachState.physicsRotation.y;
    peachGroup.rotation.z = peachState.defaultRotation.z + peachState.physicsRotation.z;
}

