/* ============================================================
 * 拆补法起局 · 一键排盘（纯算法，无 DOM）
 * 定局：节气定阴阳遁，日干支序数 mod 15 定三元（拆补法）
 * 排盘：地盘布仪 → 旬首定值符值使 → 值符随时干、值使数宫、八神随值符
 * 时间口径：北京时间（东八区），与本书干支历一致
 * 测试脚本提取此区间的代码运行，请保持区间边界注释不动。
 * ============================================================ */
/* ==== PAIPAN-ALGO-BEGIN ==== */
const GAN2 = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'];
const ZHI2 = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
const BUYI = ['戊','己','庚','辛','壬','癸','丁','丙','乙'];
const XUNYI = ['戊','己','庚','辛','壬','癸'];   /* 甲子戊·甲戌己·甲申庚·甲午辛·甲辰壬·甲寅癸 */
const STARS = ['天英','天芮','天柱','天心','天蓬','天任','天冲','天辅'];  /* P 索引 */
const DOORS = ['景门','死门','惊门','开门','休门','生门','伤门','杜门'];  /* P 索引 */
const LOU2P = [0,4,1,6,7,1,3,2,5,0];  /* 洛书位 1-9 → 宫位索引（中五寄坤二） */
const P2LOU = [9,2,7,6,1,8,3,4];       /* 宫位索引 → 洛书位（仅八宫） */

/* 二十四节气：黄经、是否阴遁、三元局数（上/中/下） */
const TERMS = [
  { n:'冬至', lon:270, yin:false, ju:[1,7,4] }, { n:'小寒', lon:285, yin:false, ju:[2,8,5] },
  { n:'大寒', lon:300, yin:false, ju:[3,9,6] }, { n:'立春', lon:315, yin:false, ju:[8,5,2] },
  { n:'雨水', lon:330, yin:false, ju:[9,6,3] }, { n:'惊蛰', lon:345, yin:false, ju:[1,7,4] },
  { n:'春分', lon:0,   yin:false, ju:[3,9,6] }, { n:'清明', lon:15,  yin:false, ju:[4,1,7] },
  { n:'谷雨', lon:30,  yin:false, ju:[5,2,8] }, { n:'立夏', lon:45,  yin:false, ju:[4,1,7] },
  { n:'小满', lon:60,  yin:false, ju:[5,2,8] }, { n:'芒种', lon:75,  yin:false, ju:[6,3,9] },
  { n:'夏至', lon:90,  yin:true,  ju:[9,3,6] }, { n:'小暑', lon:105, yin:true,  ju:[8,2,5] },
  { n:'大暑', lon:120, yin:true,  ju:[7,1,4] }, { n:'立秋', lon:135, yin:true,  ju:[2,5,8] },
  { n:'处暑', lon:150, yin:true,  ju:[1,4,7] }, { n:'白露', lon:165, yin:true,  ju:[9,3,6] },
  { n:'秋分', lon:180, yin:true,  ju:[7,1,4] }, { n:'寒露', lon:195, yin:true,  ju:[6,9,3] },
  { n:'霜降', lon:210, yin:true,  ju:[5,8,2] }, { n:'立冬', lon:225, yin:true,  ju:[6,9,3] },
  { n:'小雪', lon:240, yin:true,  ju:[5,8,2] }, { n:'大雪', lon:255, yin:true,  ju:[4,7,1] },
];
/* 节气大致公历日期（二分初值） */
const TERM_GUESS = { 0:[3,20],15:[4,5],30:[4,20],45:[5,5],60:[5,21],75:[6,5],90:[6,21],
  105:[7,7],120:[7,22],135:[8,7],150:[8,23],165:[9,7],180:[9,23],195:[10,8],210:[10,23],
  225:[11,7],240:[11,22],255:[12,7],270:[12,21],285:[1,5],300:[1,20],315:[2,4],330:[2,19],345:[3,5] };

