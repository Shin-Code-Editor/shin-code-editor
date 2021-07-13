import git, { ReadCommitResult, FetchResult } from "isomorphic-git";
import http from "isomorphic-git/http/web/index.js";
import {
  readFile,
  writeFile,
  mkdir,
  unlink,
  stat,
  readdir,
  rmdir,
} from "./filesystem";
import { base64ToArrayBuffer, rawText } from "@/utils";
import $store from "@/store";
import { Toast } from "@capacitor/toast";
import { StatResult } from "@capacitor/filesystem";
import i18n from "@/i18n";

function Err(name: string): any {
  return class extends Error {
    public code: string = name;

    constructor(...args: any[]) {
      super(...args);
      if (this.message) {
        this.message = name + ": " + this.message;
      } else {
        this.message = name;
      }
    }
  };
}

// eslint-disable-next-line no-unused-vars
// const EEXIST = Err("EEXIST");
const ENOENT = Err("ENOENT");
// eslint-disable-next-line no-unused-vars
// const ENOTDIR = Err("ENOTDIR");
// eslint-disable-next-line no-unused-vars
// const ENOTEMPTY = Err("ENOTEMPTY");
// eslint-disable-next-line no-unused-vars
// const ETIMEDOUT = Err("ETIMEDOUT");

class Stat {
  public type: string;
  public mode = 16822;
  public size: number;
  public ino = 2814749767351612;
  public mtimeMs: number;
  public ctimeMs: number;
  public uid = 1;
  public gid = 1;
  public dev = 1761345728;

  constructor(stats: StatResult) {
    this.type = stats.type;
    this.size = stats.size;
    this.mtimeMs = stats.mtime;
    this.ctimeMs = stats.ctime || stats.mtime;
  }
  isFile(): boolean {
    return this.type === "file";
  }
  isDirectory(): boolean {
    return this.type === "directory";
  }
  isSymbolicLink(): boolean {
    return this.type === "symlink";
  }
}

const fs = {
  promises: {
    readFile(
      path: string,
      { encoding }: { encoding?: "utf8" } = {}
    ): Promise<ArrayBuffer | string> {
      return new Promise((resolve, reject) => {
        readFile(path)
          .then((base64) => {
            if (encoding === "utf8") {
              resolve(rawText(base64));
            }

            resolve(base64ToArrayBuffer(base64));
          })
          .catch(() => {
            reject(new ENOENT(path));
          });
      });
    },

    writeFile(
      path: string,
      data: ArrayBuffer | Uint8Array | Blob | string
    ): Promise<void> {
      return new Promise((resolve, reject) => {
        writeFile(path, data)
          .then((st) => {
            resolve(st);
          })
          .catch((err) => {
            console.log(err);
            reject();
          });
      });
    },
    mkdir(path: string): Promise<void> {
      return mkdir(path);
    },
    rmdir(path: string): Promise<void> {
      return rmdir(path);
    },
    unlink(path: string): Promise<void> {
      return unlink(path);
    },
    stat(path: string): Promise<Stat> {
      return new Promise((resolve, reject) => {
        stat(path)
          .then((st) => {
            resolve(new Stat(st));
          })
          .catch(() => {
            reject(new ENOENT(path));
          });
      });
    },
    lstat(path: string): Promise<Stat> {
      return this.stat(path);
    },
    readdir(path: string): Promise<string[]> {
      return readdir(path);
    },
    readlink(path: string): Promise<ArrayBuffer | string> {
      return this.readFile(path);
    },
    symlink(
      path: string,
      data: ArrayBuffer | Uint8Array | Blob | string
    ): Promise<void> {
      return writeFile(path, data);
    },
  },
};

function getProvide(url: string): string {
  const provide = new URL(url).hostname;

  if (provide in $store.state.settings.git) {
    return provide;
  }

  return "*";
}

function getAuthFromProvide(url: string): any {
  const provide = getProvide(url);

  return $store.state.settings.git[provide];
}

/// utils

