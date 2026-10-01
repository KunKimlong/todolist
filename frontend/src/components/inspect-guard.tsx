"use client";

import { useEffect } from "react";

/** Text fields keep their normal right-click menu (paste, spell-check suggestions) */
function isEditable(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || target.closest("input, textarea, [contenteditable='true']") !== null)
  );
}

/**
 * Discourages casual inspection: blocks the right-click menu and the usual DevTools /
 * view-source shortcuts. This is a deterrent only. The browser menu, view-source: URLs
 * and direct API calls still work, so real protection stays on the server (session
 * checks, HttpOnly cookie).
 */
export function InspectGuard() {
  useEffect(() => {
    function onContextMenu(e: MouseEvent) {
      if (!isEditable(e.target)) e.preventDefault();
    }

    function onKeyDown(e: KeyboardEvent) {
      const ctrlOrCmd = e.ctrlKey || e.metaKey;
      const blocked =
        e.key === "F12" ||
        // Ctrl+Shift+I/J/C (Windows, Linux) and Cmd+Option+I/J/C (Mac): DevTools panels
        (ctrlOrCmd && (e.shiftKey || e.altKey) && ["KeyI", "KeyJ", "KeyC"].includes(e.code)) ||
        // Ctrl+U / Cmd+Option+U: view source
        (ctrlOrCmd && e.code === "KeyU");
      if (blocked) {
        e.preventDefault();
        e.stopPropagation();
      }
    }

    document.addEventListener("contextmenu", onContextMenu);
    window.addEventListener("keydown", onKeyDown, { capture: true });
    return () => {
      document.removeEventListener("contextmenu", onContextMenu);
      window.removeEventListener("keydown", onKeyDown, { capture: true });
    };
  }, []);

  return null;
}
