import { post_request } from "../utils/services";
import Queries from "./Queries";

class Remote_operations extends Queries {
  constructor() {
    super();
  }

  remote_stuff = (remote, result) => {
    if (!Array.isArray(result)) {
      result = [result];
    }
    result.map((res) => {
      let res_hash = this.manager.oracle.hash(res);
      let locs = this.remote_locations[res_hash];

      if (!locs) {
        locs = [];
        this.remote_locations[res_hash] = locs;
      }
      if (!locs.find((rem) => rem.remote_id === remote.remote_id))
        locs.push(remote);
    });
  };

  remote_endpoint = async (endpoint, payload) => {
    if (this.remote.config.private) {
      payload.signature = this.sign(payload);
    }

    let result = await post_request(
      `${this.remote.config.server}/${endpoint}`,
      payload
    );

    if (!result || (result && (result.message || result.error))) {
      return result;
    }

    if (result.height) {
    } else {
      if (!Array.isArray(result)) {
        result = [result];
      }

      result.map((res) => this.write_block(res));
    }

    return result;
  };

  write_block = (blk) => {
    let folder = this.ds.folder(blk.chain.hash);
    return folder.write(blk);
  };

  sign = () => {};

  program_config = async () => {
    if (!this.remote) return;

    let response = await this.remote_endpoint("parse", {
      payload: {
        query: {
          query: { physical_address: this.remote.config.physical_address },
          operation: "readone",
          options: { depth: 0 },
        },
        remote: this.remote,
        physical_address: "programs",
      },
      account: this.remote.config.account,
      signature: this.sign(),
    });
    this.program = response;

    return response;
  };

  parse_to_code = (parameters, options) => {
    let program_config = this.program;

    let code = this.remote.config.short_address
      ? `@/${this.remote.config.short_address}\n`
      : "@\n";
    for (let prop in parameters) {
      code += `>${prop} ${JSON.stringify(parameters[prop])}\n`;
    }

    code += `run {'payload':{'physical_address':'${
      program_config
        ? program_config.physical_address
        : this.remote.config.physical_address
    }', 'account': '${this.remote.config.account}', 'query': '${
      options.query || ""
    }'}, 'signature': '${this.sign() || ""}'}\n;`;

    return code;
  };

  call = async (parameters, options) => {
    options = options || {};
    parameters = parameters || {};

    let code = this.parse_to_code(parameters, options);

    let mgr = this.ds.manager,
      response;

    if (!mgr) {
      if (options.assemble) {
        response = await this.remote_endpoint(`load`, {
          program: { instructions: code },
          assemble: true,
          signature: this.sign(),
          account: this.remote.config.account,
        });
      } else return { message: "Manager not provided" };
    } else {
      let account_object = mgr.get_account(this.remote.config.account);

      let sequence = account_object.assembler.run(code, {
        instructions: !options.imagine,
      });

      if (!sequence) return;

      response = await this.remote_endpoint(`load`, {
        program: { instructions: sequence, account: account_object.name },
      });
    }

    if (Array.isArray(response)) {
      let program_block = this.read_program_block(response);
      if (program_block.message) return program_block;

      let result = await this.remote_endpoint(`run`, {
        payload: {
          physical_address: program_block.chain.physical_address,
          query: `blocks:${program_block.index}`,
        },
        account: this.remote.config.account,
      });

      return result;
    } else return { message: "Response format not clear", response };
  };

  read_program_block = (blocks) => {
    let program_block;
    for (let i = blocks.length - 1; i >= 0; i--) {
      let blk = blocks[i];
      if (blk.metadata && blk.metadata.program) {
        program_block = blk;
        break;
      }
    }
    return program_block || { message: "No program set" };
  };

  handle_remote = async (operation, query, options) => {
    if (!this.remote) return;
    if (!this.check_remote(operation))
      return { error: true, error_message: "Forbidden remote operation" };

    let response = await this.remote_endpoint(`parse`, {
      payload: {
        query: { query, operation, options },
        ...this.remote.config,
        remote: this.remote,
      },
      ...this.remote.config,
    });

    return response;
  };
}

export default Remote_operations;
