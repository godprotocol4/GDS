class Event_listeners {
  read_listeners = new Set();
  write_listeners = new Set();
  update_listeners = new Set();
  remove_listeners = new Set();
  replace_listeners = new Set();
  query_listeners = new Set();
  folder_listeners = new Set();
  event_listeners = new Object();
  listener_add_listeners = new Set();
  listener_removed_listeners = new Set();
  read_file_listeners = new Set();
  write_file_listeners = new Set();

  get_listeners_package = () =>
    new Object({
      read_listeners: this.read_listeners,
      write_listeners: this.write_listeners,
      update_listeners: this.update_listeners,
      remove_listeners: this.remove_listeners,
      replace_listeners: this.replace_listeners,
      query_listeners: this.query_listeners,
      folder_listeners: this.folder_listeners,
      listener_add_listeners: this.listener_add_listeners,
      listener_removed_listeners: this.listener_removed_listeners,
      read_file_listeners: this.read_file_listeners,
      write_file_listeners: this.write_file_listeners,
    });

  on_user_query_listener = (query, listener, remove) => {
    if (!this.user_queries.has(query) && remove)
      return console.error(`${query} does not exist as a user query.`);
    else if (!this.user_queries.has(query) && Object.keys(this).includes(query))
      return console.error(`${query} already exists as predefined.`);
    if (remove) this[`${query}_listeners`].delete(listener);

    if (typeof listener === "function")
      this[`${query}_listeners`].add(listener);
    else
      console.error(
        `on_custom_query_listener: ${query} : Listener is not a function`
      );
  };

  on_read_file = (listener, remove) => {
    if (remove) return this.read_file_listeners.delete(listener);

    if (typeof listener === "function") this.read_file_listeners.add(listener);
    else console.error("on_read_file: Listener is not a function");
  };

  on_write_file = (listener, remove) => {
    if (remove) return this.write_file_listeners.delete(listener);

    if (typeof listener === "function") this.write_file_listeners.add(listener);
    else console.error("on_write_file: Listener is not a function");
  };

  on_listener_added = (listener, remove) => {
    if (remove) return this.listener_add_listeners.delete(listener);

    if (typeof listener === "function")
      this.listener_add_listeners.add(listener);
    else console.error("on_listener_added: Listener is not a function");
  };

  on_listener_removed = (listener, remove) => {
    if (remove) return this.listener_removed_listeners.delete(listener);

    if (typeof listener === "function")
      this.listener_removed_listeners.add(listener);
    else console.error("on_listener_removed: Listener is not a function");
  };

  add_folder_listener = (listener) => {
    if (typeof listener === "function") this.folder_listeners.add(listener);
    else console.error("add_folder_listener: Listener is not a function");
  };

  add_query_listener = (listener) => {
    if (typeof listener === "function") this.query_listeners.add(listener);
    else console.error("add_query_listener: Listener is not a function");
  };

  add_read_listener = (listener) => {
    if (typeof listener === "function") this.read_listeners.add(listener);
    else console.error("add_read_listener: Listener is not a function");
  };

  add_write_listener = (listener) => {
    if (typeof listener === "function") this.write_listeners.add(listener);
    else console.error("add_write_listener: Listener is not a function");
  };

  add_update_listener = (listener) => {
    if (typeof listener === "function") this.update_listeners.add(listener);
    else console.error("add_update_listener: Listener is not a function");
  };

  add_remove_listener = (listener) => {
    if (typeof listener === "function") this.remove_listeners.add(listener);
    else console.error("add_remove_listener: Listener is not a function");
  };

  add_replace_listener = (listener) => {
    if (typeof listener === "function") this.folder_listeners.add(listener);
    else console.error("add_folder_listener: Listener is not a function");
  };

  remove_read_listener = (listener) => {
    return listener === true
      ? this.read_listeners.clear()
      : this.read_listeners.delete(listener);
  };

  remove_write_listener = (listener) => {
    return listener === true
      ? this.write_listeners.clear()
      : this.write_listeners.delete(listener);
  };

  remove_update_listener = (listener) => {
    return listener === true
      ? this.update_listeners.clear()
      : this.update_listeners.delete(listener);
  };

  remove_remove_listener = (listener) => {
    return listener === true
      ? this.remove_listeners.clear()
      : this.remove_listeners.delete(listener);
  };

  remove_replace_listener = (listener) => {
    return listener === true
      ? this.replace_listeners.clear()
      : this.replace_listeners.delete(listener);
  };

  remove_folder_listener = (listener) => {
    return listener === true
      ? this.folder_listeners.clear()
      : this.folder_listeners.delete(listener);
  };

  remove_query_listener = (listener) => {
    return listener === true
      ? this.query_listeners.clear()
      : this.query_listeners.delete(listener);
  };

  add_listener = (event, listener) => {
    let listeners = this.event_listeners[event];
    if (listeners) listeners.add(listener);
    else listeners = new Set([listener]);

    this.event_listeners[event] = listeners;
  };

  emit = (event, payload, callback) => {
    let listeners = this.event_listeners[event];
    if (!listeners) return;

    let returns = new Array();
    listeners.forEach((listener) => returns.push(listener(payload, this)));

    typeof callback === "function" && callback(returns);
  };

  remove_listener = (event, listener) => {
    let listeners = this.event_listeners[event];
    if (!listeners) return;

    let res = listeners.delete(listener);
    this.event_listeners[event] = listeners;

    return res;
  };

  remove_event = (event) => {
    delete this.event_listeners[event];
  };
}

export default Event_listeners;
