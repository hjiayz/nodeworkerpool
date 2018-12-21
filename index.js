const worker = require('worker_threads');
const numCPUs = require('os').cpus().length;
class Pool {
  constructor(worker_number) {
    worker_number = worker_number || numCPUs;
    this.workers = [];
    this.reg_events = {};
    this.task_events = {};
    this.taskid = 0;
    this.current = 0;
    for (let i = 0; i < worker_number; i++) {
      let new_worker = new worker.Worker('./worker.js');
      new_worker.on('message', msg => {
        this.reg_events;
        if (msg[0] === 1) {
          this.reg_events[msg[1]]();
          return;
        }
        if (msg[0] === 2) {
          this.task_events[msg[1]](msg[2]);
        }
        if (msg[0] === 3) {
          this.task_events[msg[1]](msg[2], true);
        }
      });
      this.workers.push(new_worker);
    }
  }
  async define(name, func) {
    if (typeof name === 'object') {
      return await this.define_list(name);
    }
    return await new Promise((resolve, reject) => {
      let count = this.workers.length;
      for (let worker of this.workers) {
        worker.postMessage([1, name, func.toString()]);
      }
      this.reg_events[name] = _ => {
        count--;
        if (count === 0) {
          this.reg_events[name] = null;
          resolve(name);
          return;
        }
      };
    });
  }
  async define_list(list) {
    let promises = [];
    for (let name in list) {
      promises.push(this.define(name, list[name]));
    }
    return await Promise.all(promises);
  }
  async exec(func_name, func_params, kind) {
    return await new Promise((resolve, reject) => {
      while (!!this.task_events[this.taskid]) {
        this.taskid++;
        if (this.taskid >= Number.MAX_SAFE_INTEGER - 1) {
          this.taskid = 0;
        }
      }
      let id = this.taskid;
      let worker_id = this.current;
      this.current++;
      if (this.current >= this.workers.length) {
        this.current = 0;
      }
      let current_worker = this.workers[worker_id];
      current_worker.postMessage(
        [kind || 2, id, func_name, func_params],
        func_params
          .flat()
          .map(item => {
            if (item instanceof ArrayBuffer) return item;
            if (item.buffer instanceof ArrayBuffer) return item.buffer;
            if (item instanceof worker.MessagePort) return item;
            return null;
          })
          .filter(item => null !== item),
      );
      this.task_events[id] = (result, is_err) => {
        this.task_events[id] = null;
        if (is_err) {
          reject(result);
        } else {
          resolve(result);
        }
      };
    });
  }
  async map(func_name, value_list, block_size) {
    let promises = [];
    let worker_number = this.workers.length;
    block_size = block_size || Math.ceil(value_list.length / worker_number);
    while (value_list.length !== 0) {
      promises.push(this.exec(func_name, value_list.splice(0, block_size), 3));
    }
    return (await Promise.all(promises)).flat(1);
  }
  async reduce(func_name, value_list, block_size) {
    return await new Promise((resolve, reject) => {
      let worker_number = this.workers.length;
      block_size = block_size || Math.ceil(value_list.length / worker_number);
      let count = 0;
      let cache = value_list;
      let spwan = () => {
        if (value_list.length > block_size) {
          count++;
          this.exec(func_name, cache.splice(0, block_size), 4)
            .then(res => {
              count--;
              cache.push(res);
              spwan();
            })
            .catch(reject);
          spwan();
        } else {
          if (count === 0) {
            this.exec(func_name, cache.splice(0, block_size), 4)
              .then(resolve)
              .catch(reject);
          }
        }
      };
      spwan();
    });
  }
  free() {
    for (let item of this.workers) {
      item.terminate();
    }
  }
}

module.exports = Pool;
