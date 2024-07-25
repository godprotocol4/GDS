import Config from "./Config";
import Operations from "./Operations";

class Folder extends Operations {
  constructor(name, options) {
    super();

    options = options || {};

    this.name = name;
    this.ds = options.ds;

    this.fs = this.ds.fs;
    this.parent = options.parent;

    this.remotes = new Object();
    this.remote_id = options.remote_id;
    this.remote = options.remote;

    this.path = `${this.parent.path}/${this.name}`;
    this.subfolders = new Object();
  }

  check_remote = (operation) => {
    return ["read", "readone", "call"].includes(operation);
  };

  add_remote = (remote) => {
    this.remotes[remote.remote_id] = remote;
  };

  stringify = () => {
    let obj = {};
    obj.name = this.name;
    obj.subfolders = Object.keys(this.subfolders).length;
    obj.path = this.path;
    obj.parent = this.parent.path;

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

    this.config = new Config(this);

    if (!this.fs.existsSync(this.path)) {
      this.init();
    } else {
      this.config.load();
    }

    return this;
  };
}

export default Folder;
