import { useRef } from "react";
import { cx } from "../lib/utils";

export function ResizeHandle({
  orientation,
  onResize,
  className,
}: {
  orientation: "vertical" | "horizontal";
  onResize: (delta: number) => void;
  className?: string;
}) {
  const last = useRef(0);
  const isVertical = orientation === "vertical";

  return (
    <div
      role="separator"
      aria-orientation={isVertical ? "vertical" : "horizontal"}
      onPointerDown={(event) => {
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        last.current = isVertical ? event.clientX : event.clientY;
        document.body.classList.add("select-none");
      }}
      onPointerMove={(event) => {
        if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
        const current = isVertical ? event.clientX : event.clientY;
        const delta = current - last.current;
        if (delta === 0) return;
        last.current = current;
        onResize(delta);
      }}
      onPointerUp={(event) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
        document.body.classList.remove("select-none");
      }}
      onPointerCancel={() => document.body.classList.remove("select-none")}
      className={cx(
        "group relative z-20 shrink-0 bg-transparent transition-colors",
        isVertical
          ? "w-[5px] cursor-col-resize hover:bg-acid/20"
          : "h-[5px] cursor-row-resize hover:bg-acid/20",
        className,
      )}
    >
      <span
        className={cx(
          "absolute bg-line transition-colors group-hover:bg-acid/60",
          isVertical ? "bottom-2 left-[2px] top-2 w-px" : "left-2 right-2 top-[2px] h-px",
        )}
      />
    </div>
  );
}
