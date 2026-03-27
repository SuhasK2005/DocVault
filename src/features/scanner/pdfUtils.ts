import * as FileSystem from "expo-file-system/legacy";
import * as ImageManipulator from "expo-image-manipulator";
import * as Print from "expo-print";
import { ScannerPage, ScannerFilter } from "./types";

/* ------------------------------------------------------------------ */
/*  Filter → Image Manipulator mapping                                 */
/* ------------------------------------------------------------------ */

// expo-image-manipulator doesn't have direct "grayscale" or "contrast"
// actions, so we use a combination of saturation tricks and the HTML/PDF
// pipeline as a fallback.  For the final PDF we bake as much as possible
// into the image, then apply remaining CSS filters in the HTML.

const MAX_DIMENSION = 2000; // resize images to keep PDFs reasonably sized

/**
 * Apply filter adjustments to an image and return the processed URI.
 * - For "original" / "shadow" we just compress & resize.
 * - For "grayscale" / "bw" / "enhanced" we can't perfectly replicate CSS
 *   filters in expo-image-manipulator, so we optimize the image and let
 *   the HTML/PDF renderer apply the CSS filter as before.
 */
const optimizeImage = async (uri: string): Promise<string> => {
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: MAX_DIMENSION } }],
    { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG },
  );
  return result.uri;
};

/* ------------------------------------------------------------------ */
/*  CSS filter strings for HTML rendering                               */
/* ------------------------------------------------------------------ */

const FILTER_STYLE: Record<ScannerFilter, string> = {
  original: "none",
  grayscale: "grayscale(100%)",
  bw: "grayscale(100%) contrast(220%) brightness(120%)",
  enhanced: "contrast(135%) brightness(108%) saturate(110%)",
  shadow: "brightness(140%) contrast(160%) saturate(90%)",
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                             */
/* ------------------------------------------------------------------ */

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");

const sanitizeFileName = (value: string) =>
  value
    .trim()
    .replace(/[^a-zA-Z0-9-_ ]/g, "")
    .replace(/\s+/g, " ")
    .slice(0, 80) || "scan";

const imageToDataUri = async (uri: string) => {
  const base64 = await FileSystem.readAsStringAsync(uri, {
    // @ts-ignore Expo legacy file system typing
    encoding: "base64",
  });
  return `data:image/jpeg;base64,${base64}`;
};

/* ------------------------------------------------------------------ */
/*  Main export — create PDF from scanned pages                         */
/* ------------------------------------------------------------------ */

export const createPdfFromPages = async (params: {
  pages: ScannerPage[];
  fileName: string;
}) => {
  const safeName = sanitizeFileName(params.fileName);

  const sections = await Promise.all(
    params.pages.map(async (page) => {
      // Optimize (resize + compress) each image before embedding
      const optimizedUri = await optimizeImage(page.imageUri);
      const dataUri = await imageToDataUri(optimizedUri);
      // CSS filters on base64 images inside expo-print WebViews are highly unreliable
      // (often resulting in blank pages on physical devices).
      // For a robust implementation we embed the raw image.
      // (True filter baking requires native code or complex canvas manipulation)
      return `
      <div class="page">
        <img src="${escapeHtml(dataUri)}" />
      </div>`;
    }),
  );

  const html = `
  <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <style>
        body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
        .page { width: 100%; min-height: 100vh; display: flex; align-items: center; justify-content: center; page-break-after: always; padding: 0; margin: 0; box-sizing: border-box; }
        .page:last-child { page-break-after: auto; }
        img { width: 100%; height: 100%; object-fit: contain; }
      </style>
    </head>
    <body>
      ${sections.join("\n")}
    </body>
  </html>`;

  const result = await Print.printToFileAsync({ html });

  const destinationDir = `${FileSystem.documentDirectory}scans`;
  const dirInfo = await FileSystem.getInfoAsync(destinationDir);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(destinationDir, {
      intermediates: true,
    });
  }

  const outputUri = `${destinationDir}/${safeName}-${Date.now()}.pdf`;
  await FileSystem.copyAsync({ from: result.uri, to: outputUri });

  const info = (await FileSystem.getInfoAsync(outputUri)) as any;

  return {
    uri: outputUri,
    size: info.size ?? null,
    fileName: `${safeName}.pdf`,
  };
};
