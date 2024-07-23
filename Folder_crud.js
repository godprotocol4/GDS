import Queries from "./Queries";
import { copy_object } from "./utils/functions";
import { post_request } from "./utils/services";

class Folder_crud extends Queries {
  remote_query = async (payload) => {
    if (!this.remote) {
      return;
    }

    let response;
    if (payload.operation === "call") {
      response = await post_request(`${this.remote.server}/run`, {
        payload: {
          physical_address: this.remote.payload.physical_address,
          account: this.remote.payload.account,
          query: payload.query,
        },
        signature: this.remote.payload.signature,
      });
    } else if (["read", "readone"].includes(payload.operation)) {
      console.log(payload, "hiya", this.remote);
      response = await post_request(`${this.remote.server}/parse`, {
        payload: {
          query: payload,
          physical_address: this.remote.payload.physical_address,
          account: this.remote.payload.account,
          signature: this.remote.payload.signature,
        },
      });
    }

    return response;
  };

  check_remote = (operation) => {
    return true;
  };

  write = async (data, options) => {
    this.check_remote("write");

    if (!data) {
      console.warn("data null - Folder.write");
      return data;
    }
    if (!options) options = new Object();
    let $from_several = options.$from_several;
    delete options.$from_several;
    let $from_replace = options.$from_replace;
    delete options.$from_replace;

    if (Array.isArray(data)) {
      console.warn("Data is an Array; substituting .write_several for you.");
      return this.write_several(data, options);
    }
    let subfolder = new Array(),
      res;
    if (this.config.subfolder) {
      this.config.subfolder.map(
        (prop) => data[prop] && subfolder.push(data[prop])
      );

      for (let s = 0; s < subfolder.length; s++)
        res = this.write_to_ds(data, { subfolder: subfolder[s] });
    } else res = this.write_to_ds(data, options);

    !$from_several &&
      !$from_replace &&
      this.run_write_listeners(res, { options });

    return res;
  };

  read = (query, options) => {
    let res = this.remote_query({ query, options, operation: "read" });
    if (res) return res;

    let result = new Array();
    if (
      Array.isArray(query) &&
      !query
        .map((q) => typeof q === "object" && !Array.isArray(q))
        .filter((p) => !p).length
    ) {
      for (let r = 0; r < query.length; r++)
        result.push(
          ...this.read(query[r], {
            ...options,
            exclude: result.map((r) => r._id),
          })
        );
      this.run_read_listeners(result, { options, query, several: true });
      return result;
    }

    if (typeof query === "string" || Array.isArray(query))
      query = { _id: query };

    if (options && options.subfolder) {
      let subfolder = options.subfolder;
      if (!Array.isArray(subfolder)) subfolder = new Array(subfolder);

      for (let s = 0; s < subfolder.length; s++)
        result.push(
          ...this.read_from_ds(query, { ...options, subfolder: subfolder[s] })
        );
    } else result.push(...this.read_from_ds(query, options));

    this.run_read_listeners(result, { options, query, several: true });

    return result;
  };

  readone = (query, options) => {
    let res = this.remote_query({ query, options, operation: "readone" });
    if (!res) return res;

    if (!options) options = new Object();
    let result = this.read(query, { ...options, limit: 1 });
    let response;
    if (options.for_update) response = result;
    else {
      response = result[0];
      this.run_read_listeners(response, { options, query });
    }

    return response;
  };

  write_several = (data_array, options) => {
    if (!data_array) {
      console.warn("data_array null - Folder.write_several");
      return data_array;
    }

    let result = new Array();
    if (!Array.isArray(data_array)) {
      console.warn("Use Data Array instead; substituting .write for you.");
      return this.write(data_array, { ...options, $from_several: true });
    } else
      for (let d = 0; d < data_array.length; d++)
        result.push(
          this.write(data_array[d], { ...options, $from_several: true })
        );

    this.run_write_listeners(result, { several: true, options });

    return result;
  };

  update = (query, update_query, options) => {
    if (!update_query) {
      console.warn("update_query null");
      return update_query;
    }

    if (typeof query === "string") query = { _id: query };
    let response = this.update_in_ds(query, update_query, options);

    this.run_update_listeners(response, { query, update_query, options });

    return response;
  };

  update_several = (query, update_query, options) => {
    if (!update_query) {
      console.warn("update_query null");
      return update_query;
    }

    if (Array.isArray(query) || typeof query === "string")
      query = { _id: query };
    let response = this.update_in_ds(query, update_query, {
      ...options,
      several: true,
    });

    this.run_update_listeners(response, {
      query,
      update_query,
      options,
      several: true,
    });

    return response;
  };

  search = (param, object) => {
    if (typeof param !== "string") return object;

    param = param.toLowerCase().split(" ");

    return Array.isArray(object)
      ? object.filter((obj) => this.search_ds(obj, param))
      : this.search_ds(object, param);
  };

  replace = (replace_query, replacement, options) => {
    if (!replacement || !replace_query) {
      console.warn(!replacement ? "replacement null" : "replace_query null");
      return !replace_query ? replace_query : replacement;
    }

    let remove_res = this.remove_several(replace_query, copy_object(options));
    let write_res = this.write(replacement, {
      ...options,
      return_full: true,
      $from_replace: true,
    });

    let result = {
      ...write_res,
      replaced: true,
      removed: remove_res.data.map((r) => r._id),
      replacement: copy_object(write_res.insertion),
    };
    delete result.insertion;

    this.run_replace_listeners(result, { replace_query, replacement, options });

    return result;
  };

  remove = (remove_query, options, no_limit) => {
    if (!remove_query) return null;

    if (!options) options = new Object();
    let $from_replace = options.$from_replace;
    delete options.$from_replace;
    let $from_several = options.$from_several;
    delete options.$from_several;

    if (typeof remove_query === "string" || Array.isArray(remove_query))
      remove_query = { _id: remove_query };
    options.limit = no_limit ? -1 : 1;

    let result = new Array();
    if (options.subfolder) {
      if (!Array.isArray(options.subfolder))
        options.subfolder = new Array(options.subfolder);
      for (let o = 0; o < options.subfolder.length; o++) {
        let subfolder = options.subfolder[o];
        result.push(
          this.remove_from_ds(remove_query, { ...options, subfolder })
        );
      }

      !$from_replace &&
        !$from_several &&
        this.run_remove_listeners(result, { remove_query, options });
      return result;
    }

    result = this.remove_from_ds(remove_query, options, no_limit);
    !$from_replace &&
      !$from_several &&
      this.run_remove_listeners(result, { remove_query, options });

    return result;
  };

  remove_several = (remove_query, options) => {
    if (!remove_query) return null;

    let result = this.remove(
      remove_query,
      { ...options, $from_several: true },
      true
    );

    this.run_remove_listeners(result, { remove_query, options });

    return result;
  };
}

export default Folder_crud;
