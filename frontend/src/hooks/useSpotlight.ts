import { useEffect } from "react";

const LIT = ".surface, .btn";

/** Cursor light: pointer position drives --cx/--cy on the page and --mx/--my on each glass element. */
export function useSpotlight() {
  useEffect(() => {
    if (typeof matchMedia !== "function" || !matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    const root = document.documentElement;
    let frame = 0;
    let x = 0;
    let y = 0;

    const paint = () => {
      frame = 0;
      root.style.setProperty("--cx", `${x}px`);
      root.style.setProperty("--cy", `${y}px`);
      document.querySelectorAll<HTMLElement>(LIT).forEach((el) => {
        const r = el.getBoundingClientRect();
        const near = x > r.left - 160 && x < r.right + 160 && y > r.top - 160 && y < r.bottom + 160;
        if (near) {
          el.style.setProperty("--mx", `${x - r.left}px`);
          el.style.setProperty("--my", `${y - r.top}px`);
          el.setAttribute("data-lit", "");
        } else {
          el.removeAttribute("data-lit");
        }
      });
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" && e.pointerType !== "pen") return;
      x = e.clientX;
      y = e.clientY;
      root.dataset.pointer = "active";
      if (!frame) frame = requestAnimationFrame(paint);
    };
    const onLeave = () => {
      delete root.dataset.pointer;
      document.querySelectorAll(LIT).forEach((el) => el.removeAttribute("data-lit"));
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerleave", onLeave);
    return () => {
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerleave", onLeave);
      if (frame) cancelAnimationFrame(frame);
      onLeave();
    };
  }, []);
}
