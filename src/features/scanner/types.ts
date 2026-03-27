export type ScannerFilter = "original" | "grayscale" | "bw" | "enhanced" | "shadow";

export type ScannerPage = {
  id: string;
  imageUri: string;
  filter: ScannerFilter;
};

export type CropPoint = {
  x: number;
  y: number;
};
