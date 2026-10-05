import { useEffect, useRef, type ReactNode } from "react";

export function KeyAlignedColumns({
  children,
  alignTo = "input",
}: {
  children: ReactNode;
  alignTo?: "key" | "input";
}) {
  const columnsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const columns = columnsRef.current;
    const inputColumn = columns?.querySelector<HTMLElement>(".workspace__input-column");
    const alignmentPanel = columns?.querySelector<HTMLElement>(
      alignTo === "input"
        ? ".workspace__input-column .panel"
        : ".workspace__input-column .config-section .panel",
    );
    const resultPanel = columns?.querySelector<HTMLElement>(".cipher-output-panel > .panel");
    if (!columns || !inputColumn || !alignmentPanel || !resultPanel) return;

    const updateHeight = () => {
      if (alignTo === "key" && window.innerWidth <= 800) {
        columns.style.removeProperty("--key-aligned-output-height");
        return;
      }
      const height =
        alignTo === "input"
          ? alignmentPanel.getBoundingClientRect().height
          : alignmentPanel.getBoundingClientRect().bottom - resultPanel.getBoundingClientRect().top;
      columns.style.setProperty("--key-aligned-output-height", `${Math.max(0, height)}px`);
    };
    const observer = new ResizeObserver(updateHeight);
    observer.observe(inputColumn);
    observer.observe(alignmentPanel);
    window.addEventListener("resize", updateHeight);
    updateHeight();
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateHeight);
    };
  }, [alignTo]);

  return (
    <div ref={columnsRef} className="workspace__columns workspace__columns--key-aligned">
      {children}
    </div>
  );
}
