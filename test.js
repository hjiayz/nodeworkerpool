let add = (a, b) => a + b;
let inc = a => a + 1;
let la = 10000000;
let params = new Array(la);
for (let i = 0; i < la; i++) {
  params[i] = i;
}
let params2 = params.slice();
console.time('one');
let oneresult = params.map(inc).reduce(add);
console.timeEnd('one');
console.log(oneresult);
let Pool = require('./index.js');
let pool = new Pool();
async function test() {
  await pool.define({
    add: add,
    inc: inc,
  });
  console.time('many');
  let list = await pool.map('inc', params2);
  return await pool.reduce('add', list);
}
test()
  .then(sum_value => {
    console.timeEnd('many');
    console.log(sum_value);
    pool.free();
  })
  .catch(e => {
    console.log(e);
    pool.free();
  });
