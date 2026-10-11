import { sidePanel } from "./dom";
import { reducedMotion } from "../util";

const LOCK = 8;
const COMMIT = 0.35;
const PROJECT_MS = 120;
const STIFFNESS = 380;
const LAND = 12;
const OWN_DRAG = ".seed, .track, input, textarea";

const idle = window.requestIdleCallback
  ? (task) => requestIdleCallback(task, { timeout: 1000 })
  : (task) => setTimeout(task, 200);
const cancelIdle = window.cancelIdleCallback || clearTimeout;

function velocity(samples) {
  const a = samples[0];
  const b = samples[samples.length - 1];
  return (b.x - a.x) / Math.max(1, b.t - a.t);
}

export default class TabSwipe {
  constructor(panel) {
    this.panel = panel;
    this.parked = new Set();
    this.next = null;
    this.side = 0;
    this.dx = 0;
    this.width = 0;
    this.gesture = null;
    this.spring = 0;
    this.job = 0;
    this.cheered = null;
    this.swiped = false;
    const { body } = panel;
    body.addEventListener("pointerdown", (e) => this.down(e));
    body.addEventListener("pointermove", (e) => this.move(e));
    body.addEventListener("pointerup", (e) => this.up(e));
    body.addEventListener("pointercancel", (e) => this.up(e));
    body.addEventListener(
      "click",
      (e) => {
        if (!this.swiped) return;
        e.stopPropagation();
        e.preventDefault();
      },
      true,
    );
  }

  get enabled() {
    return this.panel.open && !sidePanel.matches;
  }

  neighbour(step, from = this.panel.current) {
    const ids = this.panel.shownTabs();
    const at = ids.indexOf(from);
    return at < 0 ? null : ids[at + step] || null;
  }

  isNear(id) {
    return id === this.neighbour(-1) || id === this.neighbour(1);
  }

  // Builds and lays out the tabs on each side while idle, so a swipe only has to show them.
  schedule() {
    cancelIdle(this.job);
    [...this.parked].forEach((id) => {
      if (!this.isNear(id)) this.hide(id);
    });
    if (!this.enabled) return;
    const steps = [];
    [this.neighbour(1), this.neighbour(-1)].forEach((id) => {
      if (!id || this.parked.has(id)) return;
      steps.push(() => this.panel.views[id].update());
      steps.push(() => this.park(id));
    });
    const run = () => {
      if (!steps.length) return;
      if (!this.gesture && !this.spring) steps.shift()();
      this.job = idle(run);
    };
    this.job = idle(run);
  }

  park(id) {
    if (!this.isNear(id) || id === this.next) return;
    const section = this.panel.sections[id];
    section.hidden = false;
    section.classList.add("is-parked");
    // Force the layout now; content-visibility then keeps it for the swipe.
    section.getBoundingClientRect();
    section.style.contentVisibility = "hidden";
    this.parked.add(id);
  }

  hide(id) {
    const section = this.panel.sections[id];
    section.hidden = true;
    section.classList.remove("is-parked", "is-beside");
    section.style.contentVisibility = "";
    section.style.top = "";
    section.style.transform = "";
    this.parked.delete(id);
  }

  rest(id) {
    if (!this.isNear(id)) {
      this.hide(id);
      return;
    }
    const section = this.panel.sections[id];
    section.classList.remove("is-beside");
    section.classList.add("is-parked");
    section.style.top = "";
    section.style.transform = "";
    section.style.contentVisibility = "hidden";
    this.parked.add(id);
  }

  drop() {
    this.stop();
    cancelIdle(this.job);
    this.gesture = null;
    this.next = null;
    this.dx = 0;
    [...this.parked].forEach((id) => this.hide(id));
    Object.values(this.panel.sections).forEach((section) => {
      section.classList.remove("is-beside");
      Object.assign(section.style, { top: "", transform: "" });
    });
    this.panel.body.classList.remove("is-swiping");
  }

  placeBeside(id, side) {
    const { sections, views, body, current, scrolls } = this.panel;
    const section = sections[id];
    section.hidden = false;
    section.style.contentVisibility = "";
    section.classList.remove("is-parked");
    this.parked.delete(id);
    section.classList.add("is-beside");
    section.style.top = `${body.scrollTop + sections[current].offsetTop - (scrolls[id] || 0)}px`;
    views[id].update();
    this.next = id;
    this.side = side;
  }

  unplace() {
    if (!this.next) return;
    const id = this.next;
    this.next = null;
    this.rest(id);
  }

  begin() {
    this.width = this.panel.body.clientWidth;
    this.panel.measureTabs();
    this.panel.body.classList.add("is-swiping");
  }

  paint() {
    const { sections, current } = this.panel;
    sections[current].style.transform = `translate3d(${this.dx}px,0,0)`;
    if (!this.next) {
      this.panel.placeMarker(current);
      return;
    }
    sections[this.next].style.transform =
      `translate3d(${this.dx + this.side * this.width}px,0,0)`;
    const t = Math.min(1, Math.abs(this.dx) / this.width);
    this.panel.placeMarker(current, this.next, t);
  }

