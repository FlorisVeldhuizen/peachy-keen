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
            particles: true,
            shadows: true
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
        this.ringLights = [];
        this.renderer = null;
        
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
        gearButton.className = 'perf-gear-btn';
        document.body.appendChild(gearButton);
        
        const panel = document.createElement('div');
        panel.id = 'performance-panel';
        panel.style.display = 'none'; // Start hidden
        panel.innerHTML = `
            <div class="perf-header">
                <h3>Performance Monitor</h3>
                <button id="perf-toggle" class="perf-collapse">×</button>
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
                    <label class="toggle-label">
                        <input type="checkbox" id="toggle-background" checked>
                        <span>Background Shader</span>
                    </label>
                    <label class="toggle-label">
                        <input type="checkbox" id="toggle-lights" checked>
                        <span>Ring Lights (24)</span>
                    </label>
                    <label class="toggle-label">
                        <input type="checkbox" id="toggle-physics" checked>
                        <span>Soft Body Physics</span>
                    </label>
                    <label class="toggle-label">
                        <input type="checkbox" id="toggle-particles" checked>
                        <span>Particles</span>
                    </label>
                    <label class="toggle-label">
                        <input type="checkbox" id="toggle-shadows" checked>
                        <span>Shadow Rendering</span>
                    </label>
                </div>
                
                <div class="perf-actions">
                    <button id="reset-metrics" class="perf-button">Reset Metrics</button>
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
        
        document.getElementById('toggle-shadows').addEventListener('change', (e) => {
            this.toggleFeature('shadows', e.target.checked);
        });
        
        // Reset metrics
        document.getElementById('reset-metrics').addEventListener('click', () => {
            this.resetMetrics();
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
                    this.backgroundMesh.visible = enabled;
                }
                console.log(`Background Shader: ${enabled ? 'ON' : 'OFF'}`);
                break;
                
            case 'ringLights':
                this.ringLights.forEach(light => {
                    light.visible = enabled;
                });
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
                
            case 'shadows':
                if (this.renderer) {
                    this.renderer.shadowMap.enabled = enabled;
                }
                console.log(`Shadows: ${enabled ? 'ON' : 'OFF'}`);
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
     * Set references to ring lights
     */
    setRingLights(lights) {
        this.ringLights = lights;
    }
    
    /**
     * Set reference to renderer
     */
    setRenderer(renderer) {
        this.renderer = renderer;
    }
    
    /**
     * Check if a feature is enabled
     */
    isFeatureEnabled(feature) {
        return this.features[feature];
    }
}
