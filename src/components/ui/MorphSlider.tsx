import React, { useRef, useEffect, useState, useCallback } from "react";
import { Renderer, Geometry, Program, Mesh, Texture } from "ogl";
import gsap from "gsap";
import "./MorphSlider.css";

export interface MorphSliderItem {
  image: string;
  caption?: string;
}

export interface MorphSliderProps extends React.HTMLAttributes<HTMLDivElement> {
  items: MorphSliderItem[];
  startIndex?: number;
  transition?: "melt" | "ripple" | "shear" | "swirl";
  duration?: number;
  ease?: string;
  intensity?: number;
  scale?: number;
  aberration?: number;
  drift?: number;
  autoplay?: boolean;
  autoplayDelay?: number;
  loop?: boolean;
  radius?: number;
  overlayColor?: string;
  showCaptions?: boolean;
  showControls?: boolean;
  showIndicators?: boolean;
  className?: string;
}

const MODES: Record<string, number> = {
  melt: 0,
  ripple: 1,
  shear: 2,
  swirl: 3,
};

const vertexShader = `
attribute vec2 position;
attribute vec2 uv;
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const fragmentShader = `
precision highp float;

uniform sampler2D tCurrent;
uniform sampler2D tNext;
uniform vec2 uResolution;
uniform vec2 uCurrentSize;
uniform vec2 uNextSize;
uniform float uProgress;
uniform float uDir;
uniform int uMode;
uniform float uIntensity;
uniform float uScale;
uniform float uAberration;
uniform float uDrift;
uniform float uTime;
uniform float uReduce;
uniform vec2 uPointer;
uniform vec3 uOverlay;

varying vec2 vUv;

const float PI = 3.14159265359;

float hash11(float p) {
  p = fract(p * 0.1031);
  p *= p + 33.33;
  p *= p + p;
  return fract(p);
}

float hash21(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) {
    v += a * noise(p);
    p *= 2.0;
    a *= 0.5;
  }
  return v;
}

mat2 rot(float a) {
  float s = sin(a);
  float c = cos(a);
  return mat2(c, -s, s, c);
}

vec2 coverUV(vec2 uv, vec2 res, vec2 img) {
  float rA = res.x / max(res.y, 1.0);
  float iA = img.x / max(img.y, 1.0);
  vec2 s = vec2(1.0);
  float ratio = rA / max(iA, 0.0001);
  if (ratio > 1.0) {
    s.y = 1.0 / ratio;
  } else {
    s.x = ratio;
  }
  return (uv - 0.5) * s + 0.5;
}

