import { useEffect, useRef } from "react";
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";

/**
 * Volumetric energy orb (raymarched fractal in a sphere).
 * Ported from Alpha·9 (sabosugi's CodePen EagJwmv) and retuned to the
 * JARVIS palette — bright cyan primary + deep electric blue secondary,
 * matching `--jarvis` in styles.css.
 *
 * `level` (0..1) from mic amplitude → density + halo glow modulation.
 */
export function Hologram({ level = 0 }: { level?: number }) {
  const mountRef = useRef<HTMLDivElement>(null);
  const levelRef = useRef(level);
  levelRef.current = level;

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const width = () => mount.clientWidth || 1;
    const height = () => mount.clientHeight || 1;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width() / height(), 0.1, 100);

    const ORB_RADIUS = 2.2;
    const fitCamera = () => {
      const aspect = width() / height();
      const vFov = (camera.fov * Math.PI) / 180;
      const distV = ORB_RADIUS / Math.tan(vFov / 2);
      const distH = ORB_RADIUS / (Math.tan(vFov / 2) * aspect);
      camera.position.set(0, 0, Math.max(distV, distH));
    };
    fitCamera();

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5) * 0.8);
    renderer.setSize(width(), height());
    mount.appendChild(renderer.domElement);

    const BASE_DENSITY = 1.6;

    const vertexShader = /* glsl */ `
      varying vec3 vLocalPosition;
      varying vec3 vNormal;
      varying vec3 vViewPosition;
      void main() {
        vLocalPosition = position;
        vNormal = normalize(normalMatrix * normal);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vViewPosition = -mv.xyz;
        gl_Position = projectionMatrix * mv;
      }
    `;

    const fragmentShader = /* glsl */ `
      uniform float uTime;
      uniform vec3 uLocalCamPos;
      uniform vec3 uPrimaryColor;
      uniform vec3 uSecondaryColor;
      uniform float uDensity;
      uniform float uFractalIters;
      uniform float uFractalScale;
      uniform float uFractalDecay;
      uniform float uInternalAnim;
      uniform float uSmoothness;
      uniform float uAsymmetry;
      varying vec3 vLocalPosition;
      varying vec3 vNormal;
      varying vec3 vViewPosition;

      float evalStructure(vec3 pos) {
        float acc = 0.0;
        vec3 anchor = pos;
        float animTime = uTime * uInternalAnim;
        float s = sin(animTime), c = cos(animTime);
        mat2 rotAnim = mat2(c, s, -s, c);
        float a = 0.5 * uAsymmetry;
        mat2 rotA1 = mat2(cos(a), sin(a), -sin(a), cos(a));
        float b = 0.3 * uAsymmetry;
        mat2 rotA2 = mat2(cos(b), sin(b), -sin(b), cos(b));
        for (int step = 0; step < 12; ++step) {
          if (float(step) >= uFractalIters) break;
          pos.xy *= rotAnim;
          pos.yz *= rotAnim;
          pos.xz *= rotA1;
          pos.yz *= rotA2;
          pos += vec3(0.05, -0.02, 0.03) * uAsymmetry;
          vec3 folded = sqrt(pos * pos + uSmoothness);
          float m2 = max(dot(folded, folded), 0.00001);
          pos = (uFractalScale * folded / m2) - uFractalScale;
          float ySq = pos.y * pos.y;
          float zSq = pos.z * pos.z;
          float yz2 = 2.0 * pos.y * pos.z;
          pos.yz = vec2(ySq - zSq, yz2);
          pos = vec3(pos.z, pos.x, pos.y);
          acc += exp(uFractalDecay * abs(dot(pos, anchor)));
        }
        return acc * 0.5;
      }

      vec2 getBounds(vec3 origin, vec3 dir, float radius) {
        float b = dot(origin, dir);
        float c = dot(origin, origin) - radius * radius;
        float d = b * b - c;
        if (d < 0.0) return vec2(-1.0);
        float r = sqrt(d);
        return vec2(-b - r, -b + r);
      }

      vec3 traceEnergy(vec3 origin, vec3 dir, vec2 limits) {
        float depth = limits.x;
        float step = 0.02;
        vec3 finalE = vec3(0.0);
        float f = 0.0;
        for (int i = 0; i < 64; i++) {
          depth += step * exp(-2.0 * f);
          if (depth > limits.y) break;
          vec3 p = origin + depth * dir;
          f = evalStructure(p);
          float fSq = f * f;
          float g = smoothstep(0.0, 0.4, f);
          vec3 grad = mix(uSecondaryColor, uPrimaryColor, g);
          vec3 emission = grad * (f * 1.8 + fSq * 1.0);
          finalE = 0.99 * finalE + (0.08 * uDensity) * emission;
        }
        return finalE;
      }

      void main() {
        vec3 rayOrig = uLocalCamPos;
        vec3 rayDir = normalize(vLocalPosition - uLocalCamPos);
        float t = uTime * 0.1;
        float s = sin(t), c = cos(t);
        mat2 rotXZ = mat2(c, s, -s, c);
        rayOrig.xz *= rotXZ;
        rayDir.xz *= rotXZ;
        vec2 limits = getBounds(rayOrig, rayDir, 2.0);
        if (limits.x < 0.0) discard;
        vec3 vol = traceEnergy(rayOrig, rayDir, limits);
        vec3 normal = normalize(vNormal);
        vec3 viewDir = normalize(vViewPosition);
        float facing = max(dot(normal, viewDir), 0.0);
        float aa = smoothstep(0.0, 0.05, facing);
        vec3 col = 0.5 * log(1.0 + vol);
        col = clamp(col, 0.0, 1.0) * aa;
        float luma = max(col.r, max(col.g, col.b));
        float alpha = clamp(luma * 1.5, 0.0, 1.0) * aa;
        gl_FragColor = vec4(col, alpha);
      }
    `;

    // JARVIS palette:
    //   primary   ≈ bright cyan (#38e6ff)  — highlights, hot core
    //   secondary ≈ deep electric blue (#1a5cff) — outer volume, cool depth
    const uniforms = {
      uTime: { value: 0 },
      uLocalCamPos: { value: new THREE.Vector3() },
      uPrimaryColor: { value: new THREE.Color("#38e6ff") },
      uSecondaryColor: { value: new THREE.Color("#1a5cff") },
      uDensity: { value: BASE_DENSITY },
      uFractalIters: { value: 3 },
      uFractalScale: { value: 0.75 },
      uFractalDecay: { value: -16.7 },
      uInternalAnim: { value: 0.43 },
      uSmoothness: { value: 0.05 },
      uAsymmetry: { value: 0.45 },
    };

    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    const geometry = new THREE.SphereGeometry(2.0, 96, 96);
    const orb = new THREE.Mesh(geometry, material);
    scene.add(orb);

    // Atmosphere halo — cyan, matches --jarvis token.
    const atmVertex = /* glsl */ `
      varying vec3 vNormal;
      varying vec3 vViewPosition;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vViewPosition = -mv.xyz;
        gl_Position = projectionMatrix * mv;
      }
    `;
    const atmFragment = /* glsl */ `
      uniform vec3 uColor;
      uniform float uGlow;
      uniform float uLevel;
      varying vec3 vNormal;
      varying vec3 vViewPosition;
      void main() {
        vec3 n = normalize(vNormal);
        vec3 v = normalize(vViewPosition);
        float vdn = max(dot(n, v), 0.0);
        float edgeFade = smoothstep(0.0, 0.15, vdn);
        float inner = clamp(1.0 - uLevel, 0.0, 0.99);
        float centerFade = smoothstep(1.0, inner, vdn);
        float alpha = edgeFade * centerFade * uGlow;
        gl_FragColor = vec4(uColor, alpha);
      }
    `;
    const atmUniforms = {
      uColor: { value: new THREE.Color("#4dd8ff") },
      uGlow: { value: 0.25 },
      uLevel: { value: 1.0 },
    };
    const atmMaterial = new THREE.ShaderMaterial({
      vertexShader: atmVertex,
      fragmentShader: atmFragment,
      uniforms: atmUniforms,
      transparent: true,
      side: THREE.FrontSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const atmMesh = new THREE.Mesh(geometry, atmMaterial);
    atmMesh.scale.setScalar(1.03);
    orb.add(atmMesh);

    const composer = new EffectComposer(renderer);
    composer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5) * 0.8);
    composer.setSize(width(), height());
    composer.addPass(new RenderPass(scene, camera));

    const CAShader = {
      uniforms: {
        tDiffuse: { value: null as THREE.Texture | null },
        uAmount: { value: 0.026 },
      },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float uAmount;
        varying vec2 vUv;
        void main(){
          vec4 base = texture2D(tDiffuse, vUv);
          float luma = max(base.r, max(base.g, base.b));
          float mask = smoothstep(0.01, 0.1, luma);
          vec2 off = (vUv - 0.5) * uAmount;
          float r = texture2D(tDiffuse, vUv + off).r;
          float g = texture2D(tDiffuse, vUv).g;
          float b = texture2D(tDiffuse, vUv - off).b;
          gl_FragColor = vec4(mix(base.rgb, vec3(r, g, b), mask), base.a);
        }
      `,
    };
    const caPass = new ShaderPass(CAShader);
    composer.addPass(caPass);

    const ro = new ResizeObserver(() => {
      const w = width(), h = height();
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      fitCamera();
      renderer.setSize(w, h);
      composer.setSize(w, h);
    });
    ro.observe(mount);

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    let prev = performance.now();
    let running = true;
    const localCam = new THREE.Vector3();

    const tick = () => {
      if (!running) return;
      const now = performance.now();
      const delta = Math.min(0.1, (now - prev) / 1000);
      prev = now;
      const speed = reducedMotion ? 0.1 : 1;
      uniforms.uTime.value += delta * 0.6 * speed;
      const l = Math.min(1, Math.max(0, levelRef.current));
      uniforms.uDensity.value = BASE_DENSITY * (0.9 + l * 1.2);
      atmUniforms.uGlow.value = 0.2 + l * 0.6;

      orb.rotation.y += delta * 0.6 * speed;
      orb.rotation.x += delta * 0.3 * speed;
      orb.updateMatrixWorld();
      localCam.copy(camera.position);
      orb.worldToLocal(localCam);
      uniforms.uLocalCamPos.value.copy(localCam);
      composer.render();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    const onVisibility = () => {
      if (document.hidden) {
        running = false;
        cancelAnimationFrame(raf);
      } else if (!running) {
        running = true;
        prev = performance.now();
        raf = requestAnimationFrame(tick);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", onVisibility);
      ro.disconnect();
      geometry.dispose();
      material.dispose();
      atmMaterial.dispose();
      composer.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
    };
  }, []);

  return <div ref={mountRef} className="absolute inset-0" />;
}