  moveTo(x) {
    let want = this.next;
    if (x < 0) want = this.neighbour(1);
    else if (x > 0) want = this.neighbour(-1);
    if (want !== this.next) {
      this.unplace();
      if (want) this.placeBeside(want, x < 0 ? 1 : -1);
    }
    // Past the first or last tab the list stretches a little and springs back.
    this.dx = this.next
      ? x
      : Math.sign(x) *
        (1 - 1 / ((Math.abs(x) * 0.55) / this.width + 1)) *
        this.width *
        0.35;
    this.paint();
  }

  down(e) {
    if (!this.enabled || !e.isPrimary || e.button > 0) return;
    if (e.target.closest(OWN_DRAG)) return;
    const grabbed = Boolean(this.spring);
    this.stop();
    this.gesture = {
      id: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      base: this.dx,
      locked: false,
      samples: [{ x: e.clientX, t: e.timeStamp }],
    };
    if (grabbed) this.lock(e);
  }

  lock(e) {
    this.gesture.locked = true;
    this.swiped = true;
    this.panel.body.setPointerCapture(e.pointerId);
    this.begin();
  }

  move(e) {
    const { gesture } = this;
    if (gesture?.id !== e.pointerId) return;
    const mx = e.clientX - gesture.x;
    if (!gesture.locked) {
      const my = e.clientY - gesture.y;
      if (Math.hypot(mx, my) < LOCK) return;
      if (Math.abs(mx) <= Math.abs(my)) {
        this.gesture = null;
        return;
      }
      this.lock(e);
    }
    gesture.samples.push({ x: e.clientX, t: e.timeStamp });
    while (
      gesture.samples.length > 2 &&
      e.timeStamp - gesture.samples[0].t > 90
    )
      gesture.samples.shift();
    this.moveTo(gesture.base + mx);
  }

  up(e) {
    const { gesture } = this;
    if (gesture?.id !== e.pointerId) return;
    this.gesture = null;
    if (!gesture.locked) return;
    setTimeout(() => {
      this.swiped = false;
    });
    const v = e.type === "pointercancel" ? 0 : velocity(gesture.samples);
    const projected = this.dx + v * PROJECT_MS;
    const go =
      this.next &&
      Math.sign(projected) === Math.sign(this.dx) &&
      Math.abs(projected) > this.width * COMMIT;
    this.springTo(go ? -this.side * this.width : 0, v * 1000);
  }

  slideTo(id) {
    const { panel } = this;
    const ids = panel.shownTabs();
    const side = ids.indexOf(id) > ids.indexOf(panel.current) ? 1 : -1;
    this.stop();
    panel.celebrate(id);
    this.cheered = id;
    if (this.next !== id) {
      this.unplace();
      this.dx = 0;
      this.placeBeside(id, side);
    }
    this.begin();
    this.springTo(-side * this.width, 0);
  }

  stop() {
    cancelAnimationFrame(this.spring);
    this.spring = 0;
  }

  springTo(target, startSpeed) {
    if (reducedMotion.matches) {
      this.dx = target;
      this.settle();
      return;
    }
    const low = Math.min(this.dx, target);
    const high = Math.max(this.dx, target);
    const damping = 2 * Math.sqrt(STIFFNESS);
    let x = this.dx;
    let v = startSpeed;
    let last = performance.now();
    const step = (now) => {
      const dt = Math.min(0.032, (now - last) / 1000);
      last = now;
      v += (-STIFFNESS * (x - target) - damping * v) * dt;
      x += v * dt;
      if (x < low || x > high) {
        x = Math.min(high, Math.max(low, x));
        v = 0;
      }
      this.dx = Math.abs(x - target) < 0.5 && Math.abs(v) < 30 ? target : x;
      this.paint();
      if (this.dx === target) {
        this.spring = 0;
        this.settle();
        return;
      }
      if (target && this.next && this.cheered !== this.next) {
        if (Math.abs(x - target) < LAND) {
          this.cheered = this.next;
          this.panel.celebrate(this.next);
        }
      }
      this.spring = requestAnimationFrame(step);
    };
    this.spring = requestAnimationFrame(step);
  }

  settle() {
    const { panel } = this;
    const landed = this.dx !== 0 && this.next;
    const old = panel.current;
    panel.sections[old].style.transform = "";
    if (landed) {
      const id = this.next;
      const section = panel.sections[id];
      panel.scrolls[old] = panel.body.scrollTop;
      section.classList.remove("is-beside");
      section.style.top = "";
      section.style.transform = "";
      this.next = null;
      panel.select(id);
      this.rest(old);
      panel.body.scrollTop = panel.scrolls[id] || 0;
      if (this.cheered !== id) panel.celebrate(id);
    } else {
      this.unplace();
    }
    this.dx = 0;
    this.cheered = null;
    panel.tabRects = null;
    panel.placeMarker(panel.current);
    panel.body.classList.remove("is-swiping");
    this.schedule();
  }
}
