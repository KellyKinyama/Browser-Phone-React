import { useEffect } from "react";
import { useAppStore } from "../state/store";
import { BP_NARROW } from "../constants";

// Tracks the wide/narrow layout breakpoint and feeds it into the ui slice.
export function useBreakpoint(): void {
  const setBreakpoint = useAppStore((s) => s.setBreakpoint);
  useEffect(() => {
    const apply = () =>
      setBreakpoint(window.innerWidth <= BP_NARROW ? "narrow" : "wide");
    apply();
    window.addEventListener("resize", apply);
    return () => window.removeEventListener("resize", apply);
  }, [setBreakpoint]);
}
