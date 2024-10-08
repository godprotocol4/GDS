const post_request = async (path, data) => {
  try {
    let ftch = await fetch(path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: data && JSON.stringify(data),
    });

    let res;
    try {
      res = await ftch.json();
    } catch (e) {
      return { _$not_sent: true };
    }

    return res;
  } catch (e) {
    console.log(e);
    return { path, data };
  }
};

export { post_request };
