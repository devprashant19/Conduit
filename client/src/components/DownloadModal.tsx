import { useState, useEffect } from 'react';
import { detectUserOS, type DetectedPlatform } from '../utils/detectOS';

interface DownloadOption {
  platform: string;
  osName: string;
  icon: string;
  status: 'active' | 'coming_soon';
  badge?: string;
  formats: { label: string; file: string; size: string; available?: boolean }[];
}

const DOWNLOAD_OPTIONS: DownloadOption[] = [
  {
    platform: 'win',
    osName: 'Windows',
    icon: '🪟',
    status: 'active',
    badge: 'Available Now',
    formats: [
      { label: 'Standalone Executable (.exe)', file: 'Conduit.exe', size: '234 MB', available: true },
      { label: 'Portable Archive (.zip)', file: 'Conduit-1.0.0-win.zip', size: '543 MB', available: true },
    ],
  },
  {
    platform: 'mac',
    osName: 'macOS',
    icon: '🍎',
    status: 'coming_soon',
    badge: 'Coming Soon',
    formats: [
      { label: 'Apple Silicon (M1/M2/M3/M4)', file: 'Conduit-1.0.0-arm64.dmg', size: 'In review', available: false },
      { label: 'Intel x64 (.dmg)', file: 'Conduit-1.0.0-x64.dmg', size: 'In review', available: false },
    ],
  },
  {
    platform: 'linux',
    osName: 'Linux',
    icon: '🐧',
    status: 'coming_soon',
    badge: 'Coming Soon',
    formats: [
      { label: 'AppImage (Universal)', file: 'Conduit-1.0.0.AppImage', size: 'In build', available: false },
      { label: 'Debian / Ubuntu (.deb)', file: 'conduit_1.0.0_amd64.deb', size: 'In build', available: false },
    ],
  },
];

interface DownloadModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function DownloadModal({ isOpen, onClose }: DownloadModalProps) {
  const [detected, setDetected] = useState<DetectedPlatform | null>(null);

  useEffect(() => {
    setDetected(detectUserOS());
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleDownload = (filename: string) => {
    const link = document.createElement('a');
    link.href = `/downloads/${filename}`;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="download-modal-overlay" onClick={onClose}>
      <div className="download-modal-container" onClick={(e) => e.stopPropagation()}>
        <button className="download-modal-close" onClick={onClose} aria-label="Close modal">
          ×
        </button>

        <div className="download-section-header">
          <span className="step-num">GET CONDUIT</span>
          <h2 className="section-title">
            Run your multi-agent studio <span className="highlight-pill">locally</span>
          </h2>
          <p className="section-subtitle">
            Full native performance with real pseudo-terminals, local JSON/SQLite persistence, and Bedrock supervisor safety.
          </p>

          {detected && (
            <div className="primary-detected-download">
              <button
                className="primary-download-btn"
                onClick={() => handleDownload('Conduit.exe')}
              >
                <span className="download-btn-icon">⬇</span>
                <div className="download-btn-content">
                  <span className="download-main-text">Download for Windows (x64)</span>
                  <span className="download-sub-text">v1.0.0 · Standalone Executable (.exe) · Free & Open Source</span>
                </div>
              </button>
            </div>
          )}
        </div>

        <div className="download-matrix-grid">
          {DOWNLOAD_OPTIONS.map((opt) => (
            <div key={opt.platform} className={`download-platform-card ${opt.status === 'active' ? 'platform-active' : 'platform-pending'}`}>
              <div className="platform-card-header">
                <span className="platform-icon">{opt.icon}</span>
                <h3 className="platform-name">{opt.osName}</h3>
                {opt.badge && (
                  <span className={`platform-status-badge ${opt.status}`}>
                    {opt.badge}
                  </span>
                )}
              </div>
              <div className="platform-formats-list">
                {opt.formats.map((fmt) => (
                  <div key={fmt.file} className={`download-format-row ${fmt.available ? 'available' : 'unavailable'}`}>
                    <div className="format-info">
                      <span className="format-label">{fmt.label}</span>
                      <span className="format-size">{fmt.size}</span>
                    </div>
                    {fmt.available ? (
                      <button
                        className="format-download-btn active"
                        onClick={() => handleDownload(fmt.file)}
                        title={`Download ${fmt.file}`}
                      >
                        Download .exe
                      </button>
                    ) : (
                      <span className="format-coming-soon-tag">Coming Soon</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="download-footer-note">
          <span>SHA-256 verified · Packaged with Electron & Node-PTY · Open Source · MIT License</span>
        </div>
      </div>
    </div>
  );
}
