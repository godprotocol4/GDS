import { _id, copy_object, shuffle_array, valid_id } from "../utils/functions";

class Queries {
  sweep_data = (data) => {
    if (typeof data !== "object" || !data) return data;

    if (Array.isArray(data)) data = data.map((datum) => this.sweep_data(datum));
    else {
      for (let prop in data) {
        let value = data[prop];

        if (Array.isArray(value)) {
          for (let v = 0; v < value.length; v++) {
            let val = value[v];
            if (typeof val === "object" && val && valid_id(val._id)) {
              value[v] = this.store(val);
            }
          }
          data[prop] = value;
        } else if (typeof value === "object" && value) {
          if (valid_id(value._id)) {
          }
        }
      }
    }

    return data;
  };

  store = (data) => {
    let folder = this.ds.get_folder(data._id.split("~")[0]);

    let response;
    if (folder) {
      response = folder.write(data);
    }

    return response && response._id;
  };

  write_query = (data, options) => {
    options = options || {};
    let exists = false,
      response;

    data = copy_object(data);

    data = this.sweep_data(data);

    if (!data.created) data.created = Date.now();
    data.updated = Date.now();

    if (!valid_id(data._id)) data._id = _id(this.name);

    if (this.fs.existsSync(`${this.path}/${data._id}`)) {
      if (options.replace) response = this.write_to_file(data);
      else {
        exists = true;
        response = { filename: data._id };
      }
    } else response = this.write_to_file(data);

    response = {
      ...response,
      _id: data._id,
      exists,
      created: data.created,
      updated: data.updated,
    };

    return response;
  };

  write_to_file = (data, options) => {
    options = options || {};

    let data_str = JSON.stringify(data);

    this.fs.writeFileSync(`${this.path}/${data._id}`, data_str, {
      encoding: "utf-8",
    });

    this.directory.push(data._id);
    if (!options.update) {
      this.config.stats.files++;
      this.config.stats.total_size += data_str.length;
      this.config.stats.recent_file = data._id;
      this.config.stats.recent_file_size = data_str.length;

      this.config.persist();
    }

    return { filename: options.file || data._id };
  };

  array_comparison = (arr, comparison) => {
    let find = false;
    for (let a = 0; a < arr.length; a++) {
      if (arr[a] === comparison) {
        find = true;
        break;
      }
    }
    return find;
  };

  pass = (entry, query, or = false) => {
    let pass = new Array();

    if (query == null) return true;

    for (let q in query) {
      let qval = query[q],
        lval = entry[q];

      if (qval === undefined) continue;

      if (Array.isArray(lval) || Array.isArray(qval)) {
        let arr1, arr2;
        if (!Array.isArray(lval)) {
          arr1 = new Array(lval);
          arr2 = qval;
        } else if (!Array.isArray(qval)) {
          arr1 = new Array(qval);
          arr2 = lval;
        } else (arr1 = qval), (arr2 = lval);

        let m = false;
        for (let l = 0; l < arr1.length; l++)
          if (this.array_comparison(arr2, arr1[l])) {
            m = true;
            break;
          }

        pass.push(m);
      } else if (typeof qval === "object") {
        if (Object(qval).hasOwnProperty("$ne")) pass.push(lval !== qval["$ne"]);
        else if (Object(qval).hasOwnProperty("$e"))
          pass.push(lval === qval["$e"]);
        else if (Object(qval).hasOwnProperty("$gt"))
          pass.push(lval > qval["$gt"]);
        else if (Object(qval).hasOwnProperty("$lt"))
          pass.push(lval < qval["$lt"]);
        else if (Object(qval).hasOwnProperty("$gte"))
          pass.push(lval >= qval["$gte"]);
        else if (Object(qval).hasOwnProperty("$lte"))
          pass.push(lval <= qval["$lte"]);
        else if (Object(qval).hasOwnProperty("$includes"))
          pass.push(lval.includes && lval.includes(qval["$includes"]));
        else if (
          Object(qval).hasOwnProperty("$superquery") &&
          typeof qval["$superquery"] === "function"
        )
          pass.push(qval["$superquery"](entry, lval, q));
      } else pass.push(lval === qval);
    }

    if (or) return !!pass.find((p) => p);
    else {
      for (let p = 0; p < pass.length; p++) if (!pass[p]) return false;
      return true;
    }
  };

  directory = new Array();

  read_query = (query, options) => {
    options = options || {};

    let { excludes, skip, limit, depth, or, shuffle } = options;

    excludes = excludes || [];
    skip = skip > 0 ? skip : -1;
    depth = depth >= 0 ? depth : 1;
    limit = limit > 0 ? limit : -1;

    let matches = new Array();

    let directory = [
      ...this.fs.readdirSync(this.path).filter((dir) => dir !== ".config"),
    ];

    if (shuffle) directory = shuffle_array(directory);

    let cursor = 0;

    while (true) {
      if (!limit || cursor >= directory.length) break;

      let data = this.read_file(directory[cursor]);

      if (!data) continue;
      if (excludes.includes(data._id)) {
        cursor++;
        continue;
      }

      if (this.pass(data, query, or)) {
        if (skip <= 0) {
          matches.push(data);
          limit--;
        } else skip--;
      }
      cursor++;
    }

    if (depth) {
      matches = this.joins(matches, depth);
    }

    return matches;
  };

