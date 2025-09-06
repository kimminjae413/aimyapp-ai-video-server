import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.hairgator.faceswap',
  appName: 'HairGator FaceSwap',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  },
  plugins: {
    Camera: {
      permissions: ['camera', 'photos']
    },
    Filesystem: {
      permissions: ['storage']
    }
  },
  android: {
    allowMixedContent: true
  },
  ios: {
    scheme: 'HairGator FaceSwap'
  }
};

export default config;
