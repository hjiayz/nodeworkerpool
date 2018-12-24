const worker = require('worker_threads');
let func_list = {};
let is_tran = item => {
  if (item instanceof ArrayBuffer) return item;
  if (item.buffer instanceof ArrayBuffer) return item.buffer;
  if (item instanceof worker.MessagePort) return item;
  return null;
};
let result_trans = result =>
  (Array.isArray(result) ? result : [result])
    .flat()
    .map(is_tran)
    .filter(item => null !== item);
worker.parentPort.on('message', message => {
  if (message[0] === 1) {
    func_list[message[1]] = eval(message[2]);
    worker.parentPort.postMessage([1, message[1]]);
    return;
  }
  if (message[0] === 2) {
    try {
      let result = func_list[message[2]].apply(null, message[3]);
      worker.parentPort.postMessage(
        [2, message[1], result],
        result_trans(result),
      );
    } catch (e) {
      worker.parentPort.postMessage([3, message[1], e.toString()]);
    }
    return;
  }
  if (message[0] === 3) {
    try {
      let result;
      if (message[3][0].buffer instanceof SharedArrayBuffer) {
        for (let i in message[3][0]) {
          message[3][1][i] = func_list[message[2]](message[3][0][i]);
        }
        result = message[3][1];
      } else {
        result = message[3][0].map(func_list[message[2]]);
      }
      worker.parentPort.postMessage(
        [2, message[1], result],
        result_trans(result),
      );
    } catch (e) {
      worker.parentPort.postMessage([3, message[1], e.toString()]);
    }
    return;
  }
  if (message[0] === 4) {
    try {
      let result = message[3].reduce(func_list[message[2]]);
      worker.parentPort.postMessage(
        [2, message[1], result],
        result_trans(result),
      );
    } catch (e) {
      worker.parentPort.postMessage([3, message[1], e.toString()]);
    }
  }
});
