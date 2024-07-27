import GDS from "./Objects/GDS";

let gds = new GDS("gds");
gds
  .remote_folder({
    server: `http://localhost:1409`,
    physical_address: "datastore/main",
    account: "initiator",
  })
  .then(async (datastore_main) => {
    let res = await datastore_main.call({ storage: 12 }, { assemble: true });
    console.log(res);
    // datastore_main.program_config();
  });

export default GDS;
