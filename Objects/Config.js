class Config {
  constructor(object) {
    this.object = object;

    this.path = `${this.object.path}/.config`;
    this.object.config_path = this.path;

    this.stats = new Object({
      files: 0,
      total_size: 0,
      recent_file: "",
      recent_file_size: 0,
    });
  }

  persist = () => {
    this.object.fs.writeFileSync(this.path, this.stringify(true));
  };

  load = () => {
    let config = JSON.parse(this.object.fs.readFileSync(this.path));

    this.stats.files = config.files;
    this.stats.total_size = config.total_size;
    this.created = config.created || Date.now();
    this.updated = config.updated || Date.now();
    this.stats.recent_file = config.recent_file;
    this.stats.recent_file_size = config.recent_file_size;
  };

  add_entry = (prop, value) => {
    this.stats[prop] = value;
  };

  update_entry = (prop, value) => {
    let val = this.stats[prop];
    if (!val) return this.add_entry(prop, value);

    if (Array.isArray(val)) val.push(value);
    else this.stats[prop] = value;
  };

  stringify = (str) => {
    let obj = { ...this.stats };
    obj.created = this.created;
    obj.updated = this.updated;

    obj.object = this.object.stringify();

    return str ? JSON.stringify(obj) : obj;
  };
}

export default Config;
