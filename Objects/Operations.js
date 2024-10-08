import Remote_operations from "./Remote_operations";

class Operations extends Remote_operations {
  constructor() {
    super();
  }

  write = (data, options) => {
    if (Array.isArray(data)) return data.map((da) => this.write(da, options));

    let result = this.write_query(data, options);

    return result;
  };

  // Local Queries
  read = async (query, options) => {
    options = options || {};

    if (typeof query === "string" || Array.isArray(query)) {
      query = { _id: query };
    }

    let result = await this.handle_remote(
      options.readone ? "readone" : "read",
      query,
      options
    );
    if (!result && !this.remote) result = this.read_query(query, options);

    return result;
  };

  readone = async (query, options) => {
    let content = await this.read(query, {
      ...options,
      limit: 1,
      readone: true,
    });

    return this.remote ? content : content[0];
  };

  remove = (query, options) => {
    options = options || {};

    let result = this.remove_several(query, { ...options, limit: 1 });

    return result[0];
  };

  remove_several = (query, options) => {
    options = options || {};

    let result = this.remove_query(query, { ...options });

    return result;
  };

  update_several = (query, update_query, options) => {
    options = options || {};

    let updates = this.update_query(query, update_query, { ...options });
    return updates;
  };

  update = (query, update_query, options) => {
    options = options || {};

    let update = this.update_several(query, update_query, {
      ...options,
      limit: 1,
    });

    return update[0];
  };
}

export default Operations;
