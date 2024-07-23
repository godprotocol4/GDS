import Event_listeners from "./Event_handlers";
import {
  copy_object,
  get_timestamp_from_id,
  shuffle_array,
  valid_id,
  _id,
} from "./utils/functions";

class Queries extends Event_listeners {
  write_to_ds = (data_, options) => {
    let filename,
      subfolder,
      no_joins,
      return_full,
      new_,
      exists,
      replace,
      data = copy_object(data_);

    if (options && typeof options === "object") {
      subfolder = options.subfolder;
      no_joins = options.no_joins;
      return_full = options.return_full;
    }

    let filepath = `${this.folder_path}/${subfolder || ""}`;

    if (data._id) {
      if (!valid_id(data._id) || data._id.split("~")[0] !== this.folder_name)
        data._id = _id(this.folder_name);
    } else if (!data._id) data._id = _id(this.folder_name);
    else exists = !!this.readone(data._id);

    if (!data.created) data.created = Date.now();
    if (!data.updated) data.updated = Date.now();

    let data_bfr_sweep = JSON.stringify(data);

    if (!exists || replace) {
      if (this.config.subfolder) {
        if (
          !this.config.recent_file ||
          this.config.recent_filesize >= this.config.max_filesize
        ) {
          filename = get_timestamp_from_id(data._id);

          this.config.recent_file = filename;
          this.config.recent_filesize = 0;
          new_ = true;
        } else filename = this.config.recent_file;
      } else {
        filename = data._id;

        this.config.recent_file = data._id;
        new_ = true;
      }

      if (!no_joins) data = this.sweep_data(data);
      this.write_file(filename, data, { new_, subfolder });
    }

    let result = {
      _id: data._id,
      filename,
      exists,
      replace,
      filepath: filepath + filename,
      created: data.created,
      updated: data.updated,
    };
    if (return_full)
      result.insertion =
        data_bfr_sweep === JSON.stringify(data)
          ? data
          : this.readone(data._id, { subfolder: options && options.subfolder });

    return result;
  };

  readfile = (file_to_read) => {
    let file;
    try {
      file = this.fs.readFileSync(file_to_read, { encoding: "utf8" }) || null;
      file = this.run_on_read_file(file, { filepath: file_to_read });

      if (file) {
        file = file.split("\n").filter((r) => r);

        for (let line = 0; line < file.length; line++) {
          try {
            file[line] = JSON.parse(file[line]);
          } catch (e) {
            throw new Error(`JSON Parse Error in readfile ::: ${file_to_read}`);
          }
        }
      } else file = new Array();
    } catch (e) {
      file = new Array();
    }

    return file;
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

  pass = (line, query, or = false) => {
    let pass = new Array();

    if (query === undefined) return true;

    for (let q in query) {
      let qval = query[q],
        lval = line[q];

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
          pass.push(qval["$superquery"](line, lval, q));
      } else pass.push(lval === qval);
    }

    if (or) return !!pass.find((p) => p);
    else {
      for (let p = 0; p < pass.length; p++) if (!pass[p]) return false;
      return true;
    }
  };

  search_file = (query, file, or) => {
    let match = new Array();
    for (let line_number = 0; line_number < file.length; line_number++) {
      let line = file[line_number];
      if (this.pass(line, query, or)) match.push(line);
    }

    return match;
  };

  iterative_read = (lines) => {
    let folders_et_ids = new Object(),
      lines_ids = new Array();
    lines.map((line) => {
      for (let prop in line) {
        if (prop === "_id") {
          lines_ids.push(line[prop]);
          continue;
        }
        if (
          !this.config.joins ||
          (this.config.joins && !this.config.joins.includes(prop))
        )
          continue;

        let value = line[prop];
        if (typeof value === "string" && valid_id(value)) {
          let folder = value.split("~")[0];
          let ids = folders_et_ids[folder];
          if (ids) ids.push(value);
          else folders_et_ids[folder] = new Array(value);
        }
      }
    });

    let folders_count = 0;
    for (let folder in folders_et_ids) {
      let folders_ids = folders_et_ids[folder];
      folders_et_ids[folder] = this.ds
        .get_folder_by_id(folder)
        .read(folders_ids, {
          limit: folders_ids.length,
          subfolder: lines_ids,
        });
      folders_count++;
    }

    if (folders_count)
      lines = lines.map((line) => {
        for (let prop in line) {
          if (prop === "_id") continue;
          let value = line[prop];
          if (typeof value === "string" && valid_id(value)) {
            if (folders_et_ids[value.split("~")[0]])
              line[prop] =
                folders_et_ids[value.split("~")[0]].find(
                  (file) => file && file._id === value
                ) || value;
          }
        }
        return line;
      });

    return lines;
  };

