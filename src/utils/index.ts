import { extname as _extname, basename, relative } from "path";
import { fileExtensions } from "@/assets/extensions/material-icon-theme/dist/material-icons.json";

export function extname(path: string): string {
  return _extname(path).replace(/^\./g, "");
}

export function b64toBlob(
  b64Data: string,
  contentType = "",
  sliceSize = 512
): Blob {
  const byteCharacters = atob(b64Data);
  const byteArrays = [];

  for (let offset = 0; offset < byteCharacters.length; offset += sliceSize) {
    const slice = byteCharacters.slice(offset, offset + sliceSize);

    const byteNumbers = new Array(slice.length);
    for (let i = 0; i < slice.length; i++) {
      byteNumbers[i] = slice.charCodeAt(i);
    }

    const byteArray = new Uint8Array(byteNumbers);
    byteArrays.push(byteArray);
  }

  const blob = new Blob(byteArrays, { type: contentType });
  return blob;
}

export function isPlainText(path: string): boolean {
  return (
    !extname(path) ||
    (extname(path) in fileExtensions &&
      [
        "image",
        "pdf",
        "table",
        "zip",
        "exe",
        "word",
        "lib",
        "video",
        "audio",
        "android",
        "3d",
      ].includes(fileExtensions[extname(path)]) === false)
  );
}

export function getType(path: string): string {
  return fileExtensions[extname(path)] || "bin";
}

export function getEditor(path: string): string {
  const type = getType(path);
  switch (type) {
    case "vue":
    case "svelte":
      return "html";
    case "i18n":
    case "settings":
      return "json";
  }

  return type;
}

export function isBase64(str: string): boolean {
  try {
    return btoa(atob(str)) === str;
  } catch (err) {
    return false;
  }
}

export function rawText(str: string): string {
  if (isBase64(str)) {
    return atob(str);
  }

  return str;
}

export function alwayBase64(str: string): string {
  // eslint-disable-next-line no-extra-boolean-cast
  if (!!str) {
    if (isBase64(str)) {
      return str;
    }

    return btoa(str);
  } else {
    return str;
  }
}

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary_string = atob(base64);
  const len = binary_string.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary_string.charCodeAt(i);
  }
  return bytes.buffer;
}

export function filename(path: string): string {
  return basename(path, _extname(path));
}

export function random(value: number): number {
  return Math.round(Math.random() * value);
}

export function removedPathProject(path: string): string {
  if (path.includes("projects")) {
    return relative("projects", path).replace(/^\.\.\//, "");
  }

  return path;
}
