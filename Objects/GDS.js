import fs from "fs";
import Config from "./Config";
import Folder from "./Folder";

class GDS {
  constructor(store_name, options) {
    options = options || {};

    this.name = store_name;
    this.folders = new Object();
    this.fs = fs;
    this.path = `${
      options.base_path || process.env.GDS_BASE || process.env.HOME + "/.GDS"
    }/${store_name}`;
  }

  load_folder = (name) => {};

  get_folder = (folder_name) => {
    let folder = this.folders[`${this.path}/${folder_name}`];

    if (!folder) folder = this.folder(folder_name);

    return folder;
  };

  stringify = () => {
    let obj = {};
    obj.name = this.name;
    obj.folders = Object.keys(this.folders).length;
    obj.path = this.path;

    return obj;
  };

  init = () => {
    this.fs.mkdirSync(this.path);

    this.config.created = Date.now();
    this.config.updated = Date.now();
    this.fs.writeFileSync(this.config_path, this.config.stringify(true));
  };

  sync = (settings) => {
    settings = settings || {};
    this.managers = settings.managers;

    this.config = new Config(this);

    if (!this.fs.existsSync(this.path)) {
      this.init();
    } else {
      this.config.load();
    }

    return this;
  };

  folder = (name, options) => {
    options = options || {};

    let folder = new Folder(name, { ...options, ds: this, parent: this });

    folder = folder.sync(options.sync);
    this.folders[folder.path] = folder;

    return folder;
  };
}

export default GDS;
