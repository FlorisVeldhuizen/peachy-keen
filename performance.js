/**
 * Performance Monitoring and Control System
 * Tracks FPS and allows toggling of performance-heavy features
 */

export class PerformanceMonitor {
    constructor() {
        this.fps = 0;
        this.frameCount = 0;
        this.lastTime = performance.now();
        this.fpsUpdateInterval = 0.5; // Update FPS display every 0.5 seconds
        this.fpsAccumulator = 0;
        
        // Feature toggles
        this.features = {
            backgroundShader: true,
            ringLights: true,
            softBodyPhysics: true,
            particles: true
        };
        
        // Performance metrics
        this.metrics = {
            avgFps: 0,
            minFps: Infinity,
            maxFps: 0,
            frameTime: 0
        };
        
        // References to scene objects (set externally)
        this.backgroundMesh = null;
        this.animatedBackgroundMaterial = null;
        this.gradientBackgroundMaterial = null;
        this.ringLights = [];
        this.renderer = null;
        this.scene = null;
        
        // Ring light configuration
        this.ringLightCount = 6; // Start in normal mode (6 lights)
        this.ringLightMesh = null; // The physical torus mesh
        this.ringPointLights = []; // Just the point lights (not the mesh)
        this.isOiledMode = false; // Track current lighting mode
        this.maxLightsNormalMode = 6;  // Match LIGHTING_CONFIG.NORMAL_MODE_LIGHTS
        this.maxLightsOiledMode = 24;  // Match LIGHTING_CONFIG.OILED_MODE_LIGHTS
        
        this.createUI();
    }
    
