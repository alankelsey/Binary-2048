type FullscreenCapableElement = HTMLElement & {
  requestFullscreen?: () => Promise<void>;
  webkitRequestFullscreen?: () => Promise<void>;
};

type FullscreenCapableDocument = Document & {
  webkitExitFullscreen?: () => Promise<void>;
  webkitFullscreenElement?: Element | null;
};

export function isFullscreenSupported(element: FullscreenCapableElement | null): boolean {
  return Boolean(element && (element.requestFullscreen || element.webkitRequestFullscreen));
}

export function isFullscreenActive(doc: FullscreenCapableDocument): boolean {
  return Boolean(doc.fullscreenElement || doc.webkitFullscreenElement);
}

export async function requestElementFullscreen(element: FullscreenCapableElement | null): Promise<boolean> {
  if (!element) return false;
  if (typeof element.requestFullscreen === "function") {
    await element.requestFullscreen();
    return true;
  }
  if (typeof element.webkitRequestFullscreen === "function") {
    await element.webkitRequestFullscreen();
    return true;
  }
  return false;
}

export async function exitDocumentFullscreen(doc: FullscreenCapableDocument): Promise<boolean> {
  if (typeof doc.exitFullscreen === "function") {
    await doc.exitFullscreen();
    return true;
  }
  if (typeof doc.webkitExitFullscreen === "function") {
    await doc.webkitExitFullscreen();
    return true;
  }
  return false;
}
