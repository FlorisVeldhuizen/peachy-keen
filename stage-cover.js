export default function createStageCover(renderer, draw) {
  const stage = renderer.domElement;
  const cover = document.createElement("canvas");
  cover.className = "stage-cover";
  cover.hidden = true;
  stage.after(cover);
  let held = false;

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden || held || renderer.getContext().isContextLost())
      return;
    // The drawing buffer is only readable in the task that drew it.
    draw();
    cover.width = stage.width;
    cover.height = stage.height;
    cover.getContext("2d").drawImage(stage, 0, 0);
  });
  stage.addEventListener("webglcontextlost", () => {
    held = true;
    cover.classList.remove("is-leaving");
    if (cover.width > 0) cover.hidden = false;
    else stage.style.visibility = "hidden";
  });

  return {
    release() {
      held = false;
      stage.style.visibility = "";
      if (cover.hidden) return;
      cover.classList.add("is-leaving");
      setTimeout(() => {
        if (!held) cover.hidden = true;
      }, 300);
    },
  };
}