/* 公历 → 儒略日（格里历） */
function toJD(y,m,d,h,mi){
  if(m<=2){ y--; m+=12; }
  const A = Math.floor(y/100), B = 2 - A + Math.floor(A/4);
  return Math.floor(365.25*(y+4716)) + Math.floor(30.6001*(m+1)) + d + B - 1524.5 + (h + mi/60)/24;
}
/* 太阳视黄经（Meeus 简化式，含章动修正，精度约 0.01°） */
function sunLon(jd){
  const T = (jd - 2451545.0)/36525;
  const L0 = 280.46646 + 36000.76983*T + 0.0003032*T*T;
  const M = (357.52911 + 35999.05029*T - 0.0001537*T*T)*Math.PI/180;
  const C = (1.914602 - 0.004817*T - 0.000014*T*T)*Math.sin(M)
          + (0.019993 - 0.000101*T)*Math.sin(2*M)
          + 0.000289*Math.sin(3*M);
  const om = (125.04 - 1934.136*T)*Math.PI/180;
  let lon = L0 + C - 0.00569 - 0.00478*Math.sin(om);
  lon %= 360; if(lon<0) lon += 360;
  return lon;
}
/* 某公历年某节气（黄经）的交节时刻（儒略日，东八区钟表口径，与 toJD 输入一致），二分求根 */
function termTime(year, lon){
  const g = TERM_GUESS[lon];
  let a = toJD(year, g[0], g[1]-6, 0, 0), b = toJD(year, g[0], g[1]+6, 0, 0);
  for(let i=0;i<80;i++){
    const mid = (a+b)/2;
    let d = (sunLon(mid) - lon) % 360; if(d<0) d += 360;
    if(d <= 180) b = mid; else a = mid;
  }
  return (a+b)/2 + 8/24;  /* 太阳黄经为世界时，转为东八区钟表值 */
}
/* 给定时刻所处的节气（year 为公历基准年，用于生成节气表） */
function currentTerm(jd, year){
  const list = [];
  for(let y=year-1; y<=year+1; y++){
    TERMS.forEach(t=> list.push({ n:t.n, yin:t.yin, ju:t.ju, jd:termTime(y, t.lon) }));
  }
  list.sort((a,b)=>a.jd-b.jd);
  let cur = list[0];
  for(const t of list){ if(t.jd <= jd) cur = t; else break; }
  return cur;
}
/* 日干支序数（0=甲子，格里历；1/2 月按上一年 13/14 月） */
function dayGanzhi(y,m,d){
  if(m<=2){ y--; m+=12; }
  const c = Math.floor(y/100), yy = y%100;
  let g = Math.floor(c/4) - 16*c + 5*yy + Math.floor(yy/4) + 30*m + Math.floor(0.6*(m+1)) + d - 23;
  return ((g - 1) % 60 + 60) % 60;
}
/* 时辰地支（23 点起子时） */
function hourBranch(h){ return Math.floor(((h + 1) % 24) / 2); }
/* 十二节定月建：寅月起立春、卯月惊蛰、辰月清明、巳月立夏、午月芒种、未月小暑、
 * 申月立秋、酉月白露、戌月寒露、亥月立冬、子月大雪、丑月小寒（各月以节令交节为界） */
const JIE_MONTH = { '立春':2, '惊蛰':3, '清明':4, '立夏':5, '芒种':6, '小暑':7,
                    '立秋':8, '白露':9, '寒露':10, '立冬':11, '大雪':0, '小寒':1 };
/* 年干支序数（0=甲子）：以立春为年界（本书干支历口径，如 1986-12-16 仍属丙寅年） */
function yearGanzhi(jd, y){
  const Y = jd >= termTime(y, 315) ? y : y - 1;
  return ((Y - 4) % 60 + 60) % 60;
}
/* 月干支序数：月支由十二节定，月干以年干按五虎遁推
 *（甲己之年丙作首，乙庚之岁戊为头，丙辛必定寻庚起，丁壬壬位顺行流，戊癸甲寅好追求） */
