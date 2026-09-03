/* hero3d.js — shared Three.js hero framework for the client sites.
 *
 * Every site's hero is a single recognisable object rendered procedurally.
 * Downloaded CC models were tried first and rejected: the available catalogue
 * is flat-shaded low-poly game art (a "Nissan GTR" is an untextured blue toy),
 * and several objects we need — barber pole, clippers, tattoo machine — don't
 * exist in it at all. Building the geometry here gives a better result and
 * ships nothing but three.js.
 *
 * What actually sells realism, in order of impact:
 *   1. studioEnv() — a dark shell with bright emissive softboxes, PMREM'd into
 *      an environment map. Polished metal is almost pure reflection, so what it
 *      *sees* matters far more than the lights. three's RoomEnvironment alone
 *      is too dim and renders chrome as grey plastic.
 *   2. LatheGeometry from hand-authored profiles for anything turned on a
 *      lathe in reality — pole caps, grips, bottle necks, wheel hubs.
 *   3. MeshPhysicalMaterial: metalness 1 + low roughness + high envMapIntensity
 *      for chrome; transmission/ior/thickness for glass; clearcoat for paint.
 *
 * Usage from a page module:
 *   import {mountHero, MAT, studioEnv} from './assets/hero3d.js';
 *   mountHero({canvas, build:(THREE, ctx) => group, rim:0xD8402F, ...});
 */

export const DEFAULTS = {
  fov: 34,
  cameraZ: 12,
  // Left edge of the art, as a fraction of canvas width. .hero-in is capped
  // at 54%, so 0.57 leaves a 3% gutter. Set false to opt out of fitting.
  fitFrom: 0.57,
  minWidth: 901,      // below this the canvas stays empty (mobile)
  maxDpr: 1.75,
  exposure: 1.15,
  rim: 0xffffff,      // brand-coloured rim light
  lookAt: [0, 0, 0],
  position: [0, 0, 0],
  spin: 0.28,         // yaw sweep amplitude
  bob: 0.10,
  parallax: 1.0,
  preserveDrawingBuffer: false
};

/* Materials are created per-renderer because envMapIntensity is meaningless
   until an environment exists. Call with the THREE namespace. */
export function makeMaterials(THREE) {
  return {
    chrome: new THREE.MeshPhysicalMaterial({
      color: 0xEAEEF3, metalness: 1, roughness: 0.075, envMapIntensity: 2.6
    }),
    steel: new THREE.MeshPhysicalMaterial({
      color: 0xC8CDD4, metalness: 1, roughness: 0.16, envMapIntensity: 2.2
    }),
    darkMetal: new THREE.MeshPhysicalMaterial({
      color: 0x2C2F35, metalness: 1, roughness: 0.30, envMapIntensity: 1.6
    }),
    brass: new THREE.MeshPhysicalMaterial({
      color: 0xC9A227, metalness: 1, roughness: 0.27, envMapIntensity: 1.9
    }),
    copper: new THREE.MeshPhysicalMaterial({
      color: 0xB87333, metalness: 1, roughness: 0.30, envMapIntensity: 1.8
    }),
    rubber: new THREE.MeshPhysicalMaterial({
      color: 0x141418, metalness: 0, roughness: 0.9
    }),
    plasticWhite: new THREE.MeshPhysicalMaterial({
      color: 0xF2F4F6, metalness: 0, roughness: 0.35, clearcoat: 0.8, clearcoatRoughness: 0.2
    }),
    glass: new THREE.MeshPhysicalMaterial({
      transmission: 1, thickness: 0.35, ior: 1.48, roughness: 0.06, metalness: 0,
      transparent: true, side: THREE.DoubleSide, clearcoat: 1, clearcoatRoughness: 0.04,
      envMapIntensity: 1.5
    })
  };
}

/** Paint with a clearcoat — the lacquer layer is what makes a car body read. */
export function paint(THREE, hex, {metallic = 0.55, rough = 0.24} = {}) {
  return new THREE.MeshPhysicalMaterial({
    color: hex, metalness: metallic, roughness: rough,
    clearcoat: 1, clearcoatRoughness: 0.035, envMapIntensity: 1.9
  });
}

/**
 * A studio: dark box with bright emissive panels. PMREM turns it into the
 * environment map, so metal picks up hard highlights with real falloff.
 * `rim` tints the panel behind the subject with the brand colour.
 */
