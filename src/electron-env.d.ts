export {};

declare global {
  interface Window {
    acidmade?: {
      runtimeUrl?: string;
      platform?: string;
      versions?: {
        electron: string;
        chrome: string;
        node: string;
      };
    };
  }
}
