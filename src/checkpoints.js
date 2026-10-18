export const DRIVE_LANE_X = 4.8;
// Shared by the baked street and the driving camera so the reference's bend
// stays aligned with the car and every checkpoint.
export function roadOffset(distance) {
  const d = Math.max(0, distance);
  return 22 * (1 - Math.exp(-((d / 90) ** 2)));
}
export function roadX(distance) {
  return DRIVE_LANE_X + roadOffset(distance);
}
export function roadHeading(distance) {
  const d = Math.max(0, distance);
  return -Math.atan(((44 * d) / 8100) * Math.exp(-((d / 90) ** 2)));
}
export const AOIS = ["App", "Web", "FOSS", "DevOps"];
export const CHECKPOINT_DISTANCES = [22, 76, 130, 184];

// Replace null with { prompt, options: ["…", "…"], answer: 0 } when the questions arrive.
// The zero-based answer is optional; omit it for discussion questions.
export const QUESTIONS = Object.fromEntries(
  AOIS.map((aoi) => [aoi, CHECKPOINT_DISTANCES.map(() => null)]),
);

export class DriveState {
  constructor(onChange = () => {}) {
    this.onChange = onChange;
    this.reset(0);
  }
  reset(aoi) {
    this.aoi = aoi;
    this.distance = 0;
    this.speed = 0;
    this.target = null;
    this.selected = null;
    this.arrived = null;
    this.input = 0;
    this.answers = new Map();
    this.onChange(this);
  }
  select(index) {
    if (
      !Number.isInteger(index) ||
      index < 0 ||
      index >= CHECKPOINT_DISTANCES.length
    )
      return;
    this.selected = index;
    this.target = CHECKPOINT_DISTANCES[index];
    this.arrived = null;
    this.input = 0;
    this.onChange(this);
  }
  drive(direction) {
    this.input = Math.sign(direction);
    if (this.input) {
      this.target = null;
      this.arrived = null;
      this.onChange(this);
    }
  }
  update(dt) {
    if (dt <= 0) return;
    const remaining = this.target === null ? null : this.target - this.distance;
    const desired =
      remaining === null
        ? this.input * 12
        : Math.sign(remaining) *
          Math.min(15, Math.sqrt(Math.abs(remaining) * 10));
    this.speed += (desired - this.speed) * (1 - Math.exp(-4 * dt));
    const previous = this.distance;
    this.distance = Math.max(0, Math.min(202, this.distance + this.speed * dt));
    if (this.distance === 0 || this.distance === 202) this.speed = 0;
    if (
      remaining !== null &&
      (Math.abs(remaining) < 0.12 ||
        (this.target - this.distance) * remaining <= 0)
    ) {
      this.distance = this.target;
      this.speed = 0;
      this.arrived = this.selected;
      this.target = null;
      this.onChange(this);
    } else if (remaining === null && this.input) {
      const index = CHECKPOINT_DISTANCES.findIndex(
        (d) =>
          (previous < d && this.distance >= d) ||
          (previous > d && this.distance <= d),
      );
      if (index >= 0) {
        this.distance = CHECKPOINT_DISTANCES[index];
        this.speed = 0;
        this.input = 0;
        this.selected = this.arrived = index;
        this.onChange(this);
      }
    }
  }
  answer(index) {
    if (this.arrived === null) return;
    this.answers.set(this.arrived, index);
    this.onChange(this);
  }
}
