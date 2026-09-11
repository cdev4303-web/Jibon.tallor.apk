import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.jibon.ladiestailor',
  appName: 'Jibon Ladies Tailor',
  webDir: 'dist',
  bundledWebRuntime: false,
  android: {
    backgroundColor: '#ffffff'
  }
};

export default config;
