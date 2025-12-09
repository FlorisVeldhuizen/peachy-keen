# Using Peachy Keen in Your Project

This guide shows you how to use Peachy Keen in another Three.js project.

## What You Need

Copy these files to your project:

### Core Files (Required)
- `peachy-keen.js` - Main entry point
- `peach.js` - Peach model and visuals
- `interaction.js` - Mouse interaction and physics
- `lighting.js` - Scene lighting
- `audio.js` - Sound effects
- `performance.js` - Performance monitoring
- `softbody.js` - Soft body physics
- `particles.js` - Particle effects
- `shaders.js` - Shader materials (optional, for background)
- `scene.js` - Scene utilities (optional)
- `config.js` - Configuration constants
- `style.css` - Cursor styles (optional)

### Assets (Required)
- `public/assets/peachy.glb` - 3D peach model
- `public/assets/*.m4a` - Sound files

## Basic Usage

```javascript
import * as THREE from 'three';
import { createPeachyKeen } from './peachy-keen.js';

// Setup your Three.js scene
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });

// Create the peach
const peachy = createPeachyKeen({
    scene: scene,
    camera: camera,
    showLoadingUI: false, // Set to true if you want the default loading UI
    onLoad: () => {
        console.log('Peach loaded!');
    },
    onProgress: (percent, status) => {
        console.log(`Loading: ${percent}% - ${status}`);
    }
});

// Animation loop
const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);
    
    const delta = Math.min(clock.getDelta(), 0.1);
    
    // Update the peach
    peachy.update(delta);
    
    renderer.render(scene, camera);
}

animate();

// Enable audio after user interaction (required by browsers)
document.addEventListener('click', async () => {
    await peachy.enableAudio();
}, { once: true });
```

## Advanced Usage

### Custom Position/Scale

```javascript
const peachy = createPeachyKeen({ scene, camera });

// Move the peach
const group = peachy.getGroup();
group.position.set(2, 0, -5);
group.scale.set(1.5, 1.5, 1.5);
```

### Performance Monitoring

```javascript
const peachy = createPeachyKeen({ scene, camera });
const perfMonitor = peachy.getPerformanceMonitor();

// Check FPS
console.log('Current FPS:', perfMonitor.fps);

// Toggle features if performance is poor
if (perfMonitor.fps < 30) {
    perfMonitor.disableFeature('backgroundShader');
}
```

### Cleanup

```javascript
// When you're done with the peach
peachy.dispose();
```

## Configuration

Edit `config.js` to customize:
- Physics parameters
- Interaction settings
- Visual effects
- Performance thresholds

## Dependencies

Requires:
- Three.js (^0.159.0 or compatible)
- Browser with WebGL support

## Vite Configuration

If using Vite, make sure your `vite.config.js` includes:

```javascript
export default {
  base: './', // or your deployment path
  assetsInclude: ['**/*.glb', '**/*.m4a']
}
```

## Notes

- The peach requires user interaction for audio (browser policy)
- Assets are loaded from `import.meta.env.BASE_URL + 'assets/'`
- The peach responds to mouse hover and clicks
- Physics is optimized for 60 FPS but adapts to lower frame rates
- Includes rage mechanics - hit it too much and it explodes! 💥

## Example with Custom Loading

```javascript
const peachy = createPeachyKeen({
    scene,
    camera,
    showLoadingUI: false,
    onProgress: (percent, status) => {
        // Update your custom loading bar
        myLoadingBar.style.width = `${percent}%`;
        myLoadingText.textContent = status;
    },
    onLoad: () => {
        // Hide your loading screen
        myLoadingScreen.style.display = 'none';
    }
});
```

## Troubleshooting

**Peach doesn't load:**
- Check that asset paths are correct
- Make sure `import.meta.env.BASE_URL` points to the right directory
- Check browser console for 404 errors

**No sound:**
- Audio requires user interaction first
- Call `peachy.enableAudio()` after a click or touch event

**Poor performance:**
- The performance monitor auto-adjusts
- Manually disable features: `perfMonitor.disableFeature('backgroundShader')`
- Reduce scene complexity elsewhere

**Peach doesn't respond to mouse:**
- Make sure camera is passed to `createPeachyKeen()`
- Check that the scene contains the peach group
- Verify mouse events aren't being blocked by other elements



