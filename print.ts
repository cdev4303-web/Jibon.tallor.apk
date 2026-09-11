import { exportElementToPdf, PdfExportOptions } from './pdf';

export function isIframeEnvironment(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

export function isMobileBrowser(): boolean {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

/**
 * Robust cross-device printing execution.
 * 1. Synchronously calls window.print() inside user interaction context.
 * 2. Does NOT trigger unintended PDF downloads when Print is clicked.
 * 3. Prepares document title for clean print spooler naming.
 */
export async function printHtmlElement(
  elementIdOrElement: string | HTMLElement,
  title?: string
): Promise<boolean> {
  const origTitle = document.title;
  const docTitle = title || origTitle || 'Document Print';

  if (title) {
    document.title = docTitle;
  }

  let directPrintSucceeded = false;

  try {
    // Direct synchronous execution - preserves browser user activation token
    window.focus();
    window.print();
    directPrintSucceeded = true;
  } catch (err) {
    console.warn('[Print] Direct window.print() was blocked or failed:', err);
    directPrintSucceeded = false;
  } finally {
    if (title) {
      setTimeout(() => {
        document.title = origTitle;
      }, 2000);
    }
  }

  return directPrintSucceeded;
}

export { exportElementToPdf };
export type { PdfExportOptions };
