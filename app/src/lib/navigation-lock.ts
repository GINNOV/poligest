type NavigationLockListener = (locked: boolean) => void;

let navigationLocked = false;
const listeners = new Set<NavigationLockListener>();

export const NAV_LOCK_EVENT = "app:navigation-lock";

export function isNavigationLocked() {
  return navigationLocked;
}

export function setNavigationLocked(locked: boolean) {
  if (navigationLocked === locked) return;
  navigationLocked = locked;
  listeners.forEach((listener) => listener(locked));

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(NAV_LOCK_EVENT, { detail: locked }));
  }
}

export function subscribeNavigationLock(listener: NavigationLockListener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
