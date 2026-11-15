/**
 * The documentation PDF is generated into `public/` by `npm run docs:pdf`, so
 * Vite copies it next to `index.html`. That keeps the same relative URL working
 * on the web build and inside the packaged Electron app, which loads dist over
 * file://.
 */
export const DOCS_PDF_FILE = "AcidMade-Documentation.pdf";

export function docsPdfUrl(): string {
  return "./" + DOCS_PDF_FILE;
}

export function downloadDocumentation(): void {
  const link = document.createElement("a");
  link.href = docsPdfUrl();
  link.download = DOCS_PDF_FILE;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
}
