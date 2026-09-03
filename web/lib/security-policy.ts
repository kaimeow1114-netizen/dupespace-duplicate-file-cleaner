export function contentSecurityPolicy(nonce: string, privateWorkspace: boolean): string {
  const scripts = privateWorkspace ? `'self' 'nonce-${nonce}'` : `'nonce-${nonce}' 'strict-dynamic' 'self' https:`;
  const resources = privateWorkspace ? "connect-src 'self'; frame-src 'none'; img-src 'self' data: blob:;" : "connect-src 'self' https:; frame-src https:; img-src 'self' data: blob: https:;";
  return `default-src 'self'; script-src ${scripts}; style-src 'self' 'unsafe-inline'; ${resources} object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests`;
}
