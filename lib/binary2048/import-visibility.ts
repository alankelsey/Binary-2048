export function shouldShowImportJson(uiEnabled: boolean, authenticated: boolean): boolean {
  return uiEnabled && authenticated;
}
