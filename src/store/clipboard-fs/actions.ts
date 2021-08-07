import { basename, dirname, join } from "path-cross";
import { copy, readdir, rename, stat } from "src/modules/filesystem";
import { pathEquals } from "src/utils";
import { ActionTree } from "vuex";

import { StateInterface } from "../index";

import { storeVm } from "./mutations";
import { ClipboardFStateInterface } from "./state";

async function resolveName(dirname: string, name: string): Promise<string> {
  const names: readonly string[] = await readdir(dirname);

  if (names.includes(name) === false) {
    return name;
  }

  // eslint-disable-next-line functional/no-let
  let index = 1,
    newName: string;

  // eslint-disable-next-line functional/no-loop-statement
  while (
    names.includes(
      (newName = `${name} copy` + (index === 1 ? "" : ` ${index}`))
    )
  ) {
    index++;
  }

  return newName;
}

const actions: ActionTree<ClipboardFStateInterface, StateInterface> = {
  /**
   * @description true if required refresh this component parent
   */
  async paste({ commit, state, getters }, uri: string): Promise<boolean> {
    commit("system/setProgress", true, {
      root: true,
    });

    // eslint-disable-next-line functional/no-let
    let refreshParent = false;

    if ((await stat(uri)).type === "directory") {
      await Promise.all(
        state.objects.map(async (item) => {
          if (getters.allowPaste(uri)) {
            const from = item.path;
            const to: string = pathEquals(uri, item.path)
              ? join(
                  dirname(uri),
                  state.action === "copy"
                    ? await resolveName(dirname(uri), basename(item.path))
                    : basename(item.path)
                )
              : join(
                  uri,
                  state.action === "copy"
                    ? await resolveName(uri, basename(item.path))
                    : basename(item.path)
                );

            if (state.action === "copy") {
              await copy(from, to);
            } else {
              await rename(from, to);
            }

            if (refreshParent === false && pathEquals(uri, item.path)) {
              refreshParent = true;
            }
          } else {
            console.warn(
              `Cannot copy parent directory to its own subdirectory "${item.path}" -> "${uri}"`
            );
          }
        })
      );
    } else {
      // eslint-disable-next-line functional/no-throw-statement
      throw new Error("Can only paste in one folder");
    }

    if (state.action === "cut") {
      state.objects.forEach((item) => {
        storeVm.get(item.vue)?.$emit("removed");
      });
    }

    commit("reset");
    commit("system/setProgress", false, {
      root: true,
    });

    return refreshParent;
  },
};

export default actions;
