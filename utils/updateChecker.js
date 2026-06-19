import { Platform, Linking, Alert } from 'react-native';
import Constants from 'expo-constants';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

const GITHUB_REPO = 'IDRTN/Bike-binder';
const GITHUB_API = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;

export async function checkForUpdate() {
  try {
    const currentVersion = Constants.expoConfig?.version || '1.0.0';

    const response = await fetch(GITHUB_API, {
      headers: { Accept: 'application/vnd.github.v3+json' },
    });
    if (!response.ok) return null;

    const release = await response.json();
    const latestTag = release.tag_name?.replace(/^v/, '') || '';

    if (!latestTag) return null;

    // Compare versions
    const current = currentVersion.split('.').map(Number);
    const latest = latestTag.split('.').map(Number);

    for (let i = 0; i < Math.max(current.length, latest.length); i++) {
      const c = current[i] || 0;
      const l = latest[i] || 0;
      if (l > c) {
        // Found the download URL
        const asset = release.assets?.find(
          (a) => a.name.endsWith('.apk') || a.content_type === 'application/vnd.android.package-archive'
        );
        return {
          version: latestTag,
          url: asset?.browser_download_url || release.html_url,
          notes: release.body || '',
          downloadUrl: asset?.browser_download_url || null,
        };
      }
      if (c > l) break;
    }

    return null; // up to date
  } catch {
    return null;
  }
}

export function promptUpdate(updateInfo) {
  Alert.alert(
    'Update Available',
    `Version ${updateInfo.version} is available!\n\n${updateInfo.notes || 'Tap to download.'}`,
    [
      { text: 'Later', style: 'cancel' },
      {
        text: 'Download',
        onPress: () => {
          if (updateInfo.downloadUrl) {
            Linking.openURL(updateInfo.downloadUrl);
          } else {
            Linking.openURL(updateInfo.url);
          }
        },
      },
    ]
  );
}
