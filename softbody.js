import * as THREE from 'three';

/**
 * Soft Body Physics System for Jiggle Effects
 * Applies spring-mass dynamics to vertices for realistic deformation
 */

export class SoftBodyPhysics {
    constructor(mesh) {
        this.mesh = mesh;
        this.geometry = mesh.geometry.clone(); // Clone to avoid modifying original
        this.mesh.geometry = this.geometry; // Use the clone
        
        // Store original positions for spring rest state
        this.originalPositions = [];
        this.vertexVelocities = [];
        this.vertexForces = [];
        
        // CRITICAL: Group vertices at the same position together
        // This prevents tearing while preserving UVs and other attributes
        this.vertexGroups = []; // Maps each vertex to its group of duplicates
        
        // Physics parameters - tuned for subtle peachy jiggle!
        this.stiffness = 0.25;      // Spring stiffness (higher = less jiggly)
        this.damping = 0.88;        // Velocity damping (higher = less bouncy)
        this.mass = 1.0;            // Vertex mass
        this.propagation = 0.25;    // Force propagation to neighbors
        this.maxDisplacement = 0.15; // Maximum distance a vertex can move from original
        
        this.initialized = false;
        this.isActive = false;      // Only compute when needed
        this.activityTimer = 0;
        
        this.init();
    }
    init() {
        const positions = this.geometry.attributes.position;
        
        // Store original positions and initialize physics arrays
        for (let i = 0; i < positions.count; i++) {
            this.originalPositions.push(new THREE.Vector3(
                positions.getX(i),
                positions.getY(i),
                positions.getZ(i)
            ));
            this.vertexVelocities.push(new THREE.Vector3(0, 0, 0));
            this.vertexForces.push(new THREE.Vector3(0, 0, 0));
        }
        
        // Build vertex groups - vertices at the same position are grouped
        this.buildVertexGroups();
        
        // Build neighbor map for force propagation
        this.buildNeighborMap();
        
        this.initialized = true;
        console.log('✨ Soft body physics initialized for', positions.count, 'vertices');
    }
    
    buildVertexGroups() {
        // Group vertices that share the same position (within tolerance)
        const tolerance = 0.0001;
        const positions = this.geometry.attributes.position;
        const positionMap = new Map();
        
        // Initialize - each vertex starts in its own group
        for (let i = 0; i < positions.count; i++) {
            this.vertexGroups[i] = [i];
        }
        
        // Find vertices at the same position
        for (let i = 0; i < positions.count; i++) {
            const x = positions.getX(i);
            const y = positions.getY(i);
            const z = positions.getZ(i);
            
            // Create position key
            const key = 
                Math.round(x / tolerance) + '_' +
                Math.round(y / tolerance) + '_' +
                Math.round(z / tolerance);
            
            if (!positionMap.has(key)) {
                positionMap.set(key, [i]);
            } else {
                positionMap.get(key).push(i);
            }
        }
        
        // Build groups - all vertices at same position share the same group
        let groupCount = 0;
        for (const group of positionMap.values()) {
            if (group.length > 1) {
                groupCount++;
                // All vertices in this group reference the same array
                const sharedGroup = group;
                for (const vertexIndex of group) {
                    this.vertexGroups[vertexIndex] = sharedGroup;
                }
            }
        }
        
        console.log(`🔗 Found ${groupCount} vertex groups (duplicate positions that will move together)`);
    }
    
    buildNeighborMap() {
        // Build a map of neighboring vertices based on shared edges
        this.neighbors = new Map();
        const positions = this.geometry.attributes.position;
        const indices = this.geometry.index;
        
        if (!indices) {
            // No index buffer, use simple proximity-based neighbors
            this.buildProximityNeighbors();
            return;
        }
        
        // Build neighbor map from triangle indices
        for (let i = 0; i < indices.count; i += 3) {
            const a = indices.getX(i);
            const b = indices.getX(i + 1);
            const c = indices.getX(i + 2);
            
            this.addNeighbor(a, b);
            this.addNeighbor(a, c);
            this.addNeighbor(b, a);
            this.addNeighbor(b, c);
            this.addNeighbor(c, a);
            this.addNeighbor(c, b);
        }
        
        console.log('🔗 Built neighbor map for soft body physics');
    }
    
