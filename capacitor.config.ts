import type { CapacitorConfig } from "@capacitor/cli";

const productionUrl =
  process.env.CAPACITOR_SERVER_URL?.trim() ||
  "https://alpha9in.vercel.app";

const config: CapacitorConfig = {
  appId: "com.mavcodeai.alpha",
  appName: "Alpha",
  webDir: "android-web",
  backgroundColor: "#0b0d12",
  loggingBehavior: "none",
  android: {
    minWebViewVersion: 60,
    webContentsDebuggingEnabled: false,
    backgroundColor: "#0b0d12",
  },
  plugins: {
    Keyboard: {
      resize: "body",
      resizeOnFullScreen: true,
    },
    StatusBar: {
      overlaysWebView: false,
      style: "DARK",
      backgroundColor: "#0b0d12",
    },
  },
  server: {
    url: productionUrl,
    cleartext: false,
  },
};

export default config;