    /**
     * Create the performance monitoring UI
     */
    createUI() {
        // Create gear icon button (visible when panel is collapsed)
        const gearButton = document.createElement('button');
        gearButton.id = 'perf-gear-button';
        gearButton.innerHTML = '⚙️';
        gearButton.className = 'perf-gear-btn interactive-element';
        document.body.appendChild(gearButton);
        
        const panel = document.createElement('div');
        panel.id = 'performance-panel';
        panel.style.display = 'none'; // Start hidden
        panel.innerHTML = `
            <div class="perf-header">
                <h3>Performance Monitor</h3>
                <button id="perf-toggle" class="perf-collapse interactive-element">×</button>
            </div>
            <div class="perf-content">
                <div class="perf-stats">
                    <div class="stat-row">
                        <span class="stat-label">FPS:</span>
                        <span id="fps-display" class="stat-value">60</span>
                    </div>
                    <div class="stat-row">
                        <span class="stat-label">Frame Time:</span>
                        <span id="frametime-display" class="stat-value">16.7ms</span>
                    </div>
                    <div class="stat-row">
                        <span class="stat-label">Min FPS:</span>
                        <span id="minfps-display" class="stat-value">60</span>
                    </div>
                    <div class="stat-row">
                        <span class="stat-label">Max FPS:</span>
                        <span id="maxfps-display" class="stat-value">60</span>
                    </div>
                </div>
                
                <div class="perf-controls">
                    <h4>Feature Toggles</h4>
                    <label class="toggle-label interactive-element">
                        <input type="checkbox" id="toggle-background" checked>
                        <span>Background Shader</span>
                    </label>
                    <label class="toggle-label interactive-element">
                        <input type="checkbox" id="toggle-lights" checked>
                        <span>Ring Lights</span>
                    </label>
                    <div class="slider-control">
                        <label class="slider-label interactive-element">
                            <span>Light Count: <span id="light-count-value">6</span> <span id="light-mode-indicator">(Normal Mode)</span></span>
                            <input type="range" id="light-count-slider" min="0" max="6" value="6" step="1" class="interactive-element">
                        </label>
                    </div>
                    <label class="toggle-label interactive-element">
                        <input type="checkbox" id="toggle-physics" checked>
                        <span>Soft Body Physics</span>
                    </label>
                    <label class="toggle-label interactive-element">
                        <input type="checkbox" id="toggle-particles" checked>
                        <span>Particles</span>
                    </label>
                </div>
                
                <div class="perf-actions">
                    <button id="reset-metrics" class="perf-button interactive-element">Reset Metrics</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(panel);
        
        // Setup event listeners
        this.setupEventListeners();
    }
    
    /**
     * Setup event listeners for UI controls
     */
    setupEventListeners() {
        const panel = document.getElementById('performance-panel');
        const gearButton = document.getElementById('perf-gear-button');
        const toggleBtn = document.getElementById('perf-toggle');
        const content = document.querySelector('.perf-content');
        
        // Gear button opens the panel
        gearButton.addEventListener('click', () => {
            panel.style.display = 'block';
            gearButton.style.display = 'none';
            content.style.display = 'block';
        });
        
        // Close button hides the panel and shows gear button
        toggleBtn.addEventListener('click', () => {
            panel.style.display = 'none';
            gearButton.style.display = 'block';
            content.style.display = 'none';
        });
        
        // Feature toggles
        document.getElementById('toggle-background').addEventListener('change', (e) => {
            this.toggleFeature('backgroundShader', e.target.checked);
        });
        
        document.getElementById('toggle-lights').addEventListener('change', (e) => {
            this.toggleFeature('ringLights', e.target.checked);
        });
        
        document.getElementById('toggle-physics').addEventListener('change', (e) => {
            this.toggleFeature('softBodyPhysics', e.target.checked);
        });
        
        document.getElementById('toggle-particles').addEventListener('change', (e) => {
            this.toggleFeature('particles', e.target.checked);
        });
        
        // Reset metrics button
        document.getElementById('reset-metrics').addEventListener('click', () => {
            this.resetMetrics();
        });
        
        // Light count slider
        document.getElementById('light-count-slider').addEventListener('input', (e) => {
            this.adjustLightCount(parseInt(e.target.value));
        });
    }
    
    /**
     * Toggle a performance feature on/off
     */
    toggleFeature(feature, enabled) {
        this.features[feature] = enabled;
        
        switch(feature) {
            case 'backgroundShader':
                if (this.backgroundMesh) {
                    // Switch between animated and gradient background
                    if (enabled && this.animatedBackgroundMaterial) {
                        this.backgroundMesh.material = this.animatedBackgroundMaterial;
                    } else if (!enabled && this.gradientBackgroundMaterial) {
                        this.backgroundMesh.material = this.gradientBackgroundMaterial;
                    }
                }
                console.log(`Background Shader: ${enabled ? 'Animated' : 'Gradient'}`);
                break;
                
            case 'ringLights':
                this.ringLights.forEach(light => {
                    light.visible = enabled;
                });
                
                // Enable/disable the slider based on ring lights state
                const slider = document.getElementById('light-count-slider');
                if (slider) {
                    slider.disabled = !enabled;
                }
                
                console.log(`Ring Lights: ${enabled ? 'ON' : 'OFF'}`);
                break;
                
            case 'softBodyPhysics':
                // This will be checked in the physics update loop
                console.log(`Soft Body Physics: ${enabled ? 'ON' : 'OFF'}`);
                break;
                
            case 'particles':
                // This will be checked in the particle update loop
                console.log(`Particles: ${enabled ? 'ON' : 'OFF'}`);
                break;
        }
    }
    
    /**
     * Update FPS and performance metrics
     */
    update() {
        const currentTime = performance.now();
        const deltaTime = (currentTime - this.lastTime) / 1000; // Convert to seconds
        
        // Calculate instantaneous FPS
        const instantFps = 1 / deltaTime;
        
        // Update metrics
        this.metrics.frameTime = deltaTime * 1000; // Convert to ms
        this.metrics.minFps = Math.min(this.metrics.minFps, instantFps);
        this.metrics.maxFps = Math.max(this.metrics.maxFps, instantFps);
        
        // Accumulate for average
        this.fpsAccumulator += deltaTime;
        this.frameCount++;
        
        // Update FPS display periodically
        if (this.fpsAccumulator >= this.fpsUpdateInterval) {
            this.fps = this.frameCount / this.fpsAccumulator;
            this.metrics.avgFps = this.fps;
            
            // Update UI
            this.updateUI();
            
            // Reset accumulators
            this.frameCount = 0;
            this.fpsAccumulator = 0;
        }
        
        this.lastTime = currentTime;
    }
    
    /**
     * Update the UI display with current metrics
     */
    updateUI() {
        const fpsDisplay = document.getElementById('fps-display');
        const frameTimeDisplay = document.getElementById('frametime-display');
        const minFpsDisplay = document.getElementById('minfps-display');
        const maxFpsDisplay = document.getElementById('maxfps-display');
        
        if (fpsDisplay) {
            // Color code FPS: green > 50, yellow > 30, red <= 30
            const fps = Math.round(this.fps);
            fpsDisplay.textContent = fps;
            fpsDisplay.className = 'stat-value';
            if (fps > 50) {
                fpsDisplay.classList.add('good');
            } else if (fps > 30) {
                fpsDisplay.classList.add('warning');
            } else {
                fpsDisplay.classList.add('bad');
            }
        }
        
        if (frameTimeDisplay) {
            frameTimeDisplay.textContent = this.metrics.frameTime.toFixed(2) + 'ms';
        }
        
        if (minFpsDisplay) {
            const minFps = Math.round(this.metrics.minFps);
            minFpsDisplay.textContent = minFps === Infinity ? '--' : minFps;
        }
        
        if (maxFpsDisplay) {
            maxFpsDisplay.textContent = Math.round(this.metrics.maxFps);
        }
    }
    
    /**
     * Reset performance metrics
     */
    resetMetrics() {
        this.metrics.minFps = Infinity;
        this.metrics.maxFps = 0;
        this.frameCount = 0;
        this.fpsAccumulator = 0;
        console.log('Performance metrics reset');
    }
    
    /**
     * Set reference to background mesh
     */
    setBackgroundMesh(mesh) {
        this.backgroundMesh = mesh;
    }
    
    /**
     * Set references to both background materials
     */
    setBackgroundMaterials(animatedMaterial, gradientMaterial) {
        this.animatedBackgroundMaterial = animatedMaterial;
        this.gradientBackgroundMaterial = gradientMaterial;
    }
    
    /**
     * Set references to ring lights
     */
    setRingLights(lights) {
        this.ringLights = lights;
        // Separate the mesh from the point lights
        // First element is the torus mesh, rest are point lights
        if (lights.length > 0) {
            this.ringLightMesh = lights[0]; // The torus mesh
            this.ringPointLights = lights.slice(1); // All the point lights
            this.ringLightCount = this.ringPointLights.length;
        }
    }
    
    /**
     * Set reference to renderer
     */
    setRenderer(renderer) {
        this.renderer = renderer;
    }
    
    /**
     * Set reference to scene
     */
    setScene(scene) {
        this.scene = scene;
    }
    
    /**
     * Adjust the number of ring lights
     */
    adjustLightCount(newCount) {
        if (!this.scene) {
            console.warn('Scene not set, cannot adjust lights');
            return;
        }
        
        // Update display
        const countDisplay = document.getElementById('light-count-value');
        if (countDisplay) {
            countDisplay.textContent = newCount;
        }
        
        const currentCount = this.ringPointLights.length;
        const ringRadius = 3.5;
        const zPosition = 6;
        
        // Import PointLight dynamically
        import('three').then(({ PointLight }) => {
            if (newCount > currentCount) {
                // Add more lights
                for (let i = currentCount; i < newCount; i++) {
                    const angle = (i / newCount) * Math.PI * 2;
                    const x = Math.cos(angle) * ringRadius;
                    const y = Math.sin(angle) * ringRadius;
                    
                    const light = new PointLight(0xffd9a8, 1.5, 100);
                    light.position.set(x, y, zPosition);
                    this.scene.add(light);
                    this.ringPointLights.push(light);
                    this.ringLights.push(light);
                }
            } else if (newCount < currentCount) {
                // Remove lights
                const lightsToRemove = currentCount - newCount;
                for (let i = 0; i < lightsToRemove; i++) {
                    const light = this.ringPointLights.pop();
                    if (light) {
                        this.scene.remove(light);
                        // Remove from ringLights array too
                        const index = this.ringLights.indexOf(light);
                        if (index > -1) {
                            this.ringLights.splice(index, 1);
                        }
                    }
                }
            }
            
            // Redistribute remaining lights evenly around the circle
            for (let i = 0; i < this.ringPointLights.length; i++) {
                const angle = (i / this.ringPointLights.length) * Math.PI * 2;
                const x = Math.cos(angle) * ringRadius;
                const y = Math.sin(angle) * ringRadius;
                this.ringPointLights[i].position.set(x, y, zPosition);
            }
            
            this.ringLightCount = newCount;
        });
    }
    
    /**
     * Check if a feature is enabled
     */
    isFeatureEnabled(feature) {
        return this.features[feature];
    }
    
    /**
     * Update lighting mode and adjust slider range accordingly
     * @param {boolean} isOiled - Whether oiled mode is active
     */
    setLightingMode(isOiled) {
        this.isOiledMode = isOiled;
        
        const slider = document.getElementById('light-count-slider');
        const indicator = document.getElementById('light-mode-indicator');
        const countDisplay = document.getElementById('light-count-value');
        
        if (!slider) return;
        
        // Set slider to the actual number of lights for this mode
        const targetLights = isOiled ? this.maxLightsOiledMode : this.maxLightsNormalMode;
        
        // Update slider max
        slider.max = targetLights;
        
        // Update slider value to match the active light count
        slider.value = targetLights;
        if (countDisplay) {
            countDisplay.textContent = targetLights;
        }
        
        // Actually adjust the lights in the scene
        this.adjustLightCount(targetLights);
        
        // Update mode indicator
        if (indicator) {
            indicator.textContent = isOiled ? '(Oiled Mode)' : '(Normal Mode)';
        }
        
        console.log(`🎚️ Light slider updated: ${targetLights} lights (${isOiled ? 'Oiled' : 'Normal'} Mode)`);
    }
}