    buildProximityNeighbors() {
        // Fallback: use proximity-based neighbors
        const positions = this.geometry.attributes.position;
        const threshold = 0.3; // Distance threshold for neighbors
        
        for (let i = 0; i < positions.count; i++) {
            const neighbors = [];
            const pi = new THREE.Vector3(
                positions.getX(i),
                positions.getY(i),
                positions.getZ(i)
            );
            
            // Only check a subset to avoid O(n²) complexity
            const step = Math.max(1, Math.floor(positions.count / 100));
            for (let j = 0; j < positions.count; j += step) {
                if (i === j) continue;
                
                const pj = new THREE.Vector3(
                    positions.getX(j),
                    positions.getY(j),
                    positions.getZ(j)
                );
                
                if (pi.distanceTo(pj) < threshold) {
                    neighbors.push(j);
                }
            }
            
            if (neighbors.length > 0) {
                this.neighbors.set(i, neighbors);
            }
        }
    }
    
    addNeighbor(vertexIndex, neighborIndex) {
        if (!this.neighbors.has(vertexIndex)) {
            this.neighbors.set(vertexIndex, []);
        }
        const neighbors = this.neighbors.get(vertexIndex);
        if (!neighbors.includes(neighborIndex)) {
            neighbors.push(neighborIndex);
        }
    }
    
    applyImpulse(worldPoint, worldDirection, force) {
        // Apply an impulse at a specific point on the mesh
        // This creates the initial jiggle from the smack
        
        this.isActive = true;
        this.activityTimer = 2.5; // Stay active for 2.5 seconds
        
        // Transform world space to local space
        const localPoint = worldPoint.clone();
        this.mesh.worldToLocal(localPoint);
        
        const localDirection = worldDirection.clone()
            .transformDirection(this.mesh.matrixWorld.clone().invert());
        
        const positions = this.geometry.attributes.position;
        const impactRadius = 0.8; // Radius of impact effect (smaller = more localized)
        
        // Apply force to vertices near the impact point
        for (let i = 0; i < positions.count; i++) {
            const vertex = new THREE.Vector3(
                positions.getX(i),
                positions.getY(i),
                positions.getZ(i)
            );
            
            const distance = vertex.distanceTo(localPoint);
            
            if (distance < impactRadius) {
                // Falloff based on distance (closer = stronger)
                const falloff = 1.0 - (distance / impactRadius);
                const strength = force * falloff * falloff * falloff; // Cubic falloff for even softer impact
                
                // Add velocity in the impact direction
                const impulse = localDirection.clone().multiplyScalar(strength);
                this.vertexVelocities[i].add(impulse);
                
                // Clamp velocity to prevent explosion
                const maxVelocity = 0.5;
                if (this.vertexVelocities[i].length() > maxVelocity) {
                    this.vertexVelocities[i].normalize().multiplyScalar(maxVelocity);
                }
            }
        }
    }
    
