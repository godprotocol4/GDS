import fs from "fs";
import Config from "./Config";
import Folder from "./Folder";
import { post_request } from "../utils/services";
import { _id } from "../utils/functions";

class GDS {
  constructor(store_name, options) {
    options = options || {};

    this.name = store_name;
    this.folders = new Object();
    this.fs = fs;
    this.path = `${
      options.base_path || process.env.GDS_BASE || process.env.HOME + "/.GDS"
    }/${store_name}`;
    this.remote_locations = new Object();
  }

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
    this.manager = settings.manager;

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

  remote_folder = async (config, options) => {
    options = options || {};

    let remote_id = _id("remote_folder");
    config.account = config.account || "initiator";

    if (!config.physical_address)
      config.physical_address = `Accounts/${config.account}`;
    else {
      config.short_address = config.physical_address;
      config.physical_address = `Accounts/${config.account}/${config.physical_address}`;
    }

    let response = await post_request(`${config.server}/parse`, {
      payload: {
        physical_address: config.physical_address,
        config: {
          remote_id,
          manager_details: this.manager && this.manager.stringify(),
        },
      },
      signature: this.sign(),
      account: config.account,
    });

    if (!response || (response && !response.object))
      return {
        error: true,
        error_message: "Remote connection failed",
        response,
      };

    let folder = new Folder(response.object.name, {
      ...options,
      ds: this,
      parent: this,
      remote: { response, config, remote_id },
      remote_id,
    }).sync(options.sync);

    return folder;
  };
}

export default GDS;