  search_ds = (object, param) => {
    for (const prop in object) {
      let value = object[prop];
      if (typeof value === "string") {
        value = value.toLowerCase().split(" ");
        for (let p = 0; p < param.length; p++)
          for (let v = 0; v < value.length; v++)
            if (value[v].includes(param[p])) return object;
      }
    }
  };

  read_from_ds = (query, options) => {
    if (!options) options = new Object();
    let {
      limit,
      search_param,
      or,
      paging,
      exclude,
      reverse,
      skip,
      for_update,
      reset_pager,
      shuffle,
    } = options;

    let result = new Array(),
      update = new Array();

    if (exclude && typeof exclude === "string") exclude = new Array(exclude);
    else if (!Array.isArray(exclude)) exclude = null;
    if (paging) {
      if (this.pages[paging] && this.pages[paging].done && !reset_pager)
        return this.search(search_param, result);
      else if (reset_pager && paging) delete this.pages[paging];
      else if (this.pages[paging])
        exclude = new Array(
          ...this.pages[paging].results,
          ...(exclude || new Array())
        );
    }

    limit = limit || -1;

    if (!this.config.subfolder && query && query._id) {
      if (!Array.isArray(query._id)) query._id = new Array(query._id);
      if (exclude)
        query._id = query._id.filter((_id) => !exclude.includes(_id));

      for (let i = 0; i < query._id.length; i++) {
        let __id = query._id[i];
        let file_to_read = `${this.folder_path}/${__id}`;
        let file = this.readfile(file_to_read);
        if (for_update) {
          update.push({ file_path: file_to_read, file, matches: file });
          if (for_update === 1) break;
          continue;
        }
        result.push(...file);
      }
    } else {
      if (!options.subfolder && query && this.config.subfolder) {
        options.subfolder = new Array();
        this.config.subfolder.map(
          (subf) => query[subf] && options.subfolder.push(query[subf])
        );
      }
      let subfolders =
        options && options.subfolder
          ? Array.isArray(options.subfolder)
            ? options.subfolder
            : new Array(options.subfolder)
          : this.read_subfolders();

      if (Number(skip) && skip > 0 && !this.config.subfolder)
        subfolders = subfolders.slice(skip);

      for (let s = 0; s < subfolders.length; s++) {
        let subfolder = subfolders[s];
        let files = !this.config.subfolder
          ? new Array(subfolder)
          : this.read_subfolders(subfolder);

        if (reverse) files = files.sort((f1, f2) => f2 - f1);

        if (!this.config.subfolder && exclude && exclude.includes(subfolder))
          continue;

        let should_break = false;
        if (paging && this.pages[paging])
          files = files.slice(
            files.findIndex(
              (file) =>
                file === this.pages[paging].file_path.split("/").reverse()[0]
            )
          );

        for (let f = 0; f < files.length; f++) {
          if (limit === 0) break;

          let file_path = `${this.folder_path}/${subfolder}${
            this.config.subfolder ? `/${files[f]}` : ""
          }`;
          let file = this.readfile(file_path);

          if (exclude && this.config.subfolder)
            file = file.filter((line) => !exclude.includes(line._id));

          if (reverse) file = file.sort((f1, f2) => f2.created - f1.created);
          let matches = this.search_file(query, file, !!or);
          if (matches.length && for_update) {
            update.push({ file_path, file, matches });
            if (for_update === 1) break;
            continue;
          }
          result.push(...matches);
          result = result.sort((r1, r2) => r2.created - r1.created);

          if (Number(skip) > 0 && this.config.subfolder) {
            let result_len = result.length;
            result = result.slice(skip);
            skip -= result_len;
          }
          if (
            (limit !== -1 && result.length >= limit) ||
            (paging && !this.pages[paging])
          ) {
            if (result.length > limit) result = result.slice(0, limit);
            should_break = true;
            paging &&
              this.handle_paging(
                paging,
                result.map((line) => line._id),
                file_path
              );
            break;
          }
        }
        if (should_break) break;
      }
      if (
        (result.length < limit && this.pages[paging]) ||
        (!result.length && paging && this.pages[paging])
      )
        this.pages[paging].done = true;
    }

    return this.search(
      search_param,
      for_update ? update : this.shuffle(this.iterative_read(result), shuffle)
    );
  };

  shuffle = (array, should_shuffle) => {
    should_shuffle && shuffle_array(array);
    return array;
  };

  handle_paging = (pager, results, file_path) => {
    let page = this.pages[pager];
    if (page) {
      page.results.push(...results);
      page.file_path = file_path;
    } else page = { results, file_path };

    this.pages[pager] = page;
  };

