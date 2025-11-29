import * as THREE from 'three';

// Reaction-diffusion liquid background shader (window-filling)
export function createBackgroundMaterial() {
    return new THREE.ShaderMaterial({
        uniforms: {
            time: { value: 0 },
            resolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) }
        },
        vertexShader: `
            varying vec2 vUv;
            void main() {
                vUv = uv;
                gl_Position = vec4(position.xy, 0.0, 1.0);
            }
        `,
        fragmentShader: `
            uniform float time;
            uniform vec2 resolution;
            varying vec2 vUv;
            
            // Noise function for organic patterns
            float hash(vec2 p) {
                p = fract(p * vec2(123.34, 456.21));
                p += dot(p, p + 45.32);
                return fract(p.x * p.y);
            }
            
            float noise(vec2 p) {
                vec2 i = floor(p);
                vec2 f = fract(p);
                f = f * f * (3.0 - 2.0 * f);
                
                float a = hash(i);
                float b = hash(i + vec2(1.0, 0.0));
                float c = hash(i + vec2(0.0, 1.0));
                float d = hash(i + vec2(1.0, 1.0));
                
                return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
            }
            
            // HSL to RGB conversion
            vec3 hsl2rgb(vec3 hsl) {
                float h = hsl.x;
                float s = hsl.y;
                float l = hsl.z;
                
                float c = (1.0 - abs(2.0 * l - 1.0)) * s;
                float x = c * (1.0 - abs(mod(h * 6.0, 2.0) - 1.0));
                float m = l - c * 0.5;
                
                vec3 rgb;
                if (h < 1.0/6.0) rgb = vec3(c, x, 0.0);
                else if (h < 2.0/6.0) rgb = vec3(x, c, 0.0);
                else if (h < 3.0/6.0) rgb = vec3(0.0, c, x);
                else if (h < 4.0/6.0) rgb = vec3(0.0, x, c);
                else if (h < 5.0/6.0) rgb = vec3(x, 0.0, c);
                else rgb = vec3(c, 0.0, x);
                
                return rgb + m;
            }
            
            // Simplified reaction-diffusion pattern
            float reactionDiffusion(vec2 uv, float t) {
                // Multiple octaves for detail
                float scale1 = 3.0;
                float scale2 = 8.0;
                float scale3 = 15.0;
                
                // Slow-moving liquid flow
                vec2 flow1 = vec2(cos(t * 0.1), sin(t * 0.15)) * 0.3;
                vec2 flow2 = vec2(sin(t * 0.08), cos(t * 0.12)) * 0.5;
                
                // Layered noise for reaction-diffusion-like patterns
                float n1 = noise((uv + flow1) * scale1);
                float n2 = noise((uv + flow2) * scale2);
                float n3 = noise((uv - flow1 * 0.5) * scale3);
                
                // Create spots and patterns similar to reaction-diffusion
                float pattern = n1 * 0.6 + n2 * 0.25 + n3 * 0.15;
                
                // Add liquid-like threshold behavior
                pattern = smoothstep(0.4, 0.6, pattern);
                
                // Add some slow variation
                pattern += sin(t * 0.5 + uv.x * 2.0) * 0.05;
                pattern += cos(t * 0.3 + uv.y * 3.0) * 0.05;
                
                return pattern;
            }
            
            void main() {
                vec2 uv = vUv;
                
                // Calculate distance from center for radial gradient
                vec2 center = vec2(0.5, 0.5);
                float distFromCenter = length(uv - center);
                
                // Create smooth vignette effect (0 at center, 1 at edges)
                float vignette = smoothstep(0.0, 0.8, distFromCenter);
                
                // Create liquid simulation
                float liquid = reactionDiffusion(uv, time);
                
                // Slowly rotating hue (completes full cycle every ~60 seconds)
                float baseHue = mod(time * 0.017, 1.0);
                
                // Shift hue slightly toward purple/blue at edges for depth
                float hue = baseHue + vignette * 0.15;
                
                // Reduce saturation at edges (more gray/desaturated)
                float saturation = mix(0.35, 0.08, vignette);
                
                // Significantly darker at edges, brighter at center
                float centerBoost = 0.12; // Extra brightness at center
                float edgeDarkness = 0.05; // Very dark at edges
                float lightness1 = mix(centerBoost, edgeDarkness, vignette) + liquid * 0.02;
                float lightness2 = mix(centerBoost + 0.08, edgeDarkness + 0.03, vignette) + liquid * 0.04;
                
                // Create two colors with adjusted hue, saturation, and lightness
                vec3 color1 = hsl2rgb(vec3(hue, saturation, lightness1));
                vec3 color2 = hsl2rgb(vec3(hue, saturation, lightness2));
                
                // Mix colors based on liquid pattern
                vec3 finalColor = mix(color1, color2, liquid);
                
                // Add subtle iridescence, stronger at center
                float iridescent = sin(liquid * 3.14159 + time * 0.3) * 0.02 * (1.0 - vignette * 0.7);
                vec3 iridHsl = vec3(mod(baseHue + 0.5, 1.0), saturation * 1.5, 0.3);
                vec3 iridColor = hsl2rgb(iridHsl);
                finalColor += iridColor * iridescent;
                
                // Additional vignette darkening for strong focus
                finalColor *= (1.0 - vignette * 0.6);
                
                gl_FragColor = vec4(finalColor, 1.0);
            }
        `,
        depthTest: false,
        depthWrite: false
    });
}

