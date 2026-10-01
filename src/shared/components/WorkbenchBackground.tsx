import { useEffect, useRef } from "react";

// Decorative only: render outside React's state updates while the user types.
export function WorkbenchBackground({ variant = "dots" }: { variant?: "dots" | "hex" }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || typeof CanvasRenderingContext2D === "undefined") return;
    const context = canvas.getContext("2d");
    if (!context) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const touch = window.matchMedia("(pointer: coarse)");
    let width = 0;
    let height = 0;
    let frame = 0;
    let timer: ReturnType<typeof setInterval> | undefined;
    let visible = true;
    let strength = 0;
    let target = 0;
    let pointer = { x: -1000, y: -1000 };
    let dotColor = "";
    let accent = "";
    let hexColor = "";
    let cells: string[] = [];
    const spacing = variant === "dots" ? 32 : 24;

    function paint() {
      if (!context) return;
      context.clearRect(0, 0, width, height);
      context.font = '13px "SFMono-Regular", Consolas, monospace';
      let index = 0;
      for (let y = 16; y < height; y += spacing) {
        for (let x = 16; x < width; x += spacing) {
          if (variant === "hex") {
            context.fillStyle = index % 13 === 0 ? accent : hexColor;
            context.fillText(cells[index] ?? "0", x, y);
          } else {
            const dx = x - pointer.x;
            const dy = y - pointer.y;
            const distance = Math.hypot(dx, dy);
            const proximity = Math.max(0, 1 - distance / 145) * strength;
            const offset = proximity * 15;
            context.fillStyle = proximity > 0.1 ? accent : dotColor;
            context.globalAlpha = proximity > 0.1 ? 0.35 + proximity * 0.5 : 1;
            context.beginPath();
            context.arc(
              x + (dx / (distance || 1)) * offset,
              y + (dy / (distance || 1)) * offset,
              1 + proximity * 0.8,
              0,
              Math.PI * 2,
            );
            context.fill();
            context.globalAlpha = 1;
          }
          index += 1;
        }
      }
    }

    function animate() {
      frame = 0;
      strength += (target - strength) * 0.16;
      paint();
      if (Math.abs(target - strength) > 0.005) frame = requestAnimationFrame(animate);
    }

    function move(event: PointerEvent) {
      if (variant !== "dots" || reduced.matches || touch.matches || document.hidden) return;
      pointer = { x: event.clientX, y: event.clientY };
      target = 1;
      if (!frame) frame = requestAnimationFrame(animate);
    }

    function leave() {
      target = 0;
      if (!frame && !reduced.matches && !document.hidden) frame = requestAnimationFrame(animate);
    }

    function schedule() {
      clearInterval(timer);
      cancelAnimationFrame(frame);
      frame = 0;
      strength = target = 0;
      paint();
      if (variant !== "hex" || reduced.matches || touch.matches || document.hidden || !visible)
        return;
      timer = setInterval(() => {
        for (let i = 0; i < Math.ceil(cells.length * 0.06); i += 1)
          cells[Math.floor(Math.random() * cells.length)] = Math.floor(Math.random() * 16)
            .toString(16)
            .toUpperCase();
        paint();
      }, 750);
    }

    function resize() {
      const bounds = canvas!.getBoundingClientRect();
      width = bounds.width;
      height = bounds.height;
      const scale = Math.min(window.devicePixelRatio || 1, 2);
      canvas!.width = Math.round(width * scale);
      canvas!.height = Math.round(height * scale);
      context!.setTransform(scale, 0, 0, scale, 0, 0);
      const styles = getComputedStyle(document.documentElement);
      dotColor = styles.getPropertyValue("--background-dot").trim();
      accent = styles.getPropertyValue("--accent").trim();
      hexColor = styles.getPropertyValue("--background-hex").trim();
      cells = Array.from(
        { length: Math.ceil(width / spacing) * Math.ceil(height / spacing) },
        (_, index) => ((index * 7 + Math.floor(index / 9)) % 16).toString(16).toUpperCase(),
      );
      schedule();
    }

    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    const themeObserver = new MutationObserver(resize);
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    const intersection = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      schedule();
    });
    intersection.observe(canvas);
    window.addEventListener("pointermove", move, { passive: true });
    document.documentElement.addEventListener("pointerleave", leave);
    document.addEventListener("visibilitychange", schedule);
    reduced.addEventListener("change", schedule);
    touch.addEventListener("change", schedule);
    resize();
    return () => {
      observer.disconnect();
      themeObserver.disconnect();
      intersection.disconnect();
      cancelAnimationFrame(frame);
      clearInterval(timer);
      window.removeEventListener("pointermove", move);
      document.documentElement.removeEventListener("pointerleave", leave);
      document.removeEventListener("visibilitychange", schedule);
      reduced.removeEventListener("change", schedule);
      touch.removeEventListener("change", schedule);
    };
  }, [variant]);

  return (
    <canvas
      ref={ref}
      className={`workbench-background workbench-background--${variant}`}
      aria-hidden="true"
    />
  );
}
