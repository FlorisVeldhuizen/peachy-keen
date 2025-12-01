# Peachy Keen 🍑

An interactive Three.js experience featuring a 3D peach with a psychedelic shader background.

## Features

- Psychedelic animated shader background with optimized GLSL shaders
- Interactive 3D peach that wobbles when clicked
- Physics-based soft-body animation with jiggle effects
- Smooth floating idle animation
- Rage meter system - smack the peach too much and it explodes! 💥
- Particle explosion effects with physics
- Oil-up feature for extra shine
- Lazy-loaded audio for better performance
- Auto-loading progress screen with real-time status updates
- Loading items fade out to reveal minimal click-to-start button
- Scene renders immediately for instant visual feedback

## Performance

This project has been heavily optimized for production:
- ✨ **Tree-shaking** - 30-40% smaller bundle size
- 🚀 **Lazy loading** - Audio loads on first interaction
- ⚡ **Optimized shaders** - Improved GPU performance
- 📦 **Build optimization** - Minified with Terser, chunked for caching
- 🎨 **Loading screen** - Smooth user experience with progress feedback

See [PERFORMANCE.md](./PERFORMANCE.md) for detailed optimization guide.

## Setup

```bash
# Install dependencies
yarn install

# Run development server
yarn dev

# Build for production
yarn build
```

## How to Use

Simply click on the peach to smack it! It will wobble and spin before returning to its idle floating position.

## Technologies

- Three.js for 3D rendering
- Vite for development and building
- Custom GLSL shaders for the psychedelic background

