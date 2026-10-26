/// <reference types="vite/client" />

declare const __VIDEO_STUDIO_PUBLIC__: boolean;

declare module "*.py?raw" {
  const source: string;
  export default source;
}

declare const __COMPARISON_PORT_PUBLIC__: boolean;