function onProgress(event: any): void {
  $store.commit(
    "terminal/print",
    `${event.phase} (${
      event.total
        ? Math.round((event.loaded / event.total) * 100) + "%"
        : event.loaded
    })`
  );
}
function onAuth(url: any): any {
  const auth = getAuthFromProvide(url);

  $store.commit("terminal/warning", i18n.t("Git 403 Try login..."));

  return auth;
}
function onAuthFailure(): any {
  $store.commit("terminal/error", i18n.t("Access was denied Login failure!"));
  Toast.show({
    text: i18n.t("Login GIT failure") as string,
  });

  return {
    cancel: true,
  };
}
function onAuthSuccess() {
  $store.commit("terminal/success", i18n.t("Login success!"));
}

// export

export async function init({ dir }: { dir: string }): Promise<void> {
  await git.init({ fs, dir });
}

export async function clone({
  dir,
  url,
  ref,
}: {
  dir: string;
  url: string;
  ref?: string;
}): Promise<void> {
  $store.commit(
    "terminal/print",
    i18n.t(`Cloning repo {url}`, {
      url,
    })
  );
  await git.clone({
    fs,
    http,
    dir,
    corsProxy: "https://cors.isomorphic-git.org",
    url,
    ref,
    singleBranch: $store.state.settings.cloneGit.singleBranch,
    noCheckout: $store.state.settings.cloneGit.noCheckout,
    noTags: $store.state.settings.cloneGit.noTags,
    ...(Number.isNaN(+$store.state.settings.cloneGit.depth)
      ? {}
      : {
          depth: +$store.state.settings.cloneGit.depth,
        }),
    // eslint-disable-next-line no-extra-boolean-cast
    ...(!!$store.state.settings.cloneGit.since
      ? {
          since: $store.state.settings.cloneGit.since,
        }
      : {}),
    exclude:
      $store.state.settings.cloneGit.exclude
        ?.replace(/,\s+/g, ",")
        .split(",")
        .filter(Boolean) ?? [],

    onProgress,
    onMessage: console.log,
    onAuth,
    onAuthFailure,
    onAuthSuccess,
  });
}

export async function commit({
  dir,
  message,
}: {
  dir: string;
  message: string;
}): Promise<string> {
  const auth = await listRemotes({ dir });
  const provide = getProvide(auth?.[0].url || "");

  return await git.commit({
    fs,
    dir,
    message,
    onSign: onAuth,
    author: {
      name: $store.state.settings.git[provide]?.name,
      email: $store.state.settings.git[provide]?.email,
    },
  });
}

export async function listRemotes({ dir }: { dir: string }): Promise<
  {
    remote: string;
    url: string;
  }[]
> {
  return await git.listRemotes({
    fs,
    dir,
  });
}

export async function log({
  dir,
  ref = "HEAD",
  force = false,
}: {
  dir: string;
  ref: string;
  depth: number;
  force: boolean;
}): Promise<ReadCommitResult[]> {
  return await git.log({
    fs,
    dir,
    ref,

    ...(Number.isNaN(+$store.state.settings.cloneGit.depth)
      ? {}
      : {
          depth: +$store.state.settings.cloneGit.depth,
        }),
    // eslint-disable-next-line no-extra-boolean-cast
    ...(!!$store.state.settings.cloneGit.since
      ? {
          since: $store.state.settings.cloneGit.since,
        }
      : {}),

    force,
  });
}

export async function fetch({
  dir,
  url,
  ref,
  remoteRef,
}: {
  dir: string;
  url: string;
  ref: string;
  remoteRef: string;
  depth: number;
}): Promise<FetchResult> {
  return await git.fetch({
    fs,
    http,
    dir,
    corsProxy: "https://cors.isomorphic-git.org",
    url,
    ref,

    onProgress,
    onAuth,
    onAuthFailure,
    onAuthSuccess,

    remoteRef,

    singleBranch: $store.state.settings.cloneGit.singleBranch,
    ...(Number.isNaN(+$store.state.settings.cloneGit.depth)
      ? {}
      : {
          depth: +$store.state.settings.cloneGit.depth,
        }),
    // eslint-disable-next-line no-extra-boolean-cast
    ...(!!$store.state.settings.cloneGit.since
      ? {
          since: $store.state.settings.cloneGit.since,
        }
      : {}),
    exclude:
      $store.state.settings.cloneGit.exclude
        ?.replace(/,\s+/g, ",")
        .split(",")
        .filter(Boolean) ?? [],
  });
}

export async function status({
  dir,
  filepath,
}: {
  dir: string;
  filepath: string;
}): Promise<string> {
  return await git.status({
    fs,
    dir,
    filepath,
  });
}