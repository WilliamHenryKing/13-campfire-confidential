import {
  CylinderGeometry,
  Group,
  LatheGeometry,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
  TorusGeometry,
  Vector2,
} from "three";
import { LAMP } from "../game/shadow";
import { chippedPaint, glass, scanned, steel } from "./materials";

// A pressure lantern on a stump. The mantle sits exactly at the rules' lamp position and is
// the only emissive surface; the real light is the point light created by the stage. None of
// these parts cast shadows: a real frame would stripe the tent and spoil the shadow play.

const [LX, LY, LZ] = LAMP;

function lathe(points: [number, number][], segments = 40) {
  return new LatheGeometry(
    points.map(([r, y]) => new Vector2(r, y)),
    segments,
  );
}

export interface Lantern {
  group: Group;
  mantle: MeshStandardMaterial;
}

export function buildLantern(): Lantern {
  const group = new Group();
  group.position.set(LX, 0, LZ);

  const stump = new Mesh(
    new CylinderGeometry(0.2, 0.23, 0.16, 28),
    scanned("bark_brown_02", "stump-bark", "#8a7a68", 0.6),
  );
  stump.position.y = 0.08;
  const rings = new Mesh(
    new CylinderGeometry(0.195, 0.195, 0.004, 28),
    scanned("fine_grained_wood", "stump-rings", "#b08a62", 0.4),
  );
  rings.position.y = 0.161;

  const fount = new Mesh(
    lathe([
      [0, 0.16],
      [0.08, 0.16],
      [0.088, 0.172],
      [0.09, 0.22],
      [0.082, 0.255],
      [0.05, 0.268],
      [0, 0.27],
    ]),
    chippedPaint("#2f4b3c", "lantern-fount", "#302d29", 0.35),
  );

  const collar = new Mesh(new CylinderGeometry(0.07, 0.072, 0.012, 32), steel("lantern-steel"));
  collar.position.y = 0.272;

  const globe = new Mesh(
    lathe(
      [
        [0.058, 0.278],
        [0.066, 0.31],
        [0.068, 0.35],
        [0.066, 0.39],
        [0.058, 0.43],
      ],
      40,
    ),
    glass(),
  );

  const mantle = new MeshStandardMaterial({
    name: "mantle",
    color: "#fff4e0",
    emissive: "#ffc27a",
    emissiveIntensity: 60,
    roughness: 0.9,
  });
  const glow = new Mesh(new SphereGeometry(0.017, 16, 12), mantle);
  glow.scale.set(1, 1.35, 1);
  glow.position.y = LY;

  const blackened = steel("blackened-steel", "#2a2826", 0.55);
  const hood = new Mesh(
    lathe([
      [0.062, 0.432],
      [0.1, 0.45],
      [0.094, 0.462],
      [0.05, 0.49],
      [0.022, 0.5],
      [0, 0.502],
    ]),
    blackened,
  );
  const vent = new Mesh(new CylinderGeometry(0.02, 0.024, 0.024, 20), blackened);
  vent.position.y = 0.512;

  const parts: Mesh[] = [stump, rings, fount, collar, globe, glow, hood, vent];
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.4;
    const rod = new Mesh(new CylinderGeometry(0.0035, 0.0035, 0.16, 6), blackened);
    rod.position.set(Math.cos(a) * 0.074, 0.355, Math.sin(a) * 0.074);
    parts.push(rod);
  }
  const bail = new Mesh(new TorusGeometry(0.075, 0.0035, 6, 28, Math.PI), blackened);
  bail.position.y = 0.5;
  bail.rotation.y = 0.5;
  parts.push(bail);

  for (const p of parts) {
    p.castShadow = false;
    p.receiveShadow = p !== globe && p !== glow;
    group.add(p);
  }
  // Glass draws after the solids so the mantle shows through it.
  globe.renderOrder = 3;
  return { group, mantle };
}