export function studioEnv(THREE, rim = 0xffffff, rimGain = 1.3) {
  const s = new THREE.Scene();
  const panel = (w, h, d, hex, gain, x, y, z) => {
    const mat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(hex).multiplyScalar(gain)
    });
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    s.add(m);
  };
  s.add(new THREE.Mesh(
    new THREE.BoxGeometry(34, 24, 34),
    new THREE.MeshBasicMaterial({color: 0x14151A, side: THREE.BackSide})
  ));
  panel(18, 0.4, 12, 0xffffff, 7.0,   0,  10,   0);  // overhead key softbox
  panel(0.4, 12, 16, 0xffffff, 4.2, -13,   2,   0);  // left strip
  panel(0.4, 10, 12, 0xFFF2E2, 1.5,  13,   1,   2);  // warm right strip
  panel(12,   7, 0.4, rim,   rimGain,  0,   2, -13);  // brand rim from behind
  panel(10, 0.4,  8, 0x9FB6FF, 1.1,   0,  -8,   2);  // cool bounce underneath
  return s;
}

/* ---------- small geometry helpers, shared by the object builders ---------- */

export function helpers(THREE) {
  const box = (w, h, d, m) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  const cyl = (rt, rb, h, m, seg = 40) =>
    new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m);
  const sph = (r, m, seg = 32) => new THREE.Mesh(new THREE.SphereGeometry(r, seg, seg), m);
  const tor = (r, t, m, seg = 40) =>
    new THREE.Mesh(new THREE.TorusGeometry(r, t, 14, seg), m);

  /** Lathe a profile given as [[x,y], ...]; x is radius, y is height. */
  const lathe = (pts, m, seg = 56) => new THREE.Mesh(
    new THREE.LatheGeometry(pts.map(p => new THREE.Vector2(p[0], p[1])), seg), m
  );

  /**
   * Extrude a 2D outline with a bevel — for flat forged parts (blades, jaws)
   * and for panels that need openings (wheel arches, window apertures).
   *
   * `holes` takes arrays of points, or {circle:[cx,cy,r]} for a round cutout.
   * `center` recentres the geometry on its own bounds; turn it off when you
   * need the mesh to stay in the coordinate space the profile was authored in.
   */
  const extrude = (pts, m, {depth = 0.12, bevel = 0.02, holes = null, center = true} = {}) => {
    const shape = new THREE.Shape();
    pts.forEach(([x, y], i) => i ? shape.lineTo(x, y) : shape.moveTo(x, y));
    shape.closePath();

    (holes || []).forEach(hole => {
      const p = new THREE.Path();
      if (hole.circle) {
        const [cx, cy, r] = hole.circle;
        p.absarc(cx, cy, r, 0, Math.PI * 2, true);
      } else {
        hole.forEach(([x, y], i) => i ? p.lineTo(x, y) : p.moveTo(x, y));
        p.closePath();
      }
      shape.holes.push(p);
    });

    const g = new THREE.ExtrudeGeometry(shape, {
      depth, bevelEnabled: bevel > 0, bevelThickness: bevel,
      bevelSize: bevel, bevelSegments: 3, curveSegments: 24
    });
    if (center) g.center();
    return new THREE.Mesh(g, m);
  };

  const at = (mesh, x, y, z) => { mesh.position.set(x, y, z); return mesh; };
  const rot = (mesh, x, y, z) => { mesh.rotation.set(x, y, z); return mesh; };

  return {box, cyl, sph, tor, lathe, extrude, at, rot};
}

