import fs from "fs";
import Folder from "./Folder";
import GDSFile from "./GDSFile";
import { post_request } from "./utils/services";

class GDS extends GDSFile {
  constructor(ds_name, meta) {
    super();

    meta = meta || {};
    let { base_path } = meta;

    this.ds_name = ds_name;
    this._path = `${base_path || process.env.HOME}/.GDS/${ds_name}`;
    this.ds_config_path = this._path + "/.config";
    this.folders_path = `${this._path}/folders`;
    this.files_path = `${this._path}/files`;
    this.folders = new Array();
    this.remote_folders = new Array();
    this.ds_config = new Object();
    this._fs = fs;
  }

  create_config = () => {
    return {
      datastore_name: this.ds_name,
      folders: 0,
      files: 0,
      created: Date.now(),
      updated: Date.now(),
    };
  };

  sync = (meta) => {
    meta = meta || {};
    let { sync_handler, manager } = meta;
    this.manager = manager;

    let { existsSync, mkdirSync, writeFileSync, readFileSync } = this._fs;
    if (!existsSync(this.folders_path))
      mkdirSync(this.folders_path, { recursive: true });
    if (!existsSync(this.files_path)) mkdirSync(this.files_path);

    if (!existsSync(this.ds_config_path)) {
      this.config = this.create_config();
      writeFileSync(this.ds_config_path, JSON.stringify(this.config), {
        encoding: "utf8",
      });
    } else
      this.config = JSON.parse(
        readFileSync(this.ds_config_path, { encoding: "utf8" })
      );

    this.synced = true;

    if (sync_handler) {
      try {
        if (!Array.isArray(sync_handler))
          sync_handler = new Array(sync_handler);
        sync_handler.map(
          async (handler) =>
            typeof handler === "function" && (await handler(this))
        );
      } catch (e) {}
    }

    return this;
  };

  remote_folder = async (config, options) => {
    let response = await post_request(`${config.server}/parse`, {
      payload: {
        ...config.payload,
        config: true,
      },
    });

    if (!response || (response && !response.folder_name)) {
      return (
        options &&
        options.on_connect &&
        options.on_connect({
          connected: false,
          response,
          payload: { config, options },
        })
      );
    }

    let folder = new Folder(response.folder_name, {
      remote: { ...config, response },
      ds: this,
    }).create();

    this.remote_folders.push(folder);
    return folder;
  };

  folder = (folder_name, options) => {
    options = options || {};
    let { subfolder, joins, no_new } = options;

    let folder = this.folder.find((fold) => fold.name === folder_name);
    if (no_new && !folder) return;

    if (!this.synced) throw new Error("Sync GDS first!");

    folder = new Folder(folder_name, { ds: this, subfolder }).create(joins);

    this.folders.push(folder);

    return folder;
  };

  get_folder_by_id = (_id) =>
    _id.split &&
    this.folders.find(
      (folder) =>
        folder.folder_name === _id || folder.folder_name === _id.split("~")[0]
    );
}

export default GDS;