    update(delta) {
        if (!this.initialized || !this.isActive) return;
        
        // Countdown activity timer
        this.activityTimer -= delta;
        if (this.activityTimer <= 0) {
            this.isActive = false;
            this.resetToOriginal();
            return;
        }
        
        const positions = this.geometry.attributes.position;
        
        // Reset forces
        for (let i = 0; i < this.vertexForces.length; i++) {
            this.vertexForces[i].set(0, 0, 0);
        }
        
        // Calculate spring forces (restore to original position)
        for (let i = 0; i < positions.count; i++) {
            const current = new THREE.Vector3(
                positions.getX(i),
                positions.getY(i),
                positions.getZ(i)
            );
            
            const original = this.originalPositions[i];
            
            // Spring force: F = -k * displacement
            const displacement = current.clone().sub(original);
            const springForce = displacement.multiplyScalar(-this.stiffness);
            
            this.vertexForces[i].add(springForce);
        }
        
        // Propagate forces to neighbors (creates wave effect)
        for (let i = 0; i < positions.count; i++) {
            if (!this.neighbors.has(i)) continue;
            
            const neighbors = this.neighbors.get(i);
            const current = new THREE.Vector3(
                positions.getX(i),
                positions.getY(i),
                positions.getZ(i)
            );
            
            for (const neighborIndex of neighbors) {
                const neighbor = new THREE.Vector3(
                    positions.getX(neighborIndex),
                    positions.getY(neighborIndex),
                    positions.getZ(neighborIndex)
                );
                
                // Force to align with neighbors (creates smooth waves)
                const diff = neighbor.clone().sub(current);
                const propagationForce = diff.multiplyScalar(this.propagation * 0.1);
                this.vertexForces[i].add(propagationForce);
            }
        }
        
        // Track which groups we've already processed
        const processedGroups = new Set();
        
        // Update velocities and positions
        for (let i = 0; i < positions.count; i++) {
            const group = this.vertexGroups[i];
            
            // If this vertex is part of a group with duplicates
            if (group.length > 1) {
                // Use the first vertex in the group as the representative
                const representative = group[0];
                
                // Only process each group once
                if (processedGroups.has(representative)) {
                    continue;
                }
                processedGroups.add(representative);
                
                // Average the forces from all vertices in the group
                const avgForce = new THREE.Vector3(0, 0, 0);
                for (const idx of group) {
                    avgForce.add(this.vertexForces[idx]);
                }
                avgForce.divideScalar(group.length);
                
                // Apply force: a = F / m
                const acceleration = avgForce.divideScalar(this.mass);
                
                // Update velocity for the group (use representative's velocity)
                this.vertexVelocities[representative].add(acceleration.multiplyScalar(delta * 60));
                
                // Apply damping
                this.vertexVelocities[representative].multiplyScalar(this.damping);
                
                // Clamp velocity
                const maxVelocity = 0.3;
                if (this.vertexVelocities[representative].length() > maxVelocity) {
                    this.vertexVelocities[representative].normalize().multiplyScalar(maxVelocity);
                }
                
                // Calculate new position for the group
                const currentPos = new THREE.Vector3(
                    positions.getX(representative),
                    positions.getY(representative),
                    positions.getZ(representative)
                );
                const newPos = currentPos.add(this.vertexVelocities[representative].clone().multiplyScalar(delta * 60));
                
                // Constrain position
                const displacement = newPos.clone().sub(this.originalPositions[representative]);
                const displacementLength = displacement.length();
                
                if (displacementLength > this.maxDisplacement) {
                    displacement.normalize().multiplyScalar(this.maxDisplacement);
                    newPos.copy(this.originalPositions[representative]).add(displacement);
                    this.vertexVelocities[representative].multiplyScalar(0.5);
                }
                
                // Apply the same position to ALL vertices in the group
                for (const idx of group) {
                    const offset = this.originalPositions[idx].clone().sub(this.originalPositions[representative]);
                    const finalPos = newPos.clone().add(offset);
                    positions.setXYZ(idx, finalPos.x, finalPos.y, finalPos.z);
                    // Sync velocities too
                    this.vertexVelocities[idx].copy(this.vertexVelocities[representative]);
                }
            } else {
                // Single vertex, process normally
                const acceleration = this.vertexForces[i].clone().divideScalar(this.mass);
                
                this.vertexVelocities[i].add(acceleration.multiplyScalar(delta * 60));
                this.vertexVelocities[i].multiplyScalar(this.damping);
                
                const maxVelocity = 0.3;
                if (this.vertexVelocities[i].length() > maxVelocity) {
                    this.vertexVelocities[i].normalize().multiplyScalar(maxVelocity);
                }
                
                const currentPos = new THREE.Vector3(
                    positions.getX(i),
                    positions.getY(i),
                    positions.getZ(i)
                );
                const newPos = currentPos.add(this.vertexVelocities[i].clone().multiplyScalar(delta * 60));
                
                const displacement = newPos.clone().sub(this.originalPositions[i]);
                const displacementLength = displacement.length();
                
                if (displacementLength > this.maxDisplacement) {
                    displacement.normalize().multiplyScalar(this.maxDisplacement);
                    newPos.copy(this.originalPositions[i]).add(displacement);
                    this.vertexVelocities[i].multiplyScalar(0.5);
                }
                
                positions.setXYZ(i, newPos.x, newPos.y, newPos.z);
            }
        }
        
        // Mark geometry as needing update
        positions.needsUpdate = true;
        this.geometry.computeVertexNormals(); // Recalculate normals for proper lighting
    }
    
    resetToOriginal() {
        // Smoothly reset vertices to original positions
        const positions = this.geometry.attributes.position;
        
        for (let i = 0; i < positions.count; i++) {
            const original = this.originalPositions[i];
            positions.setXYZ(i, original.x, original.y, original.z);
            this.vertexVelocities[i].set(0, 0, 0);
            this.vertexForces[i].set(0, 0, 0);
        }
        
        positions.needsUpdate = true;
        this.geometry.computeVertexNormals();
    }
    
    dispose() {
        this.originalPositions = [];
        this.vertexVelocities = [];
        this.vertexForces = [];
        this.neighbors.clear();
    }
}

