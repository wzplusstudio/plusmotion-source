/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { MakerDMG } from '@electron-forge/maker-dmg';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerZIP } from '@electron-forge/maker-zip';
import { copyFileSync, existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { arch } from 'node:os';
import { dirname, join } from 'node:path';

import type { ForgeConfig } from '@electron-forge/shared-types';
import type { MakerSquirrelConfig } from '@electron-forge/maker-squirrel';

const { version } = JSON.parse(readFileSync(join(__dirname, '..', '..', 'package.json'), 'utf8'));


const sign = windowsSign();

const config: ForgeConfig = {
  packagerConfig: {
    name: 'PlusMotion',
    appBundleId: 'com.wzpluslabs.plusmotion',
    appCategoryType: 'public.app-category.video',
    appVersion: version,
    icon: './assets/icon',
    win32metadata: {
      CompanyName: 'WZPLUS LABS LTD',
      ProductName: 'PlusMotion',
      FileDescription: 'PlusMotion',
      'application-manifest': join(__dirname, 'assets', 'app.manifest'),
    },
    protocols: [{ name: 'PlusMotion', schemes: ['plusmotion'] }],
    prune: false,
    ignore: (path) =>
      path !== '' &&
      path !== '/package.json' &&
      path !== '/dist' &&
      !path.startsWith('/dist/') &&
      path !== '/web' &&
      !path.startsWith('/web/'),
    // Staged by scripts/stage-{cli,runtime,docs}.mjs; end up at
    // Contents/Resources/{cli,runtime,docs}.
    extraResource: ['./cli', './runtime', './docs'],
    // Signed with a minimal entitlement set (assets/entitlements.plist) instead of the template's broad default.
    osxSign: process.env.SKIP_SIGN ? undefined : { optionsForFile: () => ({ entitlements: join(__dirname, 'assets', 'entitlements.plist'), hardenedRuntime: true }) },
    osxNotarize:
      process.env.APPLE_ID && process.env.APPLE_PASSWORD && process.env.APPLE_TEAM_ID
        ? {
          appleId: process.env.APPLE_ID,
          appleIdPassword: process.env.APPLE_PASSWORD,
          teamId: process.env.APPLE_TEAM_ID,
        }
        : undefined,
    windowsSign: sign,
  },
  makers: [
    new MakerZIP({}, ['darwin']),
    new MakerSquirrel({
      name: 'PlusMotion',
      authors: 'WZPLUS LABS LTD',
      description: 'Reels, documentaries and ads from one workspace',
      exe: 'PlusMotion.exe',
      setupExe: `PlusMotion-${process.arch}-Setup.exe`,
      setupIcon: './assets/icon.ico',
      loadingGif: './assets/install-spinner.gif',
      // Shown by Add/Remove Programs; Squirrel only takes a URL.
      // iconUrl: set when PlusMotion has a public icon URL for the Squirrel installer.
      noMsi: true,
      windowsSign: sign,
    }),
    new MakerDMG({
      name: `PlusMotion-${process.arch}`,
      icon: './assets/icon.icns',
      // Dark, on-brand window; @2x sibling is picked up automatically for retina.
      background: './assets/dmg-background.png',
      iconSize: 120,
      additionalDMGOptions: {
        'background-color': '#1c1c1c',
        window: { size: { width: 658, height: 498 } },
      },
      contents: (opts) => [
        { x: 188, y: 217, type: 'file', path: opts.appPath },
        { x: 470, y: 217, type: 'link', path: '/Applications' },
      ],
    }),
  ],
  // PlusMotion: no publisher is configured. Releases are uploaded by hand until a release channel exists.
  publishers: [],
  hooks: {
    prePackage: async () => {
      if (process.platform === 'win32' && !process.env.SKIP_SIGN && !sign) {
        throw new Error(
          'Windows signing needs WINDOWS_SIGNTOOL_PATH, WINDOWS_SIGN_DLIB and WINDOWS_SIGN_METADATA; set SKIP_SIGN=1 for an unsigned build.',
        );
      }
    },
    postPackage: async () => {
      // Notarisation is done afterwards with notarytool (see docs/plusmotion). Say so loudly, so a build is never mistaken for a release.
      if (process.platform === 'darwin' && !process.env.SKIP_SIGN && !(process.env.APPLE_ID && process.env.APPLE_PASSWORD && process.env.APPLE_TEAM_ID)) {
        console.warn('\n*** This build is signed but NOT notarised. Submit it with notarytool and staple the ticket before giving it to anyone. ***\n');
      }
    },
    preMake: async () => ensure7zip(),
  },
};



function windowsSign() {
  if (process.platform !== 'win32' || process.env.SKIP_SIGN) {
    return undefined;
  }

  const {
    WINDOWS_SIGNTOOL_PATH: signToolPath,
    WINDOWS_SIGN_DLIB: dlib,
    WINDOWS_SIGN_METADATA: metadata
  } = process.env;

  if (!signToolPath || !dlib || !metadata) {
    return undefined;
  }

  return {
    signToolPath,
    automaticallySelectCertificate: false,
    signWithParams: ['/dlib', dlib, '/dmdf', metadata],
    timestampServer: 'http://timestamp.acs.microsoft.com',
    hashes: ['sha256'],
  } as unknown as MakerSquirrelConfig;
}

function ensure7zip() {
  if (process.platform !== 'win32') return;
  const require = createRequire(__filename);
  const winstaller = require.resolve('electron-winstaller/package.json', {
    paths: [dirname(require.resolve('@electron-forge/maker-squirrel/package.json'))],
  });
  const vendor = join(dirname(winstaller), 'vendor');
  for (const ext of ['exe', 'dll']) {
    const target = join(vendor, `7z.${ext}`);
    if (!existsSync(target)) copyFileSync(join(vendor, `7z-${arch()}.${ext}`), target);
  }
}

export default config;
