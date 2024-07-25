import { post_request } from "../utils/services";
import Queries from "./Queries";

class Operations extends Queries {
  write = (data, options) => {
    if (Array.isArray(data)) return data.map((da) => this.write(da, options));

    let result = this.write_query(data, options);

    return result;
  };

  sign = () => {};

  program_config = async () => {
    if (!this.remote) return;

    let response = await post_request(`${this.remote.config.server}/parse`, {
      payload: {
        query: {
          query: { physical_address: this.remote.config.physical_address },
          operation: "readone",
          options: { depth: 0 },
        },
        physical_address: "programs",
        account: this.remote.config.account,
        signature: this.sign(),
      },
    });
    this.program = response;

    return response;
  };

  call = async (parameters, options) => {
    options = options || {};
    parameters = parameters || {};
    let program_config = this.program || (await this.program_config());

    let code = this.remote.config.short_address
      ? `@/${this.remote.config.short_address}\n`
      : "@\n";
    for (let prop in parameters) {
      code += `>${prop} ${JSON.stringify(parameters[prop])}\n`;
    }

    code += `run {'payload':{'physical_address':'${
      program_config.physical_address
    }', 'account': '${this.remote.config.account}', 'query': '${
      options.query || ""
    }'}, 'signature': '${this.sign() || ""}'}\n;`;

    let mgr = this.ds.manager,
      response;

    if (!mgr) {
      if (options.assemble) {
        response = await post_request(`${this.remote.config.server}/load`, {
          program: { instructions: code, account: this.remote.config.account },
          assemble: true,
          signature: this.sign(),
        });
      } else return { message: "Manager not provided" };
    } else {
      let account_object = mgr.get_account(this.remote.config.account);

      let sequence = account_object.assembler.run(code, {
        instructions: !options.imagine,
      });

      if (!sequence) return;

      response = await post_request(`${this.remote.config.server}/load`, {
        program: { instructions: sequence, account: account_object.name },
        signature: this.sign(),
      });
    }

    if (Array.isArray(response)) {
      let program_block;
      for (let i = response.length - 1; i >= 0; i--) {
        let blk = response[i];
        if (blk.metadata && blk.metadata.program) {
          program_block = blk;
          break;
        }
      }

      let result = await post_request(`${this.config.remote.server}/run`, {
        payload: {
          physical_address: program_block.chain.physical_address,
          query: `blocks:${program_block.index}`,
          account: this.remote.config.account,
        },
        signature: this.sign(),
      });

      return result;
    }
  };

  handle_remote = async (operation, query, options) => {
    if (!this.remote) return;
    if (!this.check_remote(operation))
      return { error: true, error_message: "Forbidden remote operation" };

    let response = await post_request(`${this.remote.config.server}/parse`, {
      payload: {
        query: { query, operation, options },
        ...this.remote.config,
        signature: this.sign(),
      },
    });

    return response;
  };

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
