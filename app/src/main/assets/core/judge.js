/* ============================================================
 * 判断纯规则 · 九遁（依据本书第五章第三节 吉格(3)）
 * 纯函数、无 DOM，供测试脚本抽取。
 * ============================================================ */
/* ==== JUDGE-ALGO-BEGIN ==== */
/* 五行生克（判断模块共用） */
const WX_KE   = { '木':'土','火':'金','土':'水','金':'木','水':'火' };
const WX_SHENG= { '木':'火','火':'土','土':'金','金':'水','水':'木' };
const SAN_JI_MEN = ['开门','休门','生门'];
/* 九遁检测：传入某宫的天盘干、地盘干、门盘门、八神、宫位索引，返回命中的遁名列表
 * P 索引：0离 1坤 2兑 3乾 4坎 5艮 6震 7巽
 * 依原书定义，云遁与虎遁（乙奇支）、天遁与神遁可同时命中，并列不悖 */
function judgeJiuDun(tian, di, tianMen, spirit, P){
  const hits = [];
  const sanJi = SAN_JI_MEN.indexOf(tianMen) >= 0;
  if(tian==='丙' && tianMen==='生门' && di==='丁')                          hits.push('天遁');
  if(tian==='乙' && tianMen==='开门' && di==='己')                          hits.push('地遁');
  if(tian==='丁' && tianMen==='休门' && spirit==='太阴')                    hits.push('人遁');
  if(tian==='乙' && sanJi && P===7)                                         hits.push('风遁');
  if(tian==='乙' && sanJi && di==='辛')                                     hits.push('云遁');
  if(tian==='乙' && sanJi && (P===4 || di==='癸'))                          hits.push('龙遁');
  if((tian==='乙' && (tianMen==='休门'||tianMen==='生门') && di==='辛' && P===5)
   ||(tian==='庚' && tianMen==='开门' && P===2))                            hits.push('虎遁');
  if(tian==='丙' && tianMen==='生门' && spirit==='九天')                    hits.push('神遁');
  if(tian==='丁' && spirit==='九地' && (tianMen==='杜门'||tianMen==='开门')) hits.push('鬼遁');
  return hits;
}
/* 基于日时干的庚丙诸格（均据本书凶格定义）：
 * 伏干格（日格）：天盘庚＋地盘日干（15）；飞干格：天盘日干＋地盘庚（16）；
 * 时格：天盘庚＋地盘时干（17）；悖格分支：丙加日干/时干（25）。
 * 甲日/甲时以旬首六仪为干（日取 r.dayYi，时即 r.shiGan）；天禽寄干同等参与（与悖格同口径）。
 * 与值符分支重叠时让位：日/时干等于旬首仪 r.xunYi 时由“丙加值符/值符加丙”文句覆盖，不重复上报。
 * 返回事实对象 [{ge,P}]：fuGan/feiGan/shiGe/beiDay/beiHour，文案由 renderGlobalGeju 渲染 */
function judgeGengBei(r){
  const hits = [];
  const tianAt = P => r.tianGans[P];
  const diAt = P => r.earthShown.shown[P];
  const hasGan = (P, g) => tianAt(P) === g || (P === r.qinAt && r.qinGan === g);
  const dayKey = r.dayYi, shiGan = r.shiGan;
  for(let P=0; P<8; P++){
    if(hasGan(P,'庚') && diAt(P) === dayKey)                          hits.push({ge:'fuGan', P});
    if(hasGan(P, dayKey) && diAt(P) === '庚')                        hits.push({ge:'feiGan', P});
    if(hasGan(P,'庚') && diAt(P) === shiGan && shiGan !== dayKey)     hits.push({ge:'shiGe', P});
    /* 岁格：天盘庚加地盘年干（凶格13）；月格：天盘庚加地盘月干（凶格14）；
     * 月干与年/日/时干同干时并入相应条目加注，不重复上报 */
    if(hasGan(P,'庚') && diAt(P) === r.yearKey)                       hits.push({ge:'nianGe', P});
    if(hasGan(P,'庚') && diAt(P) === r.monthKey && r.monthKey !== r.yearKey && r.monthKey !== dayKey && r.monthKey !== shiGan) hits.push({ge:'yueGe', P});
    if(hasGan(P,'丙') && diAt(P) === dayKey && dayKey !== r.xunYi)    hits.push({ge:'beiDay', P});
    if(hasGan(P,'丙') && diAt(P) === shiGan && shiGan !== dayKey && shiGan !== r.xunYi) hits.push({ge:'beiHour', P});
  }
  return hits;
}
/* ---------- 旬空：甲子旬戌亥空、甲戌旬申酉空、甲申旬午未空、甲午旬辰巳空、甲辰旬寅卯空、甲寅旬子丑空
 * 书例两旬并用：起局旬（时旬）为主（衣盗案“甲午旬中辰巳空”、天气例“甲戌旬中申酉空”），
 * 日旬用于日干/用神宫（测孕例“甲辰旬中空寅卯”为日干空亡、早夭例“日干空亡之地”） ---------- */
