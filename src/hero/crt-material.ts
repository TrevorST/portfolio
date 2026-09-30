import * as THREE from 'three';

/**
 * CRT glass: barrel distortion, scanlines, vignette, a faint flicker, and the
 * classic power-on (a bright line that stretches wide, then opens vertically).
 * uPower 0 is off; 1 is fully on.
 */
export function crtMaterial(map: THREE.Texture): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      map: { value: map },
      uPower: { value: 0 },
      uTime: { value: 0 },
      uLines: { value: 400 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D map;
      uniform float uPower;
      uniform float uTime;
      uniform float uLines;
      varying vec2 vUv;

      vec2 barrel(vec2 uv) {
        vec2 c = uv * 2.0 - 1.0;
        c *= 1.0 + 0.02 * dot(c, c); // a flat panel, only a hint of curvature
        return c * 0.5 + 0.5;
      }

      void main() {
        vec2 uv = barrel(vUv);
        float inside = step(0.0, uv.x) * step(uv.x, 1.0) * step(0.0, uv.y) * step(uv.y, 1.0);

        vec2 d = uv - 0.5;
        float vig = smoothstep(0.78, 0.2, length(d * vec2(1.0, 1.15)));
        vec3 glass = vec3(0.010, 0.013, 0.010) + vec3(0.018, 0.026, 0.008) * vig;

        vec3 col = texture2D(map, uv).rgb;
        col *= 0.8 + 0.2 * sin(uv.y * uLines * 3.14159);   // scanlines
        col *= mix(0.5, 1.0, vig);                          // vignette
        col *= 0.975 + 0.025 * sin(uTime * 55.0);            // flicker

        // power-on: a line grows across, then the picture opens vertically
        float p1 = clamp(uPower * 2.0, 0.0, 1.0);
        float p2 = clamp(uPower * 2.0 - 1.0, 0.0, 1.0);
        float halfH = mix(0.004, 0.5, p2 * p2);
        float band = step(abs(uv.y - 0.5), halfH) * step(abs(uv.x - 0.5), 0.5 * p1);
        float flash = (1.0 - p2) * band * 1.6;
        vec3 lit = col * band + vec3(0.78, 1.0, 0.1) * flash;

        vec3 outCol = glass + (uPower > 0.001 ? lit : vec3(0.0));
        gl_FragColor = vec4(outCol * inside, 1.0);
      }
    `,
  });
}