  read_subfolders = (subfolder) => {
    let files;
    try {
      files = this.fs
        .readdirSync(`${this.folder_path}${subfolder ? `/${subfolder}` : ""}`)
        .filter((file) => file !== ".config");
    } catch (e) {}
    return files || new Array();
  };

  write_file = (filename, data, options) => {
    if (!options) options = new Object();
    let { new_, subfolder } = options;

    let filepath = `${this.folder_path}/${
      this.config.subfolder ? `${subfolder}/` + filename : filename
    }`;
    data = JSON.stringify(data);

    let previous_size = 0;

    if (this.config.subfolder) {
      try {
        let bulk = this.fs.readFileSync(filepath, { encoding: "utf8" }) || "";
        bulk = this.run_on_read_file(bulk, {
          passive: true,
          filepath,
          options,
        });
        if (bulk) previous_size = bulk.length;
        data = `${bulk}${bulk ? "\n" : ""}${data}`;
      } catch (e) {
        try {
          this.fs.mkdirSync(filepath.split("/").slice(0, -1).join("/"));
        } catch (e) {}
      }
    }
    if (!filepath || (filepath && !filepath.split)) return;
    if (filepath.split("/").length <= 1) return;

    this.fs.writeFileSync(
      filepath,
      this.run_on_write_file(data, { filepath, options }),
      {
        encoding: "utf8",
      }
    );

    if (new_) this.config.total_files += 1;

    this.config.total_size += data.length - previous_size;
    this.config.total_entries += data
      .slice(previous_size ? previous_size + 1 : 0)
      .split("\n").length;

    this.config.updated = Date.now();
    this.persist_config();
  };

  update_file = (filepath, file, options) => {
    let data = "";
    file.forEach((line) => (data += `${JSON.stringify(line)}\n`));

    filepath &&
      filepath.split("/").length > 1 &&
      this.fs.writeFileSync(
        filepath,
        this.run_on_write_file(data.trim(), { options, filepath }),
        { encoding: "utf8" }
      );
  };

  remove_file = (filename, options) => {
    if (!options) options = {};
    let { subfolder, initial_size, initial_length } = options;

    this.fs.unlinkSync(
      `${this.folder_path}${subfolder ? `/${subfolder}` : ""}/${filename}`
    );

    this.config.total_size -= initial_size || 0;
    this.config.total_files -= 1;
    this.config.total_entries -= initial_length || 0;
    this.config.updated = Date.now();
    this.persist_config();
  };

  sweep_data = (data_object) => {
    if (typeof data_object !== "object") return data_object;

    if (
      typeof data_object === "object" &&
      data_object &&
      !Array.isArray(data_object)
    )
      for (let prop in data_object) {
        let val = data_object[prop];
        if (Array.isArray(val)) {
          data_object[prop] = val.map((v) => this.sweep_data(v));
        } else if (typeof val === "object" && val) {
          if (val._id) {
            let folder = this.ds.get_folder_by_id(val._id);
            if (folder) {
              let options_ = new Object(),
                subfolder = new Array();
              if (folder.config.subfolder) {
                folder.config.subfolder.map((sfolder) => {
                  let v = val[sfolder];
                  if (typeof v === "string") subfolder.push(v);
                  else if (typeof v === "object" && valid_id(v._id))
                    subfolder.push(v._id);
                });
                subfolder = subfolder.filter((s) => s);
                !subfolder.length &&
                  (subfolder.push(data_object._id),
                  (val[folder.config.subfolder[0]] = data_object._id));

                options_.subfolder = subfolder;
              }
              folder.write(val, options_);
              data_object[prop] = val._id;
            }
          }
        }
      }
    return data_object;
  };

  update_in_ds = (query, update_query, options) => {
    let { several, subfolder } = options || new Object(),
      updated = new Array();
    let result = this[several ? "read" : "readone"](query, {
      subfolder,
      for_update: several ? true : 1,
    });
    if (result && result.length) {
      for (let r = 0; r < result.length; r++) {
        let { file, file_path, matches } = result[r];

        for (let f = 0; f < file.length; f++) {
          let line = file[f];
          let limiter = 0;
          if (matches.find((match) => match._id === line._id)) {
            if (limiter && !several) break;
            this.update_snips(line, update_query), updated.push(line);

            line.updated = Date.now();
            limiter++;
          }

          file[f] = line;
        }
        this.update_file(file_path, file);
      }
    }

    return several ? updated : updated[0];
  };