  joins = (data, depth) => {
    for (let d = 0; d < data.length; d++) {
      let datum = data[d];

      for (let prop in datum) {
        let value = datum[prop];
        if (!value || prop === "_id") continue;

        if (Array.isArray(value)) {
          for (let v = 0; v < value.length; v++) {
            let val = value[v];
            if (valid_id(val)) {
              value[v] = this.load(val, { depth: depth - 1 });
            }
          }
        } else if (valid_id(value)) {
          datum[d] = this.load(value, { depth: depth - 1 });
        }
      }
    }

    return data;
  };

  load = (_id, options) => {
    options = options || {};
    let { depth } = options;

    let folder = this.ds.get_folder(_id.split("~")[0]);
    let content = folder.readone(_id, { depth });

    return content;
  };

  read_file = (filename) => {
    let content = this.fs.readFileSync(`${this.path}/${filename}`);

    try {
      content = JSON.parse(content);
    } catch (e) {}

    return content;
  };

  remove_query = (query, options) => {
    let data = this.read_query(query, { ...options, depth: 0 });

    for (let d = 0; d < data.length; d++) {
      let datum = data[d];
      let datum_str = JSON.stringify(datum);

      this.fs.unlinkSync(`${this.path}/${datum._id}`);
      this.config.stats.total_size -= datum_str.length;
      this.config.stats.files--;
      if (this.config.stats.recent_file === datum._id) {
        this.config.stats.recent_file = "";
        this.config.stats.recent_file_size = 0;
      }
    }

    return data;
  };

  update_snips = (entry, update_query) => {
    for (let prop in update_query) {
      let update_value = update_query[prop];
      if (typeof update_value === "object") {
        if (Object(update_value).hasOwnProperty("$inc")) {
          if (
            typeof entry[prop] === "number" &&
            typeof update_value["$inc"] === "number"
          )
            entry[prop] += update_value["$inc"];
          else if (
            typeof entry[prop] !== "number" &&
            typeof update_value["$inc"] === "number"
          )
            entry[prop] = update_value["$inc"];
        } else if (Object(update_value).hasOwnProperty("$dec")) {
          if (
            typeof entry[prop] === "number" &&
            typeof update_value["$dec"] === "number"
          )
            entry[prop] -= update_value["$dec"];
          else if (
            typeof entry[prop] !== "number" &&
            typeof update_value["$dec"] === "number"
          )
            entry[prop] = update_value["$dec"] * -1;
        } else if (Object(update_value).hasOwnProperty("$set")) {
          let value = update_value["$set"];
          if (!Array.isArray(value)) value = new Array(value);
          if (Array.isArray(entry[prop]))
            value.map(
              (val) => !entry[prop].includes(val) && entry[prop].push(val)
            );
          else if (value.includes(entry[prop]))
            entry[prop] = new Array(...value);
          else entry[prop] = new Array(entry[prop], ...value);
        } else if (
          Object(update_value).hasOwnProperty("$unshift") ||
          Object(update_value).hasOwnProperty("$push")
        ) {
          let value = update_value["$push"] || update_value["$unshift"];
          if (!Array.isArray(value)) value = new Array(value);
          if (Array.isArray(entry[prop]))
            entry[prop][
              Object(update_value).hasOwnProperty("$push") ? "push" : "unshift"
            ](...value);
          else {
            let init_line_prop = entry[prop];
            entry[prop] = new Array(...value);
            if (!init_line_prop) entry[prop].unshift(init_line_prop);
          }
        } else if (Object(update_value).hasOwnProperty("$splice")) {
          let value = update_value["$splice"],
            line_value = entry[prop];
          if (!Array.isArray(value)) value = new Array(value);
          if (Array.isArray(line_value)) {
            entry[prop] = line_value.filter((val) => !value.includes(val));
          } else if (!Array.isArray(line_value) && line_value === value)
            delete entry[prop];
        } else if (
          Object(update_value).hasOwnProperty("$superquery") &&
          typeof update_value["$superquery"] === "function"
        ) {
          entry[prop] = update_value["$superquery"](entry, entry[prop], prop);
        } else entry[prop] = update_value;
      } else entry[prop] = update_value;
    }
  };

  update_query = (query, update_query, options) => {
    let data = this.read_query(query, { ...options, depth: 0 });

    data.map((entry) => this.update_snips(entry, update_query));

    data.map((entry) => this.write_to_file(entry, { update: true }));

    return data;
  };
}

export default Queries;
