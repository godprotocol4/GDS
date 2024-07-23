import GDS from "./GDS";

let gd = new GDS("savvy").sync();

gd.remote_folder({
  server: `http://localhost:1408`,
  payload: {
    account: "initiator",
    physical_address: "Accounts/initiator/adder/result",
  },
}).then(async (remote_folder) => {
  console.log(await remote_folder.read(null, { skip: 1 }));
});
