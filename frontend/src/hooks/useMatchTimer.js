import { useState, useEffect, useCallback } from "react";

// `initial` lets a saved match restore its clock: { seconds, status }.
export function useMatchTimer(initial = {}) {
  const [seconds, setSeconds] = useState(initial.seconds ?? 0);
  const [status, setStatus] = useState(initial.status ?? "idle"); // idle | running | paused | ended

  useEffect(() => {
    if (status !== "running") return; // only tick while running

    const id = setInterval(() => {
      setSeconds((s) => s + 1);
    }, 1000);

    return () => clearInterval(id); // cleanup: stops the old interval
  }, [status]);

  // useCallback keeps these function identities stable between renders, so
  // effects that use them don't re-run needlessly.
  const start = useCallback(() => setStatus("running"), []);
  const pause = useCallback(() => setStatus("paused"), []);
  const resume = useCallback(() => setStatus("running"), []);
  const end = useCallback(() => setStatus("ended"), []);
  const reset = useCallback(() => {
    setSeconds(0);
    setStatus("idle");
  }, []);

  return { seconds, status, start, pause, resume, end, reset };
}

// Turns 75 seconds into "01:15"
export function formatTime(totalSeconds) {
  const m = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const s = String(totalSeconds % 60).padStart(2, "0");
  return `${m}:${s}`;
}
