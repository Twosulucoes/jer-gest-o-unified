declare module "@capacitor-mlkit/barcode-scanning" {
  export interface Barcode {
    rawValue: string;
    format: string;
  }
  export interface ScanResult {
    barcodes: Barcode[];
  }
  export interface PermissionStatus {
    camera: "granted" | "denied" | "limited" | "prompt";
  }
  export const BarcodeScanner: {
    requestPermissions(): Promise<PermissionStatus>;
    scan(): Promise<ScanResult>;
    toggleTorch(): Promise<void>;
  };
}