void main() {
  float p = clamp(uProgress, 0.0, 1.0);
  float env = sin(p * PI);

  vec2 uv = vUv;

  uv += vec2(sin(uTime * 0.25 + uv.y * 4.0), cos(uTime * 0.22 + uv.x * 4.0)) * uDrift * 0.008;
  uv = (uv - 0.5) * (1.0 - uDrift * 0.02 * sin(uTime * 0.4)) + 0.5;

  vec2 uvC = uv;
  vec2 uvN = uv;
  float m = smoothstep(0.0, 1.0, p);

  if (uReduce < 0.5) {
    if (uMode == 3) {
      vec2 c = uv - 0.5;
      float r = length(c);
      float ang = env * uIntensity * 3.5 * (1.0 - r);
      uvC = rot(ang) * c + 0.5;
      uvN = rot(-ang) * c + 0.5;
      m = smoothstep(0.0, 1.0, p);
    } else if (uMode == 1) {
      float d = distance(uv, uPointer);
      float ring = p * 1.6;
      float wave = sin((d - ring) * 30.0) * env;
      vec2 dir = normalize(uv - uPointer + 1e-4);
      vec2 disp = dir * wave * uIntensity * 0.25;
      uvC = uv + disp;
      uvN = uv + disp * 0.6;
      m = 1.0 - smoothstep(ring - 0.03, ring + 0.03, d);
    } else if (uMode == 2) {
      float slices = 14.0;
      float row = floor(uv.y * slices);
      float rnd = hash11(row);
      vec2 disp = vec2((rnd - 0.5) * env * uIntensity * 0.6, 0.0);
      uvC = uv + disp;
      uvN = uv + disp;
      float localX = uDir > 0.0 ? uv.x : 1.0 - uv.x;
      float th = p * 1.5 - 0.25 + (rnd - 0.5) * 0.25;
      m = 1.0 - smoothstep(th - 0.06, th + 0.06, localX);
    } else {
      float nn = fbm(uv * uScale + uTime * 0.03);
      float warp = fbm(uv * uScale * 1.7 - uTime * 0.02);
      vec2 g = vec2(nn, warp) - 0.5;
      uvC = uv + g * uIntensity * 0.5 * p;
      uvN = uv - g * uIntensity * 0.5 * (1.0 - p);
      m = smoothstep(nn - 0.15, nn + 0.15, p);
    }
  }

  vec2 sC = coverUV(uvC, uResolution, uCurrentSize);
  vec2 sN = coverUV(uvN, uResolution, uNextSize);

  float ca = uReduce < 0.5 ? uAberration * env * 0.03 : 0.0;

  vec3 colC = vec3(
    texture2D(tCurrent, sC + vec2(ca, 0.0)).r,
    texture2D(tCurrent, sC).g,
    texture2D(tCurrent, sC - vec2(ca, 0.0)).b
  );
  vec3 colN = vec3(
    texture2D(tNext, sN + vec2(ca, 0.0)).r,
    texture2D(tNext, sN).g,
    texture2D(tNext, sN - vec2(ca, 0.0)).b
  );

  vec3 col = mix(colC, colN, m);

  float vig = smoothstep(1.25, 0.25, length(uv - 0.5));
  col = mix(col, uOverlay, (1.0 - vig) * 0.28);

  gl_FragColor = vec4(col, 1.0);
}
`;

function createFallbackTexture(gl: any): Texture {
  const data = new Uint8Array(64);
  for (let i = 0; i < 4 * 4; i++) {
    data[i * 4] = 24;
    data[i * 4 + 1] = 24;
    data[i * 4 + 2] = 28;
    data[i * 4 + 3] = 255;
  }
  return new Texture(gl, { image: data, width: 4, height: 4, generateMipmaps: false });
}

function hexToRgb(hex?: string): [number, number, number] {
  let c = (hex || "#000000").replace("#", "");
  if (c.length === 3) c = c.split("").map((x) => x + x).join("");
  const num = parseInt(c, 16);
  return [((num >> 16) & 255) / 255, ((num >> 8) & 255) / 255, (num & 255) / 255];
}

class MorphEngine {
  container: HTMLElement;
  items: MorphSliderItem[];
  getOptions: () => any;
  onIndexChange?: (idx: number) => void;
  reducedMotion: boolean;
  current: number;
  shownIndex: number;
  animating = false;
  dragging = false;
  dragDir = 0;
  tween: any = null;
  renderer: Renderer;
  gl: any;
  canvas: HTMLCanvasElement;
  geometry: Geometry;
  textures: Texture[];
  sizes: [number, number][];
  program: Program;
  mesh: Mesh;
  boundContextLost: (e: any) => void;
  boundLoop: (time: number) => void;
  resizeObserver: ResizeObserver;
  raf: number;

  constructor(
    container: HTMLElement,
    {
      items,
      startIndex,
      reducedMotion,
      getOptions,
      onIndexChange,
      dprCap = 2,
    }: {
      items: MorphSliderItem[];
      startIndex: number;
      reducedMotion: boolean;
      getOptions: () => any;
      onIndexChange?: (idx: number) => void;
      dprCap?: number;
    }
  ) {
    this.container = container;
    this.items = items;
    this.getOptions = getOptions;
    this.onIndexChange = onIndexChange;
    this.reducedMotion = reducedMotion;
    this.current = startIndex;
    this.shownIndex = startIndex;

    this.renderer = new Renderer({
      alpha: false,
      antialias: true,
      dpr: Math.min(window.devicePixelRatio || 1, dprCap),
    });
    this.gl = this.renderer.gl;
    this.gl.clearColor(0.05, 0.05, 0.06, 1);
    this.canvas = this.gl.canvas;
    this.canvas.className = "morph-slider-canvas";
    container.appendChild(this.canvas);

    // Quad geometry covering full screen in clip space
    this.geometry = new Geometry(this.gl, {
      position: { size: 2, data: new Float32Array([-1, -1, 3, -1, -1, 3]) },
      uv: { size: 2, data: new Float32Array([0, 0, 2, 0, 0, 2]) },
    });

    this.textures = this.items.map(() => createFallbackTexture(this.gl));
    this.sizes = this.items.map(() => [1, 1]);

    const opts = this.getOptions();
    this.program = new Program(this.gl, {
      vertex: vertexShader,
      fragment: fragmentShader,
      uniforms: {
        tCurrent: { value: this.textures[this.current] },
        tNext: { value: this.textures[this.current] },
        uResolution: { value: [1, 1] },
        uCurrentSize: { value: this.sizes[this.current] },
        uNextSize: { value: this.sizes[this.current] },
        uProgress: { value: 0 },
        uDir: { value: 1 },
        uMode: { value: MODES[opts.transition] ?? 0 },
        uIntensity: { value: opts.intensity },
        uScale: { value: opts.scale },
        uAberration: { value: opts.aberration },
        uDrift: { value: opts.drift },
        uTime: { value: 0 },
        uReduce: { value: reducedMotion ? 1 : 0 },
        uPointer: { value: [0.5, 0.5] },
        uOverlay: { value: hexToRgb(opts.overlayColor) },
      },
    });

    this.mesh = new Mesh(this.gl, { geometry: this.geometry, program: this.program });

    this.boundContextLost = (e) => {
      e.preventDefault();
      cancelAnimationFrame(this.raf);
    };
    this.canvas.addEventListener("webglcontextlost", this.boundContextLost, false);

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();
    this.loadTextures();

    this.boundLoop = this.loop.bind(this);
    this.raf = requestAnimationFrame(this.boundLoop);
  }

  loadTextures() {
    this.items.forEach((item, index) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = item.image;
      img.onload = () => {
        const tex = new Texture(this.gl, { generateMipmaps: false });
        tex.image = img;
        this.textures[index] = tex;
        this.sizes[index] = [img.naturalWidth || 1, img.naturalHeight || 1];
        if (index === this.current) {
          this.program.uniforms.tCurrent.value = tex;
          this.program.uniforms.uCurrentSize.value = this.sizes[index];
        }
      };
    });
  }

  resize() {
    const rect = this.container.getBoundingClientRect();
    const w = Math.max(rect.width, 1);
    const h = Math.max(rect.height, 1);
    this.renderer.setSize(w, h);
    this.program.uniforms.uResolution.value = [this.gl.canvas.width, this.gl.canvas.height];
  }

  syncOptions() {
    const opts = this.getOptions();
    this.program.uniforms.uMode.value = MODES[opts.transition] ?? 0;
    this.program.uniforms.uIntensity.value = opts.intensity;
    this.program.uniforms.uScale.value = opts.scale;
    this.program.uniforms.uAberration.value = opts.aberration;
    this.program.uniforms.uDrift.value = opts.drift;
    this.program.uniforms.uOverlay.value = hexToRgb(opts.overlayColor);
  }

  loop(time: number) {
    this.program.uniforms.uTime.value = time * 0.001;
    if (!this.dragging && !this.animating) {
      this.syncOptions();
    }
    this.renderer.render({ scene: this.mesh });
    this.raf = requestAnimationFrame(this.boundLoop);
  }

  wrap(idx: number): number {
    const len = this.items.length;
    return ((idx % len) + len) % len;
  }

  prepareNext(step: number): number {
    const nextIdx = this.wrap(this.current + step);
    this.program.uniforms.tCurrent.value = this.textures[this.current];
    this.program.uniforms.uCurrentSize.value = this.sizes[this.current];
    this.program.uniforms.tNext.value = this.textures[nextIdx];
    this.program.uniforms.uNextSize.value = this.sizes[nextIdx];
    this.program.uniforms.uDir.value = step;
    return nextIdx;
  }

  goTo(step: number) {
    if (this.animating || this.dragging || this.items.length < 2) return;
    const opts = this.getOptions();
    if (!opts.loop) {
      const target = this.current + step;
      if (target < 0 || target > this.items.length - 1) return;
    }
    this.syncOptions();
    const nextIdx = this.prepareNext(step);
    this.animating = true;
    this.announce(nextIdx);

    const dur = this.reducedMotion ? Math.min(opts.duration, 0.4) : opts.duration;
    this.tween = gsap.fromTo(
      this.program.uniforms.uProgress,
      { value: 0 },
      {
        value: 1,
        duration: dur,
        ease: opts.ease,
        onComplete: () => this.commit(nextIdx),
      }
    );
  }

  announce(idx: number) {
    if (idx !== this.shownIndex) {
      this.shownIndex = idx;
      this.onIndexChange?.(idx);
    }
  }

  commit(idx: number) {
    this.current = idx;
    this.program.uniforms.tCurrent.value = this.textures[idx];
    this.program.uniforms.uCurrentSize.value = this.sizes[idx];
    this.program.uniforms.uProgress.value = 0;
    this.animating = false;
    this.tween = null;
    this.announce(idx);
  }

  next() {
    this.goTo(1);
  }

  prev() {
    this.goTo(-1);
  }

  setPointer(x: number, y: number) {
    this.program.uniforms.uPointer.value = [x, y];
  }

  beginDrag(): boolean {
    if (this.animating || this.items.length < 2) return false;
    this.dragging = true;
    this.dragDir = 0;
    this.syncOptions();
    return true;
  }

  drag(delta: number) {
    if (!this.dragging) return;
    const opts = this.getOptions();
    const dir = delta < 0 ? 1 : -1;
    if (!opts.loop) {
      const target = this.current + dir;
      if (target < 0 || target > this.items.length - 1) {
        this.program.uniforms.uProgress.value = 0;
        return;
      }
    }
    if (dir !== this.dragDir) {
      this.dragDir = dir;
      this.prepareNext(dir);
    }
    const val = Math.min(Math.abs(delta), 1);
    this.program.uniforms.uProgress.value = val;
    this.announce(val > 0.5 ? this.wrap(this.current + dir) : this.current);
  }

  endDrag() {
    if (!this.dragging) return;
    this.dragging = false;
    const progress = this.program.uniforms.uProgress.value;
    if (this.dragDir === 0) return;
    const targetIdx = this.wrap(this.current + this.dragDir);
    const dur = this.reducedMotion ? 0.3 : 0.5;
    this.animating = true;
    if (progress > 0.4) {
      this.announce(targetIdx);
      this.tween = gsap.to(this.program.uniforms.uProgress, {
        value: 1,
        duration: dur,
        ease: "power2.out",
        onComplete: () => this.commit(targetIdx),
      });
    } else {
      this.announce(this.current);
      this.tween = gsap.to(this.program.uniforms.uProgress, {
        value: 0,
        duration: dur,
        ease: "power2.out",
        onComplete: () => {
          this.animating = false;
          this.tween = null;
        },
      });
    }
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    this.tween?.kill();
    this.resizeObserver.disconnect();
    this.canvas.removeEventListener("webglcontextlost", this.boundContextLost);
    this.textures.forEach((t) => t?.texture && this.gl.deleteTexture(t.texture));
    if (this.program?.program) {
      this.gl.deleteProgram(this.program.program);
    }
    const loseExt = this.gl.getExtension("WEBGL_lose_context");
    loseExt?.loseContext();
    this.canvas.parentNode?.removeChild(this.canvas);
  }
}

export function MorphSlider({
  items,
  startIndex = 0,
  transition = "melt",
  duration = 1.1,
  ease = "power2.inOut",
  intensity = 0.55,
  scale = 2.4,
  aberration = 0.35,
  drift = 0.4,
  autoplay = false,
  autoplayDelay = 4,
  loop = true,
  radius = 16,
  overlayColor = "#000000",
  showCaptions = true,
  showControls = true,
  showIndicators = true,
  className = "",
  style,
  ...rest
}: MorphSliderProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<MorphEngine | null>(null);
  const [currentIndex, setCurrentIndex] = useState(startIndex);
  const [isHovered, setIsHovered] = useState(false);

  const optionsRef = useRef({
    transition,
    duration,
    ease,
    intensity,
    scale,
    aberration,
    drift,
    overlayColor,
    loop,
  });

  optionsRef.current = {
    transition,
    duration,
    ease,
    intensity,
    scale,
    aberration,
    drift,
    overlayColor,
    loop,
  };

  useEffect(() => {
    if (!containerRef.current) return;
    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const engine = new MorphEngine(containerRef.current, {
      items,
      startIndex,
      reducedMotion: prefersReducedMotion,
      dprCap: 2,
      getOptions: () => optionsRef.current,
      onIndexChange: setCurrentIndex,
    });
    engineRef.current = engine;
    setCurrentIndex(startIndex);

    return () => {
      engine.destroy();
      engineRef.current = null;
    };
  }, [items, startIndex]);

  const handleNext = useCallback(() => engineRef.current?.next(), []);
  const handlePrev = useCallback(() => engineRef.current?.prev(), []);

  useEffect(() => {
    if (!autoplay || isHovered) return;
    const timer = setTimeout(() => {
      engineRef.current?.next();
    }, Math.max(autoplayDelay, 1) * 1000);
    return () => clearTimeout(timer);
  }, [autoplay, autoplayDelay, isHovered, currentIndex]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let startX = 0;
    let width = 1;
    let dragging = false;

    const onPointerDown = (e: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      width = rect.width || 1;
      startX = e.clientX;
      const nx = (e.clientX - rect.left) / rect.width;
      const ny = (e.clientY - rect.top) / rect.height;
      engineRef.current?.setPointer(nx, 1 - ny);
      dragging = engineRef.current?.beginDrag() ?? false;
      if (dragging && el.setPointerCapture) {
        try {
          el.setPointerCapture(e.pointerId);
        } catch {}
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!dragging) return;
      const delta = (e.clientX - startX) / width;
      engineRef.current?.drag(delta);
    };

    const onPointerUp = () => {
      if (dragging) {
        dragging = false;
        engineRef.current?.endDrag();
      }
    };

    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("pointerup", onPointerUp);
    el.addEventListener("pointercancel", onPointerUp);

    return () => {
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerup", onPointerUp);
      el.removeEventListener("pointercancel", onPointerUp);
    };
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowRight") {
        e.preventDefault();
        handleNext();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        handlePrev();
      }
    },
    [handleNext, handlePrev]
  );

  const hasCaptions = items.some((item) => item.caption);

  return (
    <div
      className={`morph-slider ${className}`.trim()}
      style={{
        borderRadius: `${radius}px`,
        // @ts-ignore
        "--ms-swap": `${(duration * 0.66).toFixed(3)}s`,
        "--ms-dot": `${(duration * 0.45).toFixed(3)}s`,
        ...style,
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      {...rest}
    >
      <div
        ref={containerRef}
        className="morph-slider-stage"
        role="group"
        aria-roledescription="carousel"
        aria-label="Image morph slider"
        tabIndex={0}
        onKeyDown={handleKeyDown}
      />

      {showCaptions && hasCaptions && (
        <div className="morph-slider-caption" aria-live="polite">
          {items.map((item, i) =>
            item.caption ? (
              <span
                key={i}
                aria-hidden={i === currentIndex ? undefined : true}
                className={`morph-slider-caption-text ${i === currentIndex ? "is-active" : ""}`}
              >
                {item.caption}
              </span>
            ) : null
          )}
        </div>
      )}

      {showControls && (
        <div className="morph-slider-controls">
          <button
            type="button"
            className="morph-slider-btn"
            aria-label="Previous slide"
            onClick={handlePrev}
          >
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <path
                d="M15 5l-7 7 7 7"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          <button
            type="button"
            className="morph-slider-btn"
            aria-label="Next slide"
            onClick={handleNext}
          >
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <path
                d="M9 5l7 7-7 7"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      )}

      {showIndicators && (
        <div className="morph-slider-indicators" role="tablist" aria-label="Slides">
          {items.map((_, i) => (
            <button
              key={i}
              type="button"
              role="tab"
              aria-selected={i === currentIndex}
              aria-label={`Go to slide ${i + 1}`}
              className={`morph-slider-dot ${i === currentIndex ? "is-active" : ""}`}
              onClick={() => {
                if (i === currentIndex) return;
                engineRef.current?.goTo(i > currentIndex ? 1 : -1);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default MorphSlider;
