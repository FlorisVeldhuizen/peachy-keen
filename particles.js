import * as THREE from 'three';

/**
 * Particle Explosion System
 * When the peach takes too much damage, it explodes into particles
 * that dramatically scatter and then slowly reform
 */

export class ParticleExplosion {
    constructor(mesh, scene, onComplete) {
        this.originalMesh = mesh;
        this.scene = scene;
        this.onComplete = onComplete; // Callback when explosion finishes
        this.particles = [];
        this.isExploding = false;
        this.explosionTimer = 0;
        this.explosionForce = 8.0;
        this.fallDuration = 4.0; // seconds for particles to fall
        
        // Particle geometry and material
        this.particleGeometry = new THREE.SphereGeometry(0.05, 8, 8);
        this.particleMaterial = new THREE.MeshStandardMaterial({
            color: 0xffb347,
            roughness: 0.7,
            metalness: 0.0,
            emissive: 0xff4400,
            emissiveIntensity: 0.3
        });
        
        // Group to hold all particles
        this.particleGroup = new THREE.Group();
        this.scene.add(this.particleGroup);
        
        // Track original vertices for reformation
        this.originalVertices = [];
        this.particleTargets = [];
    }
    
    /**
     * Trigger the explosion effect
     */
    explode() {
        if (this.isExploding) return; // Already exploding
        
        console.log('💥 PEACH EXPLOSION TRIGGERED!');
        
        this.isExploding = true;
        this.explosionTimer = 0;
        
        // Hide the original mesh
        this.originalMesh.forEach(mesh => {
            mesh.visible = false;
        });
        
        // Clear any existing particles
        this.clearParticles();
        
        // Create particles from mesh vertices
        this.createParticlesFromMesh();
        
        // Apply explosion forces
        this.applyExplosionForces();
    }
    
    /**
     * Create particles from the mesh geometry
     */
    createParticlesFromMesh() {
        // Sample vertices from the mesh (not all, for performance)
        const meshArray = Array.isArray(this.originalMesh) ? this.originalMesh : [this.originalMesh];
        
        meshArray.forEach(mesh => {
            const geometry = mesh.geometry;
            const positions = geometry.attributes.position;
            
            // Sample every Nth vertex to create particles
            const samplingRate = Math.max(1, Math.floor(positions.count / 300)); // ~300 particles max
            
            for (let i = 0; i < positions.count; i += samplingRate) {
                const vertex = new THREE.Vector3(
                    positions.getX(i),
                    positions.getY(i),
                    positions.getZ(i)
                );
                
                // Transform to world space
                vertex.applyMatrix4(mesh.matrixWorld);
                
                // Create particle
                const particle = new THREE.Mesh(this.particleGeometry, this.particleMaterial.clone());
                particle.position.copy(vertex);
                
                // Store physics data
                particle.userData.velocity = new THREE.Vector3(0, 0, 0);
                particle.userData.originalPosition = vertex.clone();
                particle.userData.targetPosition = vertex.clone();
                
                this.particleGroup.add(particle);
                this.particles.push(particle);
            }
        });
        
        console.log(`💥 Created ${this.particles.length} explosion particles`);
    }
    
    /**
     * Apply outward explosion forces to all particles
     */
    applyExplosionForces() {
        // Calculate center of explosion (average position)
        const center = new THREE.Vector3(0, 0, 0);
        this.particles.forEach(particle => {
            center.add(particle.position);
        });
        center.divideScalar(this.particles.length);
        
        // Apply forces radiating outward from center
        this.particles.forEach(particle => {
            // Direction from center to particle
            const direction = particle.position.clone().sub(center).normalize();
            
            // Add some randomness for chaotic effect
            direction.x += (Math.random() - 0.5) * 0.5;
            direction.y += (Math.random() - 0.5) * 0.5;
            direction.z += (Math.random() - 0.5) * 0.5;
            direction.normalize();
            
            // Random force magnitude
            const forceMagnitude = this.explosionForce * (0.7 + Math.random() * 0.6);
            
            // Set initial velocity
            particle.userData.velocity.copy(direction).multiplyScalar(forceMagnitude);
            
            // Add slight upward bias for dramatic effect
            particle.userData.velocity.y += 2.0;
            
            // Random rotation for visual interest
            particle.rotation.set(
                Math.random() * Math.PI,
                Math.random() * Math.PI,
                Math.random() * Math.PI
            );
            particle.userData.angularVelocity = new THREE.Vector3(
                (Math.random() - 0.5) * 10,
                (Math.random() - 0.5) * 10,
                (Math.random() - 0.5) * 10
            );
        });
    }
    
    /**
     * Update particle physics - particles fall and disappear
     */
    update(delta) {
        if (!this.isExploding) return;
        
        this.explosionTimer += delta;
        
        // Calculate fade progress (starts after particles have fallen)
        const fadeStartTime = 2.5;
        let fadeProgress = 0;
        if (this.explosionTimer > fadeStartTime) {
            fadeProgress = Math.min(1.0, (this.explosionTimer - fadeStartTime) / 1.5);
        }
        
        // Update each particle
        this.particles.forEach(particle => {
            const velocity = particle.userData.velocity;
            
            // Apply gravity (stronger than before)
            velocity.y -= 15.0 * delta;
            
            // Air resistance
            velocity.x *= 0.99;
            velocity.z *= 0.99;
            
            // Update position
            particle.position.add(velocity.clone().multiplyScalar(delta));
            
            // Update rotation
            const angularVel = particle.userData.angularVelocity;
            particle.rotation.x += angularVel.x * delta;
            particle.rotation.y += angularVel.y * delta;
            particle.rotation.z += angularVel.z * delta;
            
            // Slow down rotation over time
            angularVel.multiplyScalar(0.98);
            
            // Pulse emissive intensity during explosion
            if (fadeProgress === 0) {
                particle.material.emissiveIntensity = 0.3 + Math.sin(this.explosionTimer * 10) * 0.2;
            } else {
                // Fade out particles
                const fadeAmount = 1.0 - fadeProgress;
                particle.scale.setScalar(fadeAmount);
                particle.material.opacity = fadeAmount;
                particle.material.transparent = true;
                particle.material.emissiveIntensity = 0.3 * fadeAmount;
            }
        });
        
        // Check if explosion is complete
        if (this.explosionTimer >= this.fallDuration) {
            this.finishExplosion();
        }
    }
    
    /**
     * Complete the explosion and trigger respawn
     */
    finishExplosion() {
        console.log('✨ Explosion complete - spawning fresh peach!');
        
        // Clear particles
        this.clearParticles();
        
        this.isExploding = false;
        this.explosionTimer = 0;
        
        // Trigger callback to spawn fresh peach
        if (this.onComplete) {
            this.onComplete();
        }
    }
    
    /**
     * Clear all particles from the scene
     */
    clearParticles() {
        this.particles.forEach(particle => {
            this.particleGroup.remove(particle);
            particle.geometry.dispose();
            particle.material.dispose();
        });
        this.particles = [];
    }
    
    /**
     * Check if currently exploding
     */
    isActive() {
        return this.isExploding;
    }
    
    /**
     * Cleanup
     */
    dispose() {
        this.clearParticles();
        this.scene.remove(this.particleGroup);
    }
}

