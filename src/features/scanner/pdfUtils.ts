import * as FileSystem from "expo-file-system/legacy";
import * as ImageManipulator from "expo-image-manipulator";
import * as Print from "expo-print";
import { ScannerPage } from "./types";

/* ------------------------------------------------------------------ */

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

const OUTPUT_WIDTH = 2400;
const OUTPUT_HEIGHT = 3600;

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
      const optimizedUri = await ImageManipulator.manipulateAsync(
        page.imageUri,
        [{ resize: { width: OUTPUT_WIDTH, height: OUTPUT_HEIGHT } }],
        { compress: 0.92, format: ImageManipulator.SaveFormat.JPEG },
      );
      const dataUri = await imageToDataUri(optimizedUri.uri);
      return `
      <div class="page">
        <div class="sheet">
          <img src="${escapeHtml(dataUri)}" />
        </div>
      </div>`;
    }),
  );

  const html = `
  <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <style>
        @page {
          size: 8in 12in;
          margin: 0;
        }
        html, body {
          margin: 0;
          padding: 0;
          width: 8in;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          background: #000;
        }
        .page {
          width: 8in;
          height: 12in;
          margin: 0;
          padding: 0;
          page-break-after: always;
          page-break-inside: avoid;
          break-inside: avoid;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          box-sizing: border-box;
        }
        .page:last-child { page-break-after: auto; }
        .sheet {
          width: 8in;
          height: 12in;
          margin: 0;
          padding: 0;
          background: #fff;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          box-sizing: border-box;
        }
        img {
          display: block;
          width: 100%;
          height: 100%;
          object-fit: contain;
          object-position: center center;
          margin: 0;
          padding: 0;
        }
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