  update_snips = (line, update_query) => {
    for (let prop in update_query) {
      let update_value = update_query[prop];
      if (typeof update_value === "object") {
        if (Object(update_value).hasOwnProperty("$inc")) {
          if (
            typeof line[prop] === "number" &&
            typeof update_value["$inc"] === "number"
          )
            line[prop] += update_value["$inc"];
          else if (
            typeof line[prop] !== "number" &&
            typeof update_value["$inc"] === "number"
          )
            line[prop] = update_value["$inc"];
        } else if (Object(update_value).hasOwnProperty("$dec")) {
          if (
            typeof line[prop] === "number" &&
            typeof update_value["$dec"] === "number"
          )
            line[prop] -= update_value["$dec"];
          else if (
            typeof line[prop] !== "number" &&
            typeof update_value["$dec"] === "number"
          )
            line[prop] = update_value["$dec"] * -1;
        } else if (Object(update_value).hasOwnProperty("$set")) {
          let value = update_value["$set"];
          if (!Array.isArray(value)) value = new Array(value);
          if (Array.isArray(line[prop]))
            value.map(
              (val) => !line[prop].includes(val) && line[prop].push(val)
            );
          else if (value.includes(line[prop])) line[prop] = new Array(...value);
          else line[prop] = new Array(line[prop], ...value);
        } else if (
          Object(update_value).hasOwnProperty("$unshift") ||
          Object(update_value).hasOwnProperty("$push")
        ) {
          let value = update_value["$push"] || update_value["$unshift"];
          if (!Array.isArray(value)) value = new Array(value);
          if (Array.isArray(line[prop]))
            line[prop][
              Object(update_value).hasOwnProperty("$push") ? "push" : "unshift"
            ](...value);
          else {
            let init_line_prop = line[prop];
            line[prop] = new Array(...value);
            if (!init_line_prop) line[prop].unshift(init_line_prop);
          }
        } else if (Object(update_value).hasOwnProperty("$splice")) {
          let value = update_value["$splice"],
            line_value = line[prop];
          if (!Array.isArray(value)) value = new Array(value);
          if (Array.isArray(line_value)) {
            line[prop] = line_value.filter((val) => !value.includes(val));
          } else if (!Array.isArray(line_value) && line_value === value)
            delete line[prop];
        } else if (
          Object(update_value).hasOwnProperty("$superquery") &&
          typeof update_value["$superquery"] === "function"
        ) {
          line[prop] = update_value["$superquery"](line, line[prop], prop);
        } else line[prop] = update_value;
      } else line[prop] = update_value;
    }
  };

  remove_from_ds = (query, options, several) => {
    let total_remove = 0,
      removed = new Array();
    let { limit, exclude, or } = options || new Object();

    if (exclude && typeof exclude === "string") exclude = new Array(exclude);

    if (!this.config.subfolder && query && query._id) {
      if (!Array.isArray(query._id)) query._id = new Array(query._id);
      let filepath, file;
      for (let q = 0; q < query._id.length; q++) {
        let _id = query._id[q];
        filepath = `${this.folder_path}/${_id}`;
        file = this.readfile(filepath);
        this.remove_file(_id, {
          initial_length: 1,
          initial_size: JSON.stringify(file).length,
        });
        removed.push(file);
      }
    } else {
      let subfolders =
        options && options.subfolder
          ? new Array(options.subfolder)
          : this.read_subfolders();

      for (let s = 0; s < subfolders.length; s++) {
        let subfolder = subfolders[s];
        let files = !this.config.subfolder
          ? new Array(subfolder)
          : this.read_subfolders(subfolder);

        if (!this.config.subfolder && exclude && exclude.includes(subfolder))
          continue;

        let should_break = false;
        for (let f = 0; f < files.length; f++) {
          if (limit === 0) break;
          let filepath = `${this.folder_path}/${subfolder}${
            this.config.subfolder ? `/${files[f]}` : ""
          }`;
          let file = this.readfile(filepath);

          if (exclude && this.config.subfolder)
            file = file.filter((line) => !exclude.includes(line._id));

          let match = this.search_file(query, file, or);
          if (!match.length) continue;

          let file_length = file.length;
          let filesize = JSON.stringify(file).length;

          if (!this.config.subfolder) {
            removed.push(file[0]);
            this.remove_file(subfolder, {
              initial_length: 1,
              initial_size: filesize,
            });
            file = new Array();
          } else {
            file = file
              .map((line) => {
                if (match.find((m) => m._id === line._id)) removed.push(line);
                else return line;
              })
              .filter((f) => f);

            file.length
              ? this.update_file(filepath, file)
              : this.remove_file(files[f], {
                  subfolder,
                  initial_length: file_length,
                  initial_size: filesize,
                });

            total_remove += file_length - file.length;
            if (limit !== -1 && total_remove >= limit) {
              removed = match;
              should_break = true;
              break;
            }
          }
        }
        if (should_break) break;
      }
    }
    return several ? removed : removed[0];
  };
}

export default Queries;