const XUN_NAMES = ['甲子','甲戌','甲申','甲午','甲辰','甲寅'];
const XUN_KONG = [['戌','亥'],['申','酉'],['午','未'],['辰','巳'],['寅','卯'],['子','丑']];
/* 八宫所纳地支（P序 离坤兑乾坎艮震巽） */
const PALACE_ZHI = [['午'],['未','申'],['酉'],['戌','亥'],['子'],['丑','寅'],['卯'],['辰','巳']];
/* 旬空判定：传入 [{name, idx}]（如时旬+日旬），返回 [{P, zhi, xun}] */
function judgeXunKong(xuns){
  const hits = [];
  xuns.forEach(x=>{
    const kong = XUN_KONG[x.idx];
    for(let P=0; P<8; P++){
      const z = PALACE_ZHI[P].filter(zz=>kong.indexOf(zz) >= 0);
      if(z.length) hits.push({P, zhi:z, xun:x.name});
    }
  });
  return hits;
}
/* ---------- 马星：申子辰马在寅、寅午戌马在申、巳酉丑马在亥、亥卯未马在卯（以时支起，书 part6:951 明言） ---------- */
const MA_XING = {'申':'寅','子':'寅','辰':'寅','寅':'申','午':'申','戌':'申','巳':'亥','酉':'亥','丑':'亥','亥':'卯','卯':'卯','未':'卯'};
const ZHI_PALACE = {'子':4,'丑':5,'寅':5,'卯':6,'辰':7,'巳':7,'午':0,'未':1,'申':1,'酉':2,'戌':3,'亥':3};
function judgeMaXing(hourZhi){ return MA_XING[hourZhi]; }
/* ---------- 九星旺相休囚：以星对落宫五行论（中编第五章第五节）
 * 星生宫为旺、比和为相、宫生星为废、星克宫为休、宫克星为囚 ---------- */
const STAR_WX = {'天蓬':'水','天英':'火','天冲':'木','天辅':'木','天禽':'土','天芮':'土','天任':'土','天心':'金','天柱':'金'};
function starState(starWx, palaceWx){
  if(WX_SHENG[starWx] === palaceWx) return '旺';
  if(starWx === palaceWx)             return '相';
  if(WX_SHENG[palaceWx] === starWx)  return '废';
  if(WX_KE[starWx] === palaceWx)     return '休';
  return '囚';
}
/* ---------- 八门旺相休囚死：以门对月令五行论（得时为旺，如“生门属土，四季月土旺为得时”） ---------- */
const MONTH_ZHI_WX = {'寅':'木','卯':'木','辰':'土','巳':'火','午':'火','未':'土','申':'金','酉':'金','戌':'土','亥':'水','子':'水','丑':'土'};
function gateState(gateWx, monthWx){
  if(gateWx === monthWx)              return '旺';   /* 同月令 */
  if(WX_SHENG[monthWx] === gateWx)    return '相';   /* 月令生我 */
  if(WX_SHENG[gateWx] === monthWx)    return '休';   /* 我生月令 */
  if(WX_KE[gateWx] === monthWx)       return '囚';   /* 我克月令（书：酉月火囚=火克金、丑月木囚=木克土） */
  return '死';                                        /* 月令克我 */
}
/* ---------- 宫位五行（P序 离坤兑乾坎艮震巽；中五寄坤二同土） ---------- */
const PALACE_WX = ['火','土','金','金','水','土','木','木'];
/* ---------- 宫间生克（横看铁律：一律按落宫地盘五行两两相比，与星门神自身五行无关）
 * 传入本宫索引 P，返回 { shengWo, woSheng, keWo, woKe, biHe } 各为宫位索引数组（不含本宫）。
 * 方向口径：shengWo=他宫生我（得助）、woSheng=我生他宫（泄气）、
 *           keWo=他宫克我（受制）、woKe=我克他宫（占上风）、biHe=比和 ---------- */
function palaceRelations(P){
  const rel = { shengWo:[], woSheng:[], keWo:[], woKe:[], biHe:[] };
  const wx = PALACE_WX[P];
  for(let Q=0; Q<8; Q++){
    if(Q === P) continue;
    const w = PALACE_WX[Q];
    if(WX_SHENG[w] === wx)        rel.shengWo.push(Q);
    else if(WX_SHENG[wx] === w)   rel.woSheng.push(Q);
    else if(WX_KE[w] === wx)      rel.keWo.push(Q);
    else if(WX_KE[wx] === w)      rel.woKe.push(Q);
    else                          rel.biHe.push(Q);
  }
  return rel;
}
/* ==== JUDGE-ALGO-END ==== */