/** Draw a repeating canvas texture; fn receives (ctx, w, h). */
export function canvasTexture(THREE, renderer, w, h, fn, repeat = [1, 1]) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  fn(cv.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/**
 * Mount a hero. Resolves to null when skipped (mobile, reduced motion, no CDN)
 * so callers can fall back silently.
 *
 * opts.build(THREE, ctx) -> THREE.Group   where ctx = {mat, h, tex, renderer, scene}
 */
export async function mountHero(opts) {
  const o = Object.assign({}, DEFAULTS, opts);
  const canvas = o.canvas;
  if (!canvas) return null;
  if (matchMedia('(prefers-reduced-motion:reduce)').matches) return null;

  /* Touch devices never get the hero. Width, though, must be re-checked:
     deciding once meant a page opened in a narrow window (or a tablet in
     portrait) permanently lost its hero — widening or rotating never brought
     it back. Wait for the viewport to cross the threshold instead of bailing. */
  if (matchMedia('(hover:none)').matches) return null;
  if (innerWidth < o.minWidth) {
    await new Promise(res => {
      let ro = null, poll = null;
      const check = () => {
        if (innerWidth >= o.minWidth) { cleanup(); res(); }
      };
      const cleanup = () => {
        removeEventListener('resize', check);
        removeEventListener('orientationchange', check);
        if (ro) ro.disconnect();
        if (poll) clearInterval(poll);
      };
      addEventListener('resize', check, {passive: true});
      addEventListener('orientationchange', check, {passive: true});
      /* window 'resize' does not fire when only the containing box changes —
         an iframe resized by its parent, or a CSS-driven container change.
         Observing the canvas itself catches most of those. */
      if (typeof ResizeObserver === 'function') {
        ro = new ResizeObserver(check);
        ro.observe(canvas);
      }
      /* Belt and braces: some embedding contexts deliver neither event even
         though the viewport genuinely changed (verified — an iframe resized by
         its parent reported innerWidth 600 -> 1440 with zero resize and zero
         ResizeObserver callbacks). A slow poll makes the gate independent of
         any event firing, and costs nothing because it stops on the first
         successful check. */
      poll = setInterval(check, 400);
      check();
    });
  }

  // Don't pay for three.js until the hero is near the viewport — but never let
  // that gate become a deadlock. IntersectionObserver does not fire in an
  // occluded or background tab, which would otherwise leave the hero blank
  // forever; an immediate geometric check plus a timeout covers both cases.
  await new Promise(res => {
    let settled = false;
    const done = () => { if (!settled) { settled = true; res(); } };

    const r = canvas.getBoundingClientRect();
    const near = r.bottom > -200 && r.top < innerHeight + 200 &&
                 r.right > -200 && r.left < innerWidth + 200;
    if (near) { done(); return; }

    const io = new IntersectionObserver(e => {
      if (e[0].isIntersecting) { io.disconnect(); done(); }
    }, {rootMargin: '200px'});
    io.observe(canvas);
    setTimeout(() => { io.disconnect(); done(); }, 2500);
  });

  let THREE;
  try {
    THREE = await import('three');
  } catch (err) {
    return null;   // offline or CDN blocked — hero stays flat, page is fine
  }

  const W = () => canvas.clientWidth || 1;
  const H = () => canvas.clientHeight || 1;

  /* preserveDrawingBuffer costs performance, so it stays off in production —
     but without it the drawing buffer is cleared after compositing and any
     readback (toDataURL, html2canvas) returns an empty frame. `?shot=1` turns
     it on for screenshot tooling only. */
  const shotMode = typeof location !== 'undefined' && /[?&]shot=1\b/.test(location.search);
  const renderer = new THREE.WebGLRenderer({
    canvas, antialias: true, alpha: true,
    preserveDrawingBuffer: o.preserveDrawingBuffer || shotMode
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio, o.maxDpr));
  renderer.setSize(W(), H(), false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = o.exposure;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(studioEnv(THREE, o.rim, o.rimGain ?? 1.3), 0.028).texture;

  const camera = new THREE.PerspectiveCamera(o.fov, W() / H(), 0.1, 100);
  const camBase = o.camera || [0, 0.35, o.cameraZ];
  camera.position.set(camBase[0], camBase[1], camBase[2]);

  const ctx = {
    mat: makeMaterials(THREE),
    h: helpers(THREE),
    tex: (w, hh, fn, rep) => canvasTexture(THREE, renderer, w, hh, fn, rep),
    paint: (hex, cfg) => paint(THREE, hex, cfg),
    renderer, scene, camera
  };

  const group = o.build(THREE, ctx);
  group.position.set(o.position[0], o.position[1], o.position[2]);
  if (o.rotation) group.rotation.set(o.rotation[0], o.rotation[1], o.rotation[2]);
  scene.add(group);

  // IBL carries the shading; these only sharpen edges and add brand colour.
  const key = new THREE.DirectionalLight(0xffffff, 0.9); key.position.set(5, 7, 6);
  const rimL = new THREE.DirectionalLight(o.rim, 1.6); rimL.position.set(-6, 1, -5);
  scene.add(key, rimL);

  let mx = 0, my = 0, visible = true, t = 0;
  addEventListener('mousemove', e => {
    mx = (e.clientX / innerWidth - 0.5) * 2;
    my = (e.clientY / innerHeight - 0.5) * 2;
  }, {passive: true});

  new IntersectionObserver(e => { visible = e[0].isIntersecting; }, {threshold: 0.01})
    .observe(canvas);

  /* ---- keep the art clear of the text column ----
     Measured rather than guessed: project the group's bounding box, compare
     its left edge to the target, and correct. Two passes converge because
     scaling and translating both change the projection slightly. */
  const fitGroup = (() => {
    if (o.fitFrom === false) return () => {};
    const box = new THREE.Box3();
    const v = new THREE.Vector3();
    const baseScale = group.scale.clone();   // a builder may scale non-uniformly
    const baseX = o.position[0];

    const measure = () => {
      box.setFromObject(group);
      if (box.isEmpty()) return null;
      let min = Infinity, max = -Infinity;
      for (let i = 0; i < 8; i++) {
        v.set(i & 1 ? box.max.x : box.min.x,
              i & 2 ? box.max.y : box.min.y,
              i & 4 ? box.max.z : box.min.z).project(camera);
        if (v.x < min) min = v.x;
        if (v.x > max) max = v.x;
      }
      return {min, max};
    };

    return () => {
      // start from the authored placement so this is idempotent across resizes
      group.scale.copy(baseScale);
      group.position.x = baseX;
      camera.updateMatrixWorld();

      // parallax swings the camera, so reserve room for the worst case
      const slack = (o.parallax || 0) * 0.06;
      const left = o.fitFrom * 2 - 1 + slack;
      const right = 0.98;

      for (let pass = 0; pass < 2; pass++) {
        const m = measure();
        if (!m) return;

        const band = right - left;
        const width = m.max - m.min;
        if (width > band && width > 0) {
          group.scale.multiplyScalar(Math.max(0.55, band / width));
          camera.updateMatrixWorld();
          continue;                      // re-measure at the new size
        }

        if (m.min >= left) return;       // already clear, leave it alone

        // NDC -> world at the group's depth
        const dist = Math.abs(camera.position.z - group.position.z) || o.cameraZ;
        const halfH = Math.tan(camera.fov * Math.PI / 360) * dist;
        const halfW = halfH * camera.aspect;
        group.position.x += (left - m.min) * halfW;
        camera.updateMatrixWorld();
      }
    };
  })();

  const onResize = () => {
    if (innerWidth < o.minWidth) return;
    renderer.setSize(W(), H(), false);
    camera.aspect = W() / H();
    camera.updateProjectionMatrix();
    fitGroup();
  };
  addEventListener('resize', onResize, {passive: true});
  onResize();

  const baseY = o.position[1];
  const baseYaw = o.rotation ? o.rotation[1] : 0;
  const basePitch = o.rotation ? o.rotation[0] : 0;
  let raf = null, running = false;

  function frame() {
    t += 0.0125;
    if (o.tick) o.tick(t, group, ctx);
    group.rotation.y = baseYaw + Math.sin(t * 0.4) * o.spin;
    group.rotation.x = basePitch + Math.cos(t * 0.28) * 0.06;
    group.position.y = baseY + Math.sin(t * 0.6) * o.bob;
    camera.position.x += ((camBase[0] + mx * o.parallax) - camera.position.x) * 0.045;
    camera.position.y += ((camBase[1] - my * 0.7) - camera.position.y) * 0.045;
    camera.lookAt(o.lookAt[0], o.lookAt[1], o.lookAt[2]);
    renderer.render(scene, camera);
  }

  function loop() {
    raf = requestAnimationFrame(loop);
    if (!visible) return;              // don't burn battery off-screen
    frame();
  }

  const api = {
    THREE, renderer, scene, camera, group, ctx,
    /** Render a single frame without running the loop. */
    frame,
    start() { if (!running) { running = true; loop(); } },
    stop() { running = false; if (raf) cancelAnimationFrame(raf); raf = null; }
  };

  // Pause entirely when the tab is hidden — rAF already throttles, but this
  // also drops the GPU work for background tabs.
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) api.stop(); else api.start();
  });

  api.start();
  return api;
}