function monthGanzhi(jd, y){
  const list = [];
  for(let Y=y-1; Y<=y+1; Y++){
    for(const n in JIE_MONTH){
      const t = TERMS.find(x=>x.n===n);
      list.push({ mb:JIE_MONTH[n], jd:termTime(Y, t.lon) });
    }
  }
  list.sort((a,b)=>a.jd-b.jd);
  let cur = list[0];
  for(const t of list){ if(t.jd <= jd) cur = t; else break; }
  const ys = yearGanzhi(jd, y) % 10;
  const mg = ((ys % 5) * 2 + 2 + (cur.mb - 2 + 12) % 12) % 10;
  let n = (6 * (mg + 1) - 5 * (cur.mb + 1)) % 60; if(n <= 0) n += 60;
  return n - 1;
}
/* 时干支（五鼠遁），返回 { gan, zhi, idx }，idx 为六十甲子序数 0-59 */
function hourGanzhi(dayGan, hb){
  const gan = ((dayGan*2) % 10 + hb) % 10;
  let n = (6*(gan+1) - 5*(hb+1)) % 60; if(n <= 0) n += 60;
  return { gan, zhi:hb, idx:n-1 };
}
/* 地盘布仪：洛书位 1-9 → 干（阳遁顺布 / 阴遁逆布，戊起局数宫） */
function layoutEarth(ju, yin){
  const palace = new Array(10).fill('');
  let pos = ju;
  for(const g of BUYI){
    palace[pos] = g;
    pos = yin ? (pos + 7) % 9 + 1 : pos % 9 + 1;
  }
  return palace;
}
/* 地盘 → 八宫显示（中五寄坤二），返回 { shown[8], ji } */
function earthShown(palace){
  const shown = new Array(8).fill('');
  for(let lou=1; lou<=9; lou++){
    if(lou === 5) continue;
    shown[LOU2P[lou]] = palace[lou];
  }
  return { shown, ji: palace[5] };
}
/* 拆补法起局主函数：返回局数、值符值使、四环目标角度、地盘显示 */
function paipan(y,m,d,h,mi){
  /* 子时换日（23 点后计次日） */
  let dy=y, dm=m, dd=d;
  if(h >= 23){
    const dt = new Date(Date.UTC(y, m-1, d) + 86400000);
    dy = dt.getUTCFullYear(); dm = dt.getUTCMonth()+1; dd = dt.getUTCDate();
  }
  const jd = toJD(y,m,d,h,mi);
  const term = currentTerm(jd, y);
  const yearIdx = yearGanzhi(jd, y);
  const monthIdx = monthGanzhi(jd, y);
  const dayIdx = dayGanzhi(dy,dm,dd);
  const yuan = Math.floor(dayIdx/5) % 3;          /* 0 上元 / 1 中元 / 2 下元 */
  const ju = term.ju[yuan];
  const palace = layoutEarth(ju, term.yin);
  const hour = hourGanzhi(dayIdx % 10, hourBranch(h));
  const xunPos = hour.idx % 10;                   /* 旬内位置 0-9 */
  const xunYi = XUNYI[Math.floor(hour.idx/10)];   /* 旬首六仪 */
  let xunLou = 0; for(let i=1;i<=9;i++) if(palace[i] === xunYi) xunLou = i;
  const xunP = LOU2P[xunLou];
  const shiGan = (hour.gan === 0) ? xunYi : GAN2[hour.gan];  /* 甲时以旬首六仪代 */
  let shiLou = 0; for(let i=1;i<=9;i++) if(palace[i] === shiGan) shiLou = i;
  const shiP = LOU2P[shiLou];
  /* 值使数宫：从旬首宫起，阳顺阴逆数旬内步数 */
  const shiShiLou = term.yin ? ((xunLou - 1 - xunPos) % 9 + 9) % 9 + 1
                             : ((xunLou - 1 + xunPos) % 9) + 1;
  const shiShiP = LOU2P[shiShiLou];
  /* 天盘旋转步数与各宫天盘干（九星携带本宫地盘干） */
  const hSteps = ((shiP - xunP) % 8 + 8) % 8;
  const tianGans = new Array(8);
  for(let P=0; P<8; P++){
    const si = ((P - hSteps) % 8 + 8) % 8;
    tianGans[P] = palace[P2LOU[si]];
  }
  /* 时干/日干的天盘落宫（张志春断局以天盘为准，如「时干壬落巽4宫」） */
  const shiTianP = (shiP + hSteps) % 8;
  /* 日干为甲：甲遁于日柱旬首六仪之下，即以该六仪为日干取其天盘落宫
   * （书例：「日干甲子戊落7宫」「日干甲午辛在坤2宫伏吟」） */
  const dayStem = GAN2[dayIdx % 10];
  const dayYi = (dayStem === '甲') ? XUNYI[Math.floor(dayIdx/10)] : dayStem;
  let dayLou = 0; for(let i=1;i<=9;i++) if(palace[i] === dayYi) dayLou = i;
  const dayTianP = (LOU2P[dayLou] + hSteps) % 8;
  /* 年/月干：甲隐于六仪，以旬首六仪为代表（书：六甲以六仪为代表而看其克应关系），供岁格/月格判定 */
  const yearStem = GAN2[yearIdx % 10], monthStem = GAN2[monthIdx % 10];
  const yearKey = yearStem === '甲' ? XUNYI[Math.floor(yearIdx/10)] : yearStem;
  const monthKey = monthStem === '甲' ? XUNYI[Math.floor(monthIdx/10)] : monthStem;
  return {
    term: term.n, yin: term.yin,
    yuan: ['上元','中元','下元'][yuan], ju,
    yearGan: GAN2[yearIdx%10] + ZHI2[yearIdx%12], yearKey,
    monthGan: GAN2[monthIdx%10] + ZHI2[monthIdx%12], monthKey,
    dayGan: GAN2[dayIdx%10] + ZHI2[dayIdx%12], dayYi,
    hourGan: GAN2[hour.gan] + ZHI2[hour.zhi],
    xunYi, xunLou, shiGan, shiLou, shiShiLou,
    hourXun: Math.floor(hour.idx/10), dayXun: Math.floor(dayIdx/10),
    tianGans, qinGan: palace[5], qinAt: (1 + hSteps) % 8, shiTianP, dayTianP,
    zhifu: STARS[xunP], zhishi: DOORS[xunP],
    angles: { earth:0, heaven:(shiP - xunP)*45, human:(shiShiP - xunP)*45, spirit: shiP*45 },
    palace, earthShown: earthShown(palace),
  };
}
/* ==== PAIPAN-ALGO-END ==== */
