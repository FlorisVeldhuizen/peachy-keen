import * as THREE from 'three';

/**
 * Create the animated background shader material
 * @returns {THREE.ShaderMaterial} The background shader material
 */
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
                float vignette = smoothstep(0.0, 0.9, distFromCenter);
                
                // Flowing plasma-like effect (Balatro style)
                vec2 flow1 = uv + vec2(sin(time * 0.3 + uv.y * 3.0), cos(time * 0.2 + uv.x * 3.0)) * 0.2;
                vec2 flow2 = uv + vec2(cos(time * 0.25 + uv.y * 4.0), sin(time * 0.35 + uv.x * 4.0)) * 0.15;
                vec2 flow3 = uv + vec2(sin(time * 0.4 - uv.x * 2.0), cos(time * 0.3 - uv.y * 2.0)) * 0.25;
                
                // Multiple layers of flowing noise
                float n1 = noise(flow1 * 4.0);
                float n2 = noise(flow2 * 6.0);
                float n3 = noise(flow3 * 3.0);
                
                // Combine noise layers for plasma effect
                float plasma = (n1 * 0.5 + n2 * 0.3 + n3 * 0.2);
                plasma = pow(plasma, 1.5); // Enhance contrast
                
                // Create liquid simulation for additional detail
                float liquid = reactionDiffusion(uv, time);
                
                // Slowly rotating hue with plasma influence
                float baseHue = mod(time * 0.02, 1.0);
                float hue = baseHue + plasma * 0.25 + liquid * 0.1;
                
                // Higher saturation for vibey feel
                float saturation = mix(0.6, 0.3, vignette);
                saturation += plasma * 0.2;
                
                // Brighter overall with plasma influence
                float centerBoost = 0.20;
                float edgeDarkness = 0.08;
                float lightness = mix(centerBoost, edgeDarkness, vignette);
                lightness += plasma * 0.15 + liquid * 0.05;
                
                // Create main color
                vec3 color1 = hsl2rgb(vec3(hue, saturation, lightness));
                vec3 color2 = hsl2rgb(vec3(hue + 0.1, saturation * 0.9, lightness * 0.8));
                
                // Mix colors based on plasma
                vec3 finalColor = mix(color1, color2, plasma);
                
                // Add complementary color accents
                float accentHue = mod(hue + 0.5, 1.0);
                vec3 accentColor = hsl2rgb(vec3(accentHue, saturation * 0.8, lightness * 0.6));
                finalColor = mix(finalColor, accentColor, liquid * 0.15);
                
                // Smooth glow at center
                float glow = smoothstep(0.5, 0.0, distFromCenter) * 0.15;
                finalColor += glow;
                
                // Vignette for focus
                finalColor *= (1.0 - vignette * 0.5);
                
                gl_FragColor = vec4(finalColor, 1.0);
            }
        `,
        depthTest: false,
        depthWrite: false
    });
}

