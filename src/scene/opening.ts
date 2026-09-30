import { MathUtils, type PerspectiveCamera, Quaternion, Vector3 } from "three";

const query = new URLSearchParams(location.search);
const wantsTitle = query.has("intro") || (!import.meta.env.DEV && !query.has("e2e"));
export type OpeningPhase = "title" | "glide" | "done";
const ease = (value: number) => {
  const t = MathUtils.clamp(value, 0, 1);
  return t * t * (3 - 2 * t);
};

/** From the dark edge of camp to the lamp's little theatre. */
export class Opening {
  phase: OpeningPhase = wantsTitle ? "title" : "done";
  onDone: (() => void) | null = null;
  lampLevel = 1;
  private time = 0;
  private playFov = 40;
  private playView: PerspectiveCamera["view"] = null;
  private playEye = new Vector3();
  private playRotation = new Quaternion();
  private titleEye = new Vector3();
  private titleRotation = new Quaternion();
  private from = new Vector3();
  private to = new Vector3();

  rememberPlayView(camera: PerspectiveCamera) {
    this.playFov = camera.fov;
    this.playView = camera.view?.enabled ? { ...camera.view } : null;
    this.playEye.copy(camera.position);
    this.playRotation.copy(camera.quaternion);
  }

  begin(reduced: boolean) {
    if (this.phase !== "title") return;
    this.time = 0;
    this.phase = reduced ? "done" : "glide";
    if (reduced) {
      this.lampLevel = 1;
      this.onDone?.();
    }
  }

  update(camera: PerspectiveCamera, dt: number, reduced: boolean) {
    camera.position.copy(this.playEye);
    camera.quaternion.copy(this.playRotation);
    camera.fov = this.playFov;
    camera.clearViewOffset();
    if (this.phase === "done") {
      this.lampLevel = 1;
      if (this.playView) {
        const v = this.playView;
        camera.setViewOffset(v.fullWidth, v.fullHeight, v.offsetX, v.offsetY, v.width, v.height);
      }
      camera.updateProjectionMatrix();
      return;
    }
    const veil = document.getElementById("arrival");
    if (!veil || veil.classList.contains("is-done")) this.time += Math.min(dt, 0.05);
    const phone = camera.aspect < 0.9;
    let weight = 1;
    if (this.phase === "title") {
      const t = reduced ? 1 : ease(this.time / 10);
      this.from.set(phone ? -5.6 : -8.8, 2.5, phone ? 12.5 : 10.8);
      this.to.set(phone ? 1.8 : -3.5, phone ? 3.0 : 2.7, phone ? 11.8 : 10.4);
      camera.position.copy(this.from).lerp(this.to, t);
      if (!reduced) camera.position.y += Math.sin(this.time * 0.25) * 0.035;
      camera.lookAt(0.15, phone ? 2.0 : 1.8, -0.2);
      this.titleEye.copy(camera.position);
      this.titleRotation.copy(camera.quaternion);
      this.lampLevel = 0.62 + 0.25 * t;
    } else {
      const t = reduced ? 1 : ease(this.time / 2.8);
      camera.position.lerp(this.titleEye, 1 - t);
      camera.quaternion.slerp(this.titleRotation, 1 - t);
      weight = 1 - t;
      this.lampLevel = 0.87 + 0.13 * t;
      if (t === 1) {
        this.phase = "done";
        this.onDone?.();
      }
    }
    camera.fov = MathUtils.lerp(this.playFov, phone ? 58 : 42, weight);
    const height = innerHeight;
    const width = camera.aspect * height;
    camera.setViewOffset(
      width,
      height,
      MathUtils.lerp(this.playView?.offsetX ?? 0, phone ? 0 : -width * 0.22, weight),
      MathUtils.lerp(this.playView?.offsetY ?? 0, phone ? -height * 0.19 : 0, weight),
      width,
      height,
    );
  }
}
