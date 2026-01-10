import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.fastcomand.app',
  appName: 'Fast Comand SM',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;