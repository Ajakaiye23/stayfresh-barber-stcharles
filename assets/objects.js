/* objects.js — the procedural hero objects, one per client site.
 *
 * Each builder takes (THREE, ctx) from hero3d.mountHero and returns a Group.
 * ctx gives {mat, h, tex, paint} — see hero3d.js.
 *
 * Modelling notes that matter for realism:
 *  - Anything turned on a lathe in reality is built with LatheGeometry from a
 *    hand-authored profile. Straight cylinders read as toys; a profile with a
 *    shoulder, a taper and a fillet reads as machined.
 *  - Flat forged parts (scissor blades, clipper blades, wrench jaws) use
 *    ExtrudeGeometry with a bevel so the edges catch a highlight.
 *  - Patterns (barber stripes, coil windings, tyre tread) are canvas textures
 *    rather than geometry — far cheaper and more convincing at this scale.
 */

/* ---------------------------------------------------------------- BARBER POLE
   Humble Barbershop. Glass sleeve over a helical stripe, chrome end caps
   lathed from a real turned profile, wall bracket. */

/* Extracted for this site only — the full library of 11 hero objects
   lives in _shared/objects.js. Regenerate with tools/build_site.py. */

export function razor(THREE, ctx) {
  const {mat, h} = ctx;
  const g = new THREE.Group();

  /* A straight razor is only recognisable when the blade is swung OPEN from
     the scales — the first version laid both flat in the same plane, which
     rendered as a featureless plank. Blade and handle are separate groups
     hinged at a shared pivot, opened ~150°, and the blade carries a thicker
     spine so it reads as a ground edge rather than a sheet of card. */
  const PIVOT = new THREE.Vector3(0, 0, 0);
  const OPEN = 2.62;                       // radians between handle and blade

  const scaleMat = new THREE.MeshPhysicalMaterial({
    color: 0x15171B, metalness: 0.25, roughness: 0.20,
    clearcoat: 1, clearcoatRoughness: 0.06, envMapIntensity: 1.9
  });

  // ---- blade assembly (hinges about the pivot) ----
  const bladeGrp = new THREE.Group();

  // face: wide at the tang, tapering to the toe
  const face = h.extrude([
    [0.15,-0.34],[3.30,-0.30],[3.62,-0.10],[3.55,0.30],[3.10,0.46],[0.15,0.50]
  ], mat.chrome, {depth: 0.085, bevel: 0.028});
  face.position.set(1.88, 0.08, 0);
  bladeGrp.add(face);

  // spine — the thick top edge that catches a hard highlight
  const spine = h.box(3.45, 0.16, 0.20, mat.chrome);
  spine.position.set(1.92, 0.50, 0);
  bladeGrp.add(spine);

  // tang + thumb notch, connecting blade to pivot
  const tang = h.extrude([
    [0,-0.26],[0.55,-0.30],[0.55,0.28],[0,0.30]
  ], mat.chrome, {depth: 0.13, bevel: 0.02});
  tang.position.set(0.28, 0.05, 0);
  bladeGrp.add(tang);

  const thumb = h.cyl(0.20, 0.20, 0.15, mat.chrome, 24);
  thumb.rotation.x = Math.PI / 2;
  thumb.position.set(-0.12, 0.02, 0);
  bladeGrp.add(thumb);

  bladeGrp.rotation.z = OPEN;
  bladeGrp.position.copy(PIVOT);
  g.add(bladeGrp);

  // ---- handle: two scales with a visible gap ----
  const handleGrp = new THREE.Group();
  [-0.17, 0.17].forEach(z => {
    const s = h.extrude([
      [0,-0.20],[-3.4,-0.30],[-3.70,-0.12],[-3.70,0.14],[-3.4,0.30],[0,0.22]
    ], scaleMat, {depth: 0.085, bevel: 0.016});
    s.position.set(-1.9, 0, z);
    handleGrp.add(s);
  });
  // wedge spacer at the far end, as on a real handle
  const wedge = h.box(0.40, 0.34, 0.30, scaleMat);
  wedge.position.set(-3.5, 0, 0);
  handleGrp.add(wedge);
  handleGrp.position.copy(PIVOT);
  g.add(handleGrp);

  // pivot pin passes through both
  const pin = h.cyl(0.10, 0.10, 0.52, mat.brass, 24);
  pin.rotation.x = Math.PI / 2;
  pin.position.copy(PIVOT);
  g.add(pin);

  return g;
}

/* --------------------------------------------------------- COIL TATTOO MACHINE
   Barry the Needle / Rooster Ink. Frame reads as a bracket, not a cage —
   keeping the top arm short is what fixes the silhouette. */
