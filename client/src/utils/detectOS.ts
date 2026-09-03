export type PlatformOS = 'mac-arm' | 'mac-intel' | 'linux' | 'windows' | 'unknown';

export interface DetectedPlatform {
  os: PlatformOS;
  label: string;
  downloadFilename: string;
  architecture: string;
}

export function detectUserOS(): DetectedPlatform {
  if (typeof window === 'undefined') {
    return {
      os: 'unknown',
      label: 'Desktop App',
      downloadFilename: 'Conduit.dmg',
      architecture: 'Universal',
    };
  }

  const userAgent = window.navigator.userAgent.toLowerCase();
  const platform = (window.navigator as any).userAgentData?.platform?.toLowerCase() || window.navigator.platform.toLowerCase();

  // macOS
  if (platform.includes('mac') || userAgent.includes('macintosh')) {
    // Check Apple Silicon
    const isArm = userAgent.includes('arm') || (window.navigator as any).userAgentData?.brands?.some((b: any) => b.brand.includes('Apple'));
    if (isArm) {
      return {
        os: 'mac-arm',
        label: 'macOS (Apple Silicon)',
        downloadFilename: 'Conduit-1.0.0-arm64.dmg',
        architecture: 'Apple Silicon (M1/M2/M3/M4)',
      };
    }
    return {
      os: 'mac-intel',
      label: 'macOS (Intel)',
      downloadFilename: 'Conduit-1.0.0-x64.dmg',
      architecture: 'Intel 64-bit',
    };
  }

  // Windows
  if (platform.includes('win') || userAgent.includes('windows')) {
    return {
      os: 'windows',
      label: 'Windows (x64)',
      downloadFilename: 'Conduit.exe',
      architecture: 'Windows 64-bit Executable',
    };
  }

  // Linux
  if (platform.includes('linux') || userAgent.includes('linux') || userAgent.includes('x11')) {
    return {
      os: 'linux',
      label: 'Linux (AppImage)',
      downloadFilename: 'Conduit-1.0.0.AppImage',
      architecture: 'Linux x86_64 AppImage',
    };
  }

  return {
    os: 'unknown',
    label: 'Download Desktop',
    downloadFilename: 'Conduit-1.0.0.AppImage',
    architecture: 'Universal',
  };
}
