import {
  BufferGeometry,
  CylinderGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  SphereGeometry,
} from "three";
import { WALL } from "../game/shadow";
import { canvasWeave, grass } from "./textures";

// The tent end wall (the screen), its gable, side flaps, poles and a little set dressing
// placed outside the lamp's cone so nothing but the props throws a shadow on the canvas.

const TENT_W = WALL.maxX - WALL.minX + 0.6;
const EAVE = 3.7;
const PEAK = 4.9;

function gable(material: MeshStandardMaterial): Mesh {
  const g = new BufferGeometry();
  const half = TENT_W / 2;
  g.setAttribute(
    "position",
    new Float32BufferAttribute([-half, EAVE, 0, half, EAVE, 0, 0, PEAK, 0], 3),
  );
  g.setAttribute("uv", new Float32BufferAttribute([0, 0, 4, 0, 2, 0.7], 2));
  g.computeVertexNormals();
  const m = new Mesh(g, material);
  m.receiveShadow = true;
  return m;
}

export function buildCampsite(): Group {
  const site = new Group();
  const weave = canvasWeave();
  weave.repeat.set(4, 2);
  const canvas = new MeshStandardMaterial({ map: weave, color: "#f3e3c2", roughness: 0.95 });

  const wall = new Mesh(new PlaneGeometry(TENT_W, EAVE), canvas);
  wall.position.set(0, EAVE / 2, 0);
  wall.receiveShadow = true;
  site.add(wall, gable(canvas));

  const seam = new MeshStandardMaterial({ color: "#c9b089", roughness: 0.9 });
  for (const x of [-TENT_W / 4, TENT_W / 4]) {
    const s = new Mesh(new PlaneGeometry(0.05, EAVE), seam);
    s.position.set(x, EAVE / 2, 0.004);
    s.receiveShadow = true;
    site.add(s);
  }
  const hem = new Mesh(new PlaneGeometry(TENT_W, 0.12), seam);
  hem.position.set(0, 0.06, 0.004);
  hem.receiveShadow = true;
  site.add(hem);

  const flapMat = new MeshStandardMaterial({
    map: weave,
    color: "#d8c29b",
    roughness: 0.95,
    side: DoubleSide,
  });
  for (const side of [-1, 1]) {
    const flap = new Mesh(new PlaneGeometry(2.6, EAVE), flapMat);
    flap.position.set(side * (TENT_W / 2 + 0.55), EAVE / 2, 1.15);
    flap.rotation.y = side * -1.15;
    flap.receiveShadow = true;
    site.add(flap);
  }

  const wood = new MeshStandardMaterial({ color: "#6b4a30", roughness: 0.8 });
  for (const x of [-TENT_W / 2, TENT_W / 2]) {
    const pole = new Mesh(new CylinderGeometry(0.045, 0.05, EAVE + 0.1, 12), wood);
    pole.position.set(x, (EAVE + 0.1) / 2, 0.06);
    site.add(pole);
  }
  const ridge = new Mesh(new CylinderGeometry(0.04, 0.04, 4.2, 10), wood);
  ridge.rotation.x = Math.PI / 2;
  ridge.position.set(0, PEAK + 0.02, 2.1);
  site.add(ridge);

  const turf = grass();
  turf.repeat.set(10, 10);
  const lawn = new Mesh(
    new PlaneGeometry(30, 30),
    new MeshStandardMaterial({ map: turf, color: "#8a9070", roughness: 1 }),
  );
  lawn.rotation.x = -Math.PI / 2;
  lawn.position.y = 0.002;
  lawn.receiveShadow = true;
  site.add(lawn);

  const sheet = new Mesh(
    new PlaneGeometry(TENT_W, 4.2),
    new MeshStandardMaterial({ color: "#5b6b58", roughness: 0.9 }),
  );
  sheet.rotation.x = -Math.PI / 2;
  sheet.position.set(0, 0.006, 2.1);
  sheet.receiveShadow = true;
  site.add(sheet);

  // A log bench and stones behind the lantern: in the warm light, out of the shadow play.
  const bark = new MeshStandardMaterial({ color: "#5a3b26", roughness: 0.9 });
  const log = new Mesh(new CylinderGeometry(0.16, 0.18, 1.8, 14), bark);
  log.rotation.z = Math.PI / 2;
  log.rotation.y = 0.35;
  log.position.set(-1.7, 0.17, 5.4);
  const stoneMat = new MeshStandardMaterial({ color: "#77736b", roughness: 0.85 });
  site.add(log);
  const stones: [number, number, number][] = [
    [0.55, 0.07, 4.2],
    [-0.5, 0.06, 4.5],
    [0.3, 0.05, 4.95],
    [-0.35, 0.06, 4.0],
  ];
  for (const [x, r, z] of stones) {
    const stone = new Mesh(new SphereGeometry(r * 1.6, 10, 8), stoneMat);
    stone.scale.y = 0.6;
    stone.position.set(x, r * 0.5, z);
    site.add(stone);
  }
  return site;
}
