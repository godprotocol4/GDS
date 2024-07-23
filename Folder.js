import Folder_crud from "./Folder_crud";
import { _id } from "./utils/functions";

class Folder extends Folder_crud {
  constructor(folder_name, meta) {
    super();

    meta = meta || {};
    let { ds, subfolder, remote } = meta;

    this.remote = remote;
    this.folder_name = folder_name;
    this.ds = ds;
    this.folder_path = `${this.ds.folders_path}/${folder_name}`;
    this.fs = this.ds._fs;
    this.subfolder =
      subfolder && typeof subfolder === "string"
        ? new Array(subfolder)
        : subfolder;
    this.pages = new Object();

    this.system_query = new Set([
      "write",
      "write_several",
      "read",
      "readone",
      "update",
      "update_several",
      "replace",
      "remove",
      "remove_several",
    ]);
    this.user_queries = new Set();
  }

  add_query = (query, handler) => {
    if (!this.user_queries.has(query) && Object.keys(this).includes(query))
      return console.error(`${query} already exists as predefined.`);

    if (typeof handler !== "function")
      return console.error(`add_query: handler is not a function: ${query}`);
    else if (typeof query !== "string")
      return console.error(`add_query: query is not a string`);
    else if (this.system_query.has(query))
      return console.error(
        `add_query: Cannot overwrite a system query - ${query}`
      );

    this.user_queries.add(query);
    this[query] = function (args) {
      let response = handler(args);
      this.query_listeners.forEach((listener) =>
        listener(this, response, { ...arguments, query_operation: query })
      );
      this.ds.query_listeners.forEach((listener) =>
        listener(this, response, { ...arguments, query_operation: query })
      );

      return response;
    };
  };

  remove_query = (query) => {
    if (!this.user_queries.has(query))
      return console.error(`${query} does not exist as a custom query.`);

    if (typeof query !== "string")
      return console.error(`remove_query: query is not a string`);
    else if (this.system_query.has(query))
      return console.error(
        `remove_query: Cannot remove a system query - ${query}`
      );

    this.user_queries.delete(query);
    delete this[query];
  };

  run_on_read_file = (file, meta) => {
    let file_ = file,
      history = new Array({ index: 0 });
    let listeners = Array.from(this.read_file_listeners);
    listeners.push(...Array.from(this.ds.read_file_listeners));
    for (let l = 0; l < listeners.length; l++) {
      let handler = listeners[l];
      file_ = handler(this, file_, meta, history) || file_;
      history.push({ file: file_, handler: handler, index: l });
    }

    return file_;
  };

  run_on_write_file = (data, meta) => {
    let data_ = data,
      history = new Array({ index: 0 });
    let listeners = Array.from(this.write_file_listeners);
    listeners.push(...Array.from(this.ds.write_file_listeners));
    for (let l = 0; l < listeners.length; l++) {
      let handler = listeners[l];
      data_ = handler(this, data_, meta, history) || data_;
      history.push({ data: data_, handler: handler, index: l });
    }

    return data_;
  };

  run_write_listeners = (response, meta) => {
    this.write_listeners.forEach((listener) => listener(this, response, meta));
    this.ds.write_listeners.forEach((listener) =>
      listener(this, response, meta)
    );
    this.query_listeners.forEach((listener) =>
      listener(this, response, { ...meta, query_operation: "write" })
    );
    this.ds.query_listeners.forEach((listener) =>
      listener(this, response, { ...meta, query_operation: "write" })
    );
  };

  run_read_listeners = (response, meta) => {
    this.read_listeners.forEach((listener) => listener(this, response, meta));
    this.ds.read_listeners.forEach((listener) =>
      listener(this, response, meta)
    );
    this.query_listeners.forEach((listener) =>
      listener(this, response, { ...meta, query_operation: "read" })
    );
    this.ds.query_listeners.forEach((listener) =>
      listener(this, response, { ...meta, query_operation: "read" })
    );
  };

  run_update_listeners = (response, meta) => {
    this.update_listeners.forEach((listener) => listener(this, response, meta));
    this.ds.update_listeners.forEach((listener) =>
      listener(this, response, meta)
    );
    this.query_listeners.forEach((listener) =>
      listener(this, response, { ...meta, query_operation: "update" })
    );
    this.ds.query_listeners.forEach((listener) =>
      listener(this, response, { ...meta, query_operation: "update" })
    );
  };

  run_remove_listeners = (response, meta) => {
    this.remove_listeners.forEach((listener) => listener(this, response, meta));
    this.ds.remove_listeners.forEach((listener) =>
      listener(this, response, meta)
    );
    this.query_listeners.forEach((listener) =>
      listener(this, response, { ...meta, query_operation: "remove" })
    );
    this.ds.query_listeners.forEach((listener) =>
      listener(this, response, { ...meta, query_operation: "remove" })
    );
  };

  run_replace_listeners = (response, meta) => {
    this.replace_listeners.forEach((listener) =>
      listener(this, response, meta)
    );
    this.ds.replace_listeners.forEach((listener) =>
      listener(this, response, meta)
    );
    this.query_listeners.forEach((listener) =>
      listener(this, response, { ...meta, query_operation: "replace" })
    );
    this.ds.query_listeners.forEach((listener) =>
      listener(this, response, { ...meta, query_operation: "replace" })
    );
  };

  read_config = () => {
    if (this.config) this.config.joins = new Array(...this.joins);
    if (this.config) return this.config;

    this.folder_config_path = `${this.folder_path}/.config`;
    try {
      this.config = this.fs.readFileSync(this.folder_config_path, {
        encoding: "utf8",
      });
    } catch (e) {
      return this.set_config();
    }

    if (this.config && typeof this.config === "string") {
      this.config = JSON.parse(this.config);
      if (this.joins.length) this.config.joins = new Array(...this.joins);
      else this.joins = this.config.joins;
    } else this.set_config();
  };

  persist_config = () =>
    this.fs.writeFileSync(
      this.folder_config_path,
      JSON.stringify(this.config),
      {
        encoding: "utf8",
      }
    );

  set_config = () => {
    this.folder_config_path = `${this.folder_path}/.config`;
    let config = {
      folder_name: this.folder_name,
      folder_path: this.folder_path,
      ds: this.ds.ds_name,
      created: Date.now(),
      updated: Date.now(),
      max_filesize: 1048576,
      recent_file: null,
      recent_filesize: 0,
      total_files: 0,
      total_entries: 0,
      total_size: 0,
      joins: new Array(...this.joins),
      subfolder: this.subfolder,
      structure: this.structure,
    };
    this.fs.writeFileSync(this.folder_config_path, JSON.stringify(config), {
      encoding: "utf8",
    });
    this.config = config;
  };

  create = (joins) => {
    if (joins && typeof joins === "string") joins = new Array(joins);
    this.joins = joins || new Array();

    if (this.fs.existsSync(this.folder_path)) {
      this.read_config();
      return this;
    }

    this.fs.mkdirSync(this.folder_path);
    this.set_config();

    this.ds.folder_listeners.forEach((listener) => listener(this));

    return this;
  };
}

export default Folder;
