/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// The files on the system clipboard: what a copy in Finder or Explorer (or
// of a recording in a screenshot app) leaves there. The renderer reads
// pictures itself, but the web clipboard API knows nothing of files, and
// outside a paste event this is the only way to them.

import { clipboard } from "electron";
import { fileURLToPath } from "node:url";

/** The files on the clipboard, by path, in the order they were copied. */
export function clipboardPaths(): string[] {
  switch (process.platform) {
    case "darwin": {
      // Every file of a copy is in the filenames list, a plist of paths; the
      // file URL type only holds the first.
      const plist = clipboard.read("NSFilenamesPboardType");
      const paths = [...plist.matchAll(/<string>([^<]*)<\/string>/g)].map((match) => unescapeXml(match[1]!));
      if (paths.length) return paths;
      const url = clipboard.read("public.file-url");
      return url.startsWith("file:") ? [fileURLToPath(url)] : [];
    }
    case "win32": {
      // Only the first file of a copy: the full list is in CF_HDROP, which
      // Electron cannot read.
      const path = clipboard.readBuffer("FileNameW").toString("utf16le").split("\0")[0];
      return path ? [path] : [];
    }
    default:
      return clipboard
        .read("text/uri-list")
        .split(/\r?\n/)
        .filter((line) => line.startsWith("file:"))
        .map((url) => fileURLToPath(url));
  }
}

function unescapeXml(text: string): string {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}
