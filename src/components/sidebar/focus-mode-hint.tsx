"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Minimize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSidebar } from "@/components/sidebar/sidebar-context";

const FADE_DELAY_MS = 2000;

export function FocusModeHint() {
  const { focusMode } = useSidebar();

  if (!focusMode) {
    return null;
  }

  // Render the inner component only when focus mode is active.
  // Mounting/unmounting resets the fade timer naturally.
  return <FocusModeHintInner />;
}

function FocusModeHintInner() {
  const { toggleFocusMode, isMac } = useSidebar();
  const [visible, setVisible] = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startFadeTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = setTimeout(() => setVisible(false), FADE_DELAY_MS);
  }, []);

  // Start the initial fade timer on mount
  useEffect(() => {
    startFadeTimer();
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [startFadeTimer]);

  // Show hint on mouse movement, then restart fade timer
  useEffect(() => {
    function handleMouseMove() {
      setVisible(true);
      startFadeTimer();
    }

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [startFadeTimer]);

  const shortcutLabel = isMac ? "⌘⇧F" : "Ctrl+Shift+F";

  return (
    <div
      className="fixed right-4 top-4 z-50 transition-opacity duration-300"
      style={{ opacity: visible ? 1 : 0 }}
    >
      <Button
        variant="secondary"
        size="sm"
        onClick={toggleFocusMode}
        className="gap-2 text-xs text-muted-foreground"
        aria-label="Exit focus mode"
      >
        <Minimize2 className="h-3 w-3" />
        Exit focus mode
        <kbd className="ml-1 text-[10px] text-white/30">{shortcutLabel}</kbd>
      </Button>
    </div>
  );
}
