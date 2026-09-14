// One runnable check for the verdict reader: a Chinese audit must not read green.
import { critiqueStatusOf, isFallacy } from './critiqueStatus.ts';
const mk = (f,b,l) => ({ isSafe:false, issue:'', fix:'', confidence:'', structuredAnalysis:{ factual:{status:f,issue:''}, balance:{status:b,check:''}, logic:{status:l,type:'',explanation:''} } });
const cases = [
  [mk('未经验证的说法','偏斜','成立'), 'danger', 'zh unverified'],
  [mk('Unverified Claim','Skewed','Sound'), 'danger', 'en unverified'],
  [mk('已核实','偏斜','成立'), 'warning', 'zh skewed only'],
  [mk('Verified','Balanced','Sound'), 'safe', 'en all clear'],
  [mk('已核实','均衡','成立'), 'safe', 'zh all clear'],
  [mk('Verified','Balanced','Fallacy'), 'danger', 'en fallacy'],
  [mk('已核实','均衡','谬误'), 'danger', 'zh fallacy'],
];
let bad = 0;
for (const [c, want, name] of cases) {
  const got = critiqueStatusOf(c);
  if (got !== want) { console.error(`FAIL ${name}: want ${want}, got ${got}`); bad++; }
}
if (isFallacy(mk('已核实','均衡','谬误')) !== true) { console.error('FAIL isFallacy zh'); bad++; }
if (critiqueStatusOf(undefined) !== null) { console.error('FAIL undefined'); bad++; }
console.log(bad ? `${bad} failed` : `all ${cases.length + 2} passed`);
process.exit(bad ? 1 : 0);
