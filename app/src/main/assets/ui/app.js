'use strict';
/* ============================================================
 * 奇门遁甲四盘罗盘 · Kami 纸面排印风格
 * 结构：中心洛书九宫（固定）→ 地盘 → 天盘 → 人盘 → 神盘（均可旋转）
 * 方位：传统方位，南上北下。角度 0° = 离九宫（正上），顺时针递增。
 * ============================================================ */

const SVG_NS = 'http://www.w3.org/2000/svg';
const CX = 500, CY = 500;

/* Kami 色板（供 SVG 内联使用） */
const K = {
  ivory:'#faf9f5', parchment:'#f5f4ed', sand:'#f2f0e5',
  line:'#d5d1c0', lineSoft:'#e0dccd',
  ink:'#141413', dark:'#3d3d3a', olive:'#504e49', stone:'#6b6a64',
  brand:'#1B365D', tint:'#EEF2F7'
};

/* ---------- 八宫基础数据（顺时针，索引0 = 离九宫/正上） ---------- */
const PALACES = [
  { num:9, name:'离', trigram:'☲' },
  { num:2, name:'坤', trigram:'☷' },
  { num:7, name:'兑', trigram:'☱' },
  { num:6, name:'乾', trigram:'☰' },
  { num:1, name:'坎', trigram:'☵' },
  { num:8, name:'艮', trigram:'☶' },
  { num:3, name:'震', trigram:'☳' },
  { num:4, name:'巽', trigram:'☴' },
];

/* ---------- 各盘元素（顺时针排列，索引0 = 离九宫方向） ---------- */
/* 手动默认序列 = 阳遁一局 / 阴遁一局地盘：戊起坎一宫，阳顺布、阴逆布
 * 依据原书《遁甲规律表》（中编第二章第一节）；与 layoutEarth(1,*) 的一致性由回归测试断言 */
const EARTH = {
  yang: ['乙','己','丁','癸','戊','丙','庚','辛'],
  yin:  ['己','乙','辛','壬','戊','庚','丙','丁'],
};
const HEAVEN = ['天英','天芮','天柱','天心','天蓬','天任','天冲','天辅'];
const HUMAN  = ['景门','死门','惊门','开门','休门','生门','伤门','杜门'];
const SPIRIT = {
  yang: ['值符','螣蛇','太阴','六合','白虎','玄武','九地','九天'],
  yin:  ['值符','九天','九地','玄武','白虎','六合','太阴','螣蛇'],
};
/* 六仪三奇全集：八扇区未显示的那一个即中五宫寄干 */
const ALL9 = ['戊','己','庚','辛','壬','癸','丁','丙','乙'];

/* ---------- 环几何配置 ---------- */
const RINGS = [
  { id:'earth',  label:'地盘', rIn:126, rOut:204, font:36, two:false },
  { id:'heaven', label:'天盘', rIn:212, rOut:290, font:22, two:true, carry:true },
  { id:'human',  label:'人盘', rIn:298, rOut:366, font:22, two:true  },
  { id:'spirit', label:'神盘', rIn:374, rOut:428, font:18, two:true  },
];
const CENTER = { rIn:34, rOut:118 };
const BEZEL  = { rIn:436, rOut:482 };
/* ---------- 旬空标记几何（固定层，钉宫位名旁） ----------
 * r: 与宫名同径（卦名带 436-482 中径 459）；off: 相对宫位中线的角偏移（顺时针贴字右下）
 * 单圈 rSingle；双空同心双圈 rInner（时旬·墨蓝）+ rOuter（日旬·灰） */
const KONG = { r:459, off:4.5, rSingle:10, rInner:6.5, rOuter:13, sw:2.5, sw2:2.2 };

/* ---------- 全局状态 ---------- */
const state = {
  mode:'yang',
  rotations:{ earth:0, heaven:0, human:0, spirit:0 },
  /* 四盘统一文本源：地盘动态（排盘布仪 / 手动六仪序列），天盘人盘神盘固定 */
  ringText: {
    earth: EARTH.yang.slice(),
    heaven: HEAVEN.slice(),
    human: HUMAN.slice(),
    spirit: SPIRIT.yang.slice(),
  },
  earthJi: '',   /* 中五寄干（显示在地盘坤二格副行） */
  lastPaipan: null,  /* 最近一次起局结果（断局辅助：星门旺衰、宫位旬空） */
  kong: [],      /* 旬空宫位（按宫聚合，供盘面标记；空=未起局） */
};
const ringGroups = {};
const ringTexts  = {};
const ringDegEls = {};

/* ============================================================
 * 几何工具
 * ============================================================ */
function polar(r, angleDeg){
  const a = angleDeg * Math.PI/180;
  return { x: CX + r*Math.sin(a), y: CY - r*Math.cos(a) };
}
function sectorPath(rIn, rOut, a0, a1){
  const p1 = polar(rOut,a0), p2 = polar(rOut,a1), p3 = polar(rIn,a1), p4 = polar(rIn,a0);
  const large = (a1-a0) > 180 ? 1 : 0;
  return `M ${p1.x} ${p1.y} A ${rOut} ${rOut} 0 ${large} 1 ${p2.x} ${p2.y}`
       + ` L ${p3.x} ${p3.y} A ${rIn} ${rIn} 0 ${large} 0 ${p4.x} ${p4.y} Z`;
}
function donutPath(rIn, rOut){
  return `M ${CX} ${CY-rOut} A ${rOut} ${rOut} 0 1 1 ${CX} ${CY+rOut} A ${rOut} ${rOut} 0 1 1 ${CX} ${CY-rOut} Z`
       + ` M ${CX} ${CY-rIn} A ${rIn} ${rIn} 0 1 0 ${CX} ${CY+rIn} A ${rIn} ${rIn} 0 1 0 ${CX} ${CY-rIn} Z`;
}
function el(name, attrs, parent){
  const n = document.createElementNS(SVG_NS, name);
  for(const k in attrs) n.setAttribute(k, attrs[k]);
  if(parent) parent.appendChild(n);
  return n;
}
function getElements(ringId){
  return state.ringText[ringId];
}
/* 符号 → 象数理键（earth=干、heaven=星、human=门、spirit=神） */
function tipKeyFor(ringId, name){
  if(ringId==='earth')  return 'gan-' + name;
  if(ringId==='heaven') return 'star-' + name;
  if(ringId==='human')  return 'door-' + name;
  if(ringId==='spirit') return 'spirit-' + name;
  return null;
}

/* ============================================================
 * SVG 构建 · 细线几何 + 平涂，无渐变无滤镜
 * ============================================================ */
const svg = document.getElementById('compass');

/* Android System WebView 对 SVG <g> 的 touch-action 命中不稳定。
 * CSS 已将整个盘面声明为自定义手势区；此非被动兜底阻止旧 WebView
 * 在拖拽过程中把事件流升级为页面纵向滚动。 */
svg.addEventListener('touchmove', e=>{
  if(e.touches.length === 1) e.preventDefault();
}, { passive:false });

function buildBackdrop(){
  // 盘面底：象牙白圆盘，细线收边
  el('circle', { cx:CX, cy:CY, r:496, fill:K.ivory, stroke:K.lineSoft, 'stroke-width':'1.2' }, svg);
  el('circle', { cx:CX, cy:CY, r:490, fill:'none', stroke:K.lineSoft, 'stroke-width':'0.6' }, svg);
}

function buildBezel(){
  const g = el('g', {}, svg);
  el('path', { d:donutPath(BEZEL.rIn, BEZEL.rOut), fill:K.sand, 'fill-rule':'evenodd',
    stroke:K.line, 'stroke-width':'0.75' }, g);
  for(let i=0;i<8;i++){
    const a = i*45;
    const q1 = polar(BEZEL.rIn, a-22.5), q2 = polar(BEZEL.rOut, a-22.5);
    el('line', { x1:q1.x, y1:q1.y, x2:q2.x, y2:q2.y, stroke:K.line, 'stroke-width':'0.75' }, g);
    const tp = polar((BEZEL.rIn+BEZEL.rOut)/2, a);
    const t = el('text', { x:tp.x, y:tp.y, 'text-anchor':'middle', 'dominant-baseline':'central',
      'font-family':"'Noto Serif SC',serif", 'font-weight':'500', 'font-size':'26',
      fill:K.dark, class:'hint-text', 'data-tip':'gua-'+PALACES[i].name }, g);
    t.textContent = PALACES[i].name;
  }
  for(let i=0;i<64;i++){
    const a = i*5.625;
    const p1 = polar(BEZEL.rIn, a), p2 = polar(BEZEL.rIn+8, a);
    el('line', { x1:p1.x, y1:p1.y, x2:p2.x, y2:p2.y, stroke:K.line, 'stroke-width':'0.6', opacity:'0.7' }, g);
  }
}

function buildSeparators(){
  [122, 208, 294, 370, 432].forEach(r=>{
    el('circle', { cx:CX, cy:CY, r, fill:'none', stroke:K.line, 'stroke-width':'0.75' }, svg);
  });
}

function buildRing(cfg){
  const g = el('g', { class:'ring', 'data-ring':cfg.id }, svg);
  ringGroups[cfg.id] = g;
  ringTexts[cfg.id] = [];
  const elements = getElements(cfg.id);
  const rMid = (cfg.rIn + cfg.rOut)/2;

  for(let i=0;i<8;i++){
    const a0 = i*45 - 22.5, a1 = i*45 + 22.5;
    el('path', { d:sectorPath(cfg.rIn, cfg.rOut, a0, a1),
      class:'sector ' + (i%2 ? 'b' : 'a') }, g);
    const tp = polar(rMid, i*45);
    const rec = { el:null, mainEl:null, carryEl:null, x:tp.x, y:tp.y };
    if(cfg.carry || cfg.id === 'earth'){
      // 两行：主行 + 副行（天盘=携带干，地盘=中五寄干，副行墨蓝小字）
      const dy = Math.round(cfg.font * 0.62);
      const t = el('text', { x:tp.x, y:tp.y, 'text-anchor':'middle', 'dominant-baseline':'central',
        'font-family':"'Noto Serif SC','Songti SC',serif", 'font-weight':'500', fill:K.ink }, g);
      const ts1 = el('tspan', { x:tp.x, y:tp.y - dy, 'font-size':cfg.font }, t);
      ts1.textContent = elements[i];
      const ts2 = el('tspan', { x:tp.x, y:tp.y + dy, 'font-size':14, class:'carry' }, t);
      ts2.textContent = '';
      rec.el = t; rec.mainEl = ts1; rec.carryEl = ts2;
    } else {
      const t = el('text', { x:tp.x, y:tp.y, 'text-anchor':'middle', 'dominant-baseline':'central',
        'font-family':"'Noto Serif SC','Songti SC',serif",
        'font-weight':'500', 'font-size':cfg.font,
        fill:K.ink }, g);
      t.textContent = elements[i];
      rec.el = t;
    }
    ringTexts[cfg.id].push(rec);
    rec.el.setAttribute('data-tip', tipKeyFor(cfg.id, elements[i]));
  }
  attachDrag(g, cfg.id);
}

function buildCenter(){
  const g = el('g', {}, svg);
  for(let i=0;i<8;i++){
    const a0 = i*45 - 22.5, a1 = i*45 + 22.5;
    el('path', { d:sectorPath(CENTER.rIn, CENTER.rOut, a0, a1),
      class:'sector ' + (i%2 ? 'b' : 'a'), style:'cursor:default' }, g);
  }
  for(let i=0;i<8;i++){
    const np = polar(74, i*45);
    const num = el('text', { x:np.x, y:np.y, 'text-anchor':'middle', 'dominant-baseline':'central',
      'font-family':"'Noto Serif SC',serif", 'font-weight':'500', 'font-size':'36',
      fill:K.ink }, g);
    num.textContent = PALACES[i].num;
    if(PALACES[i].num === 2){
      const fp = polar(100, i*45);
      const five = el('text', { x:fp.x, y:fp.y, 'text-anchor':'middle', 'dominant-baseline':'central',
        'font-size':'14', 'font-weight':'500', fill:K.stone }, g);
      five.textContent = '五';
    } else {
      const tp = polar(102, i*45);
      const tri = el('text', { x:tp.x, y:tp.y, 'text-anchor':'middle', 'dominant-baseline':'central',
        'font-size':'14', fill:K.stone, class:'hint-text', 'data-tip':'gua-'+PALACES[i].name }, g);
      tri.textContent = PALACES[i].trigram;
    }
  }
  // 中宫太极 · 墨蓝 + 象牙白
  const tj = el('g', { transform:`translate(${CX},${CY}) scale(0.24)` }, g);
  el('circle', { r:100, fill:K.ivory }, tj);
  el('path', { d:'M0,-100 A100,100 0 0,1 0,100 A50,50 0 0,1 0,0 A50,50 0 0,0 0,-100 Z', fill:K.brand }, tj);
  el('circle', { cy:-50, r:13, fill:K.ivory }, tj);
  el('circle', { cy:50, r:13, fill:K.brand }, tj);
  el('circle', { r:100, fill:'none', stroke:K.brand, 'stroke-width':'5' }, tj);
}

function buildPointer(){
  // 顶部墨蓝指针（指向离九宫）
  const g = el('g', { 'pointer-events':'none' }, svg);
  el('path', { d:`M ${CX} 0 L ${CX-10} 11 L ${CX} 22 L ${CX+10} 11 Z`, fill:K.brand }, g);
}

/* 点击高亮：墨蓝半透明扇形，罩住当前点击的宫 */
function buildHighlight(){
  const g = el('g', { id:'palaceHighlight', 'pointer-events':'none', opacity:'0', style:'transition:opacity .22s ease' }, svg);
  el('path', { d:sectorPath(45, 478, -22.5, 22.5), fill:K.brand, opacity:'0.10', stroke:K.brand, 'stroke-width':'1.4' }, g);
}
function highlightPalace(P){
  const g = document.getElementById('palaceHighlight');
  if(!g) return;
  g.setAttribute('transform', `rotate(${P*45} ${CX} ${CY})`);
  g.setAttribute('opacity', '1');
}
function clearHighlight(){
  const g = document.getElementById('palaceHighlight');
  if(g) g.setAttribute('opacity', '0');
}

/* ============================================================
 * 旬空标记（固定图层，钉宫位名旁，不随四环旋转）
 * 圈＝空亡之宫：时旬空墨蓝、日旬空灰（K.stone）、双空同心双圈（内墨蓝、外灰）
 * 判定口径与全局格局判词共用 computeKong / judgeXunKong
 * ============================================================ */
function buildKongLayer(){
  el('g', { id:'kongMark', 'pointer-events':'none' }, svg);
}
function updateKongMarks(){
  const g = document.getElementById('kongMark');
  if(!g) return;
  while(g.firstChild) g.removeChild(g.firstChild);
  (state.kong || []).forEach(rec=>{
    const p = polar(KONG.r, rec.P*45 + KONG.off);
    if(rec.shi && rec.ri){
      el('circle', { cx:p.x, cy:p.y, r:KONG.rOuter, fill:'none', stroke:K.stone, 'stroke-width':KONG.sw2 }, g);
      el('circle', { cx:p.x, cy:p.y, r:KONG.rInner, fill:'none', stroke:K.brand, 'stroke-width':KONG.sw2 }, g);
    }else{
      el('circle', { cx:p.x, cy:p.y, r:KONG.rSingle, fill:'none',
        stroke: rec.shi ? K.brand : K.stone, 'stroke-width':KONG.sw }, g);
    }
  });
}
/* 旬空计算（全局格局判词 + 盘面标记共用）：时旬空主看起局时空，
 * 日旬空兼看日干/日用神；两旬相同时只报一次（盘面亦按单圈显示）。
 * byPalace 按宫聚合：shi/ri 分记时旬空与日旬空，双空两记皆真 */
function computeKong(r){
  const xunList = [{name:XUN_NAMES[r.hourXun], idx:r.hourXun, kind:'时旬空', note:'随时柱而定，主看本局当前时空与所问事情'}];
  if(r.dayXun !== r.hourXun) xunList.push({name:XUN_NAMES[r.dayXun], idx:r.dayXun, kind:'日旬空', note:'随日柱而定，重点看日干、日用神所落之宫'});
  const hits = judgeXunKong(xunList);
  const byPalace = [];
  hits.forEach(h=>{
    let rec = byPalace.find(x=>x.P === h.P);
    if(!rec){ rec = { P:h.P, shi:false, ri:false, zhi:[], xun:[] }; byPalace.push(rec); }
    const src = xunList.find(x=>x.name === h.xun);
    if(src.kind === '时旬空') rec.shi = true; else rec.ri = true;
    h.zhi.forEach(z=>{ if(rec.zhi.indexOf(z) < 0) rec.zhi.push(z); });
    if(rec.xun.indexOf(h.xun) < 0) rec.xun.push(h.xun);
  });
  return { xunList, hits, byPalace };
}

/* ============================================================
 * 宫间生克标注（固定图层，钉宫位，不随四环旋转）
 * 点选某宫后：其余七宫按地盘五行与本宫比对（palaceRelations，横看铁律），
 * 扇区淡色+同色描边，宫名旁字签（生我/我生/克我/我克/比和），
 * 外圈弧线箭头：实线=相生、虚线=相克，箭头指向受生/受克之宫。
 * ============================================================ */
const REL_STYLE = {
  shengWo: { color:'#0F6E56', label:'生我', note:'得助' },   /* 青绿 */
  woSheng: { color:'#378ADD', label:'我生', note:'泄气' },   /* 蓝 */
  keWo:    { color:'#A32D2D', label:'克我', note:'受制' },   /* 朱红 */
  woKe:    { color:'#BA7517', label:'我克', note:'占上风' }, /* 琥珀 */
  biHe:    { color:'#6b6a64', label:'比和', note:'同气' },   /* 石灰 */
};
/* 箭头半径：四类各占一条无文字的环隙（地盘|天盘|人盘|神盘之间），异色弧线永不重叠。
 * 入本宫（生我/克我）走外两隙，出本宫（我生/我克）走内两隙。 */
const REL_ARROW_R = { shengWo:432, keWo:370, woSheng:294, woKe:208 };
function buildRelLayer(){
  el('g', { id:'relMark', 'pointer-events':'none', opacity:'0', style:'transition:opacity .22s ease' }, svg);
}
/* 外圈弧线箭头：aFrom → aTo（角度，0=离宫顺时针），取短弧，端点内缩避开宫界 */
function relArcArrow(g, aFrom, aTo, r, color, dashed){
  const cw = (((aTo - aFrom) % 360) + 360) % 360;
  const dir = (cw <= 180) ? 1 : -1;              /* 1=顺时针 */
  const inset = 10;
  const start = aFrom + dir*inset, end = aTo - dir*inset;
  const p1 = polar(r, start), p2 = polar(r, end);
  const attrs = { d:`M ${p1.x} ${p1.y} A ${r} ${r} 0 0 ${dir===1?1:0} ${p2.x} ${p2.y}`,
    fill:'none', stroke:color, 'stroke-width':'2.5', 'stroke-linecap':'round' };
  if(dashed) attrs['stroke-dasharray'] = '8,6';
  el('path', attrs, g);
  /* 箭头：终点处沿切线方向的小三角 */
  const ar = end * Math.PI/180;
  const tx = dir * Math.cos(ar), ty = dir * Math.sin(ar);   /* 切向（顺/逆时针） */
  const nx = -ty, ny = tx;
  const s = 11, w = 4.5;
  const bx = p2.x - tx*s, by = p2.y - ty*s;
  el('polygon', { points:`${p2.x},${p2.y} ${bx+nx*w},${by+ny*w} ${bx-nx*w},${by-ny*w}`, fill:color }, g);
}
function renderRelMarks(P, rel){
  const g = document.getElementById('relMark');
  if(!g) return;
  while(g.firstChild) g.removeChild(g.firstChild);
  for(const kind in rel){
    const st = REL_STYLE[kind];
    const isSheng = (kind === 'shengWo' || kind === 'woSheng');
    const intoSelf = (kind === 'shengWo' || kind === 'keWo');
    rel[kind].forEach(Q=>{
      /* 扇区淡色 + 描边 */
      el('path', { d:sectorPath(45, 478, Q*45 - 22.5, Q*45 + 22.5),
        fill:st.color, 'fill-opacity':'0.08', stroke:st.color, 'stroke-opacity':'0.8', 'stroke-width':'1.2' }, g);
      /* 宫名旁字签（bezel 带上，顺时针贴宫名右侧） */
      const cp = polar(459, Q*45 + 13);
      el('rect', { x:cp.x - 24, y:cp.y - 12, width:48, height:24, rx:12,
        fill:K.ivory, stroke:st.color, 'stroke-width':'1.4' }, g);
      const t = el('text', { x:cp.x, y:cp.y, 'text-anchor':'middle', 'dominant-baseline':'central',
        'font-family':"'Noto Serif SC',serif", 'font-weight':'500', 'font-size':'15', fill:st.color }, g);
      t.textContent = st.label;
      /* 弧线箭头：生我/克我 → 入本宫；我生/我克 → 出本宫；比和无生克方向，不画。
       * 各类别独立半径（REL_ARROW_R），不同颜色弧线互不重叠 */
      if(kind === 'biHe') return;
      const r = REL_ARROW_R[kind];
      if(intoSelf) relArcArrow(g, Q*45, P*45, r, st.color, !isSheng);
      else         relArcArrow(g, P*45, Q*45, r, st.color, !isSheng);
    });
  }
  g.setAttribute('opacity', '1');
}
function clearRelMarks(){
  const g = document.getElementById('relMark');
  if(!g) return;
  g.setAttribute('opacity', '0');
}

/* 当前选中的宫位（null=未选）；clearSelection 清除选宫标注
 *（高亮 + 生克标注 + 判断卡片），回到刚排好盘的状态——盘面与全局格局保留 */
let selectedPalace = null;
function clearSelection(){
  selectedPalace = null;
  clearHighlight();
  clearRelMarks();
  const jb = document.getElementById('judgeBody');
  if(jb){ jb.classList.add('empty'); jb.innerHTML = ''; }
}

/* ============================================================
 * 旋转交互（文字绕自身中心反向旋转，始终水平）
 * ============================================================ */
function pointerAngle(e){
  const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(svg.getScreenCTM().inverse());
  return Math.atan2(p.x - CX, -(p.y - CY)) * 180/Math.PI;
}
function applyRotation(ringId, angle){
  state.rotations[ringId] = angle;
  ringGroups[ringId].setAttribute('transform', `rotate(${angle} ${CX} ${CY})`);
  ringTexts[ringId].forEach(t=>{
    t.el.setAttribute('transform', `rotate(${-angle} ${t.x} ${t.y})`);
  });
  updateReadout(ringId);
  if(ringId === 'earth') updateCarry();   // 地盘一变，星背上的干跟着换
}
const ringAnims = {};
/* 取消某环动画：置死 alive 标记并清定时器，防止旧动画的 step 继续覆盖新状态 */
function cancelAnim(ringId){
  const a = ringAnims[ringId];
  if(a){ a.alive = false; clearTimeout(a.timer); ringAnims[ringId] = null; }
}
/* setTimeout 步进驱动动画（真机验证过的既定行为；rAF 亦可，为稳定保持现状） */
function animateSnap(ringId, toAngle){
  cancelAnim(ringId);
  const fromAngle = state.rotations[ringId];
  const diff = toAngle - fromAngle;
  if(Math.abs(diff) < 0.01){ applyRotation(ringId, toAngle); return; }
  const duration = 320, start = performance.now();
  const anim = { alive:true, timer:null };   /* alive=本动画是否仍有效；timer=当前定时器 */
  ringAnims[ringId] = anim;
  function step(){
    if(!anim.alive) return;
    const t = Math.min(1, (performance.now() - start)/duration);
    const eased = 1 - Math.pow(1 - t, 3);
    applyRotation(ringId, fromAngle + diff * eased);
    if(t < 1){ anim.timer = setTimeout(step, 16); }
    else{
      anim.alive = false;
      if(ringAnims[ringId] === anim) ringAnims[ringId] = null;
    }
  }
  anim.timer = setTimeout(step, 16);
}
function attachDrag(g, ringId){
  let dragging = false, longPressed = false, startAngle = 0, startRot = 0;
  let startX = 0, startY = 0, longTimer = null;
  g.addEventListener('pointerdown', e=>{
    if(e.button !== 0) return;               /* 只响应主键 */
    cancelAnim(ringId);
    if(!tipEl.classList.contains('pinned')){ tipEl.style.display='none'; tipEl._key=null; }  /* 按下时收起悬停浮层，不遮挡拖拽 */
    startAngle = pointerAngle(e);
    startRot = state.rotations[ringId];
    startX = e.clientX; startY = e.clientY;
    dragging = false; longPressed = false;
    /* 长按 0.5s（未移动超阈值）→ 显示该位置符号的象数理 */
    clearTimeout(longTimer);
    longTimer = setTimeout(()=>{
      const t = e.target && e.target.closest ? e.target.closest('text[data-tip]') : null;
      if(!t) return;                                 /* 长按空白扇区不吞掉正常点按 */
      longPressed = true;
      tipPin(e, t.getAttribute('data-tip'));         /* 长按钉住显示象数理 */
    }, 500);
  });
  g.addEventListener('pointermove', e=>{
    if(e.buttons === 0){
      /* 抬起事件丢失（如按在浮层上）后的状态复位，避免幽灵“按住/拖拽” */
      clearTimeout(longTimer); longPressed = false;
      if(dragging){
        dragging = false;
        g.classList.remove('dragging'); svg.classList.remove('has-drag');
        animateSnap(ringId, Math.round(state.rotations[ringId]/45)*45);
      }
      return;
    }
    if(longPressed) return;                    /* 已触发长按，保持显示不拖拽 */
    if(!dragging){
      if(Math.hypot(e.clientX - startX, e.clientY - startY) < 8) return;  /* 未超阈值，继续等长按 */
      clearTimeout(longTimer);                 /* 位移超阈值 → 取消长按，进入拖拽 */
      dragging = true;
      try{ g.setPointerCapture(e.pointerId); }catch(err){}   /* 合成事件下 capture 可能抛错，不阻塞拖拽 */
      g.classList.add('dragging');
      svg.classList.add('has-drag');
    }
    let delta = pointerAngle(e) - startAngle;
    while(delta > 180) delta -= 360;
    while(delta < -180) delta += 360;
    applyRotation(ringId, startRot + delta);
  });
  g.addEventListener('pointerleave', ()=>{ if(!dragging) clearTimeout(longTimer); });  /* 按下后未拖动就移出，取消长按 */
  const finishDrag = ()=>{
    if(!dragging) return false;
    dragging = false;
    g.classList.remove('dragging');
    svg.classList.remove('has-drag');
    const snapped = Math.round(state.rotations[ringId]/45)*45;
    animateSnap(ringId, snapped);
    return true;
  };
  const end = e=>{
    clearTimeout(longTimer);
    if(longPressed){                           /* 长按已显示象数理 */
      longPressed = false;
      return;
    }
    if(finishDrag()) return;                   /* 拖动排盘 */
    /* 点按（未拖未长按）：显示该宫判断 */
    showJudgment(palaceFromPoint(e));
  };
  const cancel = e=>{
    clearTimeout(longTimer);
    longPressed = false;
    /* 浏览器或系统中止事件流时，仅结束拖拽并回正，绝不误判成点按。 */
    finishDrag();
    try{ g.releasePointerCapture(e.pointerId); }catch(err){}
  };
  g.addEventListener('pointerup', end);
  g.addEventListener('pointercancel', cancel);
}

/* ============================================================
 * 读数面板
 * ============================================================ */
const readoutTable = document.getElementById('readoutTable');
let readoutCells = {};
function buildReadout(){
  let html = '<thead><tr><th style="width:92px"></th>';
  PALACES.forEach(p=>{
    html += `<th class="${p.num===1?'kan':''}"><span class="g-name">${p.trigram} ${p.name}</span><span class="g-num">${p.num}宫</span></th>`;
  });
  html += '</tr></thead><tbody>';
  RINGS.forEach(r=>{
    html += `<tr><th>${r.label}<span class="deg" id="deg-${r.id}">0°</span></th>`;
    PALACES.forEach((p,pi)=>{
      html += `<td class="${r.two?'two':''} ${p.num===1?'kan-col':''}" data-ring="${r.id}" data-p="${pi}"></td>`;
    });
    html += '</tr>';
  });
  html += '</tbody>';
  readoutTable.innerHTML = html;
  readoutCells = {};
  readoutTable.querySelectorAll('td[data-ring]').forEach(td=>{
    readoutCells[td.dataset.ring + '_' + td.dataset.p] = td;
  });
  RINGS.forEach(r=>{ ringDegEls[r.id] = document.getElementById('deg-'+r.id); });
}
function elementAtPalace(ringId, palaceIdx){
  const els = getElements(ringId);
  const steps = Math.round(state.rotations[ringId]/45);
  let i = (palaceIdx - steps) % 8;
  if(i < 0) i += 8;
  return els[i];
}
function updateReadout(changedRing){
  RINGS.forEach(r=>{
    if(changedRing && r.id !== changedRing) return;
    const deg = ((Math.round(state.rotations[r.id])%360)+360)%360;
    ringDegEls[r.id].textContent = deg + '°';
    for(let p=0;p<8;p++){
      const cell = readoutCells[r.id+'_'+p];
      const val = elementAtPalace(r.id, p);
      if(cell.textContent !== val){
        cell.textContent = val;
        if(changedRing){ cell.classList.remove('flash'); void cell.offsetWidth; cell.classList.add('flash'); }
      }
    }
  });
}

/* ============================================================
 * 控件
 * ============================================================ */
/* 统一刷新某一环的文本（含悬停键同步、地盘寄干副行） */
function renderText(ringId){
  const texts = state.ringText[ringId];
  ringTexts[ringId].forEach((t,i)=>{
    if(t.mainEl) t.mainEl.textContent = texts[i];
    else t.el.textContent = texts[i];
    t.el.setAttribute('data-tip', tipKeyFor(ringId, texts[i]));
    if(ringId === 'earth' && t.carryEl){
      t.carryEl.textContent = (i === 1 && state.earthJi) ? '寄' + state.earthJi : '';
    }
  });
}
/* 统一刷新整盘：文本 + 旋转动画到位 + 携带干 + 读数表（起局 / 复原共用入口）
 * targets 为目标角度；state.rotations 始终为当前实际角度，由动画逐帧维护 */
function renderAll(targets){
  RINGS.forEach(rg=> renderText(rg.id));
  RINGS.forEach(rg=> animateSnap(rg.id, ((targets[rg.id] % 360) + 360) % 360));
  updateCarry();
  updateReadout();
}
/* 星携带的天干 = 该星本宫当前对齐到的地盘干；天禽寄天芮，带中五宫寄干 */
function carryGanAt(i){ return elementAtPalace('earth', i); }
function center5Gan(){
  const shown = getElements('earth');
  return ALL9.find(g => shown.indexOf(g) < 0) || '';
}
function updateCarry(){
  const recs = ringTexts.heaven;
  if(!recs) return;
  for(let i=0;i<8;i++){
    if(!recs[i].carryEl) continue;
    recs[i].carryEl.textContent = (i === 1)
      ? carryGanAt(1) + '  禽' + center5Gan()   // 天芮格夹注天禽
      : carryGanAt(i);
  }
}
document.getElementById('modeSeg').addEventListener('click', e=>{
  const btn = e.target.closest('button');
  if(!btn || btn.classList.contains('active')) return;
  document.querySelectorAll('#modeSeg button').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  state.mode = btn.dataset.mode;
  state.ringText.earth = EARTH[state.mode].slice();
  state.ringText.spirit = SPIRIT[state.mode].slice();
  state.earthJi = '';
  renderText('earth');
  renderText('spirit');
  updateCarry();
  updateReadout();
  const sum = document.getElementById('paipanSummary');
  if(sum) sum.classList.add('empty');  /* 回到手动排盘，收起排盘摘要 */
  state.lastPaipan = null;
  state.kong = [];
  updateKongMarks();
});
document.getElementById('resetBtn').addEventListener('click', ()=>{
  /* 还原盘面：四盘文本回默认序列 + 四环归零，统一走 renderAll */
  state.ringText.earth = EARTH[state.mode].slice();
  state.ringText.spirit = SPIRIT[state.mode].slice();
  state.earthJi = '';
  renderAll({ earth:0, heaven:0, human:0, spirit:0 });
  clearSelection();
  const sum = document.getElementById('paipanSummary');
  if(sum) sum.classList.add('empty');
  state.lastPaipan = null;
  state.kong = [];
  updateKongMarks();
  const glb = document.getElementById('judgeGlobal');
  if(glb){ glb.classList.add('empty'); glb.innerHTML = ''; }
  try{ localStorage.removeItem('qimen.lastJu'); }catch(err){}
});

/* ============================================================
 * 初始化
 * ============================================================ */
buildBackdrop();
buildBezel();
buildSeparators();
RINGS.forEach(buildRing);
buildCenter();
buildPointer();
buildHighlight();
buildKongLayer();
buildRelLayer();
buildReadout();
updateCarry();
updateReadout();





/* ============================================================
 * 一键排盘 · UI 集成
 * ============================================================ */
const paipanSummary = document.getElementById('paipanSummary');
const PALACE_NAMES = '离坤兑乾坎艮震巽';

/* ============================================================
 * 日期选择器（自绘日历 + 时刻滚轮，替代原生 datetime-local）
 * 交互：日历点选日期；日历上滚轮旋转日期（跨月自动翻页）；
 *       时/分滚轮或按钮微调；"现在"一键回到当前时刻。
 * ============================================================ */
const pick = { y:0, m:0, d:0, h:0, min:0, viewY:0, viewM:0 };
const p2 = n => String(n).padStart(2,'0');
function daysInMonth(y,m){ return new Date(y, m, 0).getDate(); }

function initPicker(){
  const now = new Date();
  pick.y = now.getFullYear(); pick.m = now.getMonth()+1; pick.d = now.getDate();
  pick.h = now.getHours(); pick.min = now.getMinutes();
  pick.viewY = pick.y; pick.viewM = pick.m;
  renderCalendar();
  renderTime();
}

function renderCalendar(){
  document.getElementById('calYearBtn').textContent = pick.viewY + '年';
  document.getElementById('calMonthBtn').textContent = pick.viewM + '月';
  const grid = document.getElementById('calGrid');
  grid.innerHTML = '';
  const wd = (new Date(pick.viewY, pick.viewM-1, 1).getDay() + 6) % 7;  /* 周一开头 */
  const dim = daysInMonth(pick.viewY, pick.viewM);
  const now = new Date();
  for(let i=0;i<wd;i++){
    const b = document.createElement('div');
    b.className = 'cal-day blank';
    grid.appendChild(b);
  }
  for(let d=1; d<=dim; d++){
    const b = document.createElement('div');
    b.className = 'cal-day';
    if(pick.viewY===now.getFullYear() && pick.viewM===now.getMonth()+1 && d===now.getDate()) b.classList.add('today');
    if(pick.viewY===pick.y && pick.viewM===pick.m && d===pick.d) b.classList.add('sel');
    b.textContent = d;
    b.addEventListener('click', ()=>{
      pick.y = pick.viewY; pick.m = pick.viewM; pick.d = d;
      renderCalendar();
    });
    grid.appendChild(b);
  }
}

function renderTime(){
  document.getElementById('hourVal').textContent = p2(pick.h);
  document.getElementById('minVal').textContent = p2(pick.min);
}

/* 按天旋转（滚轮驱动），跨月自动翻月 */
function shiftDay(delta){
  const dt = new Date(pick.y, pick.m-1, pick.d + delta);
  pick.y = dt.getFullYear(); pick.m = dt.getMonth()+1; pick.d = dt.getDate();
  pick.viewY = pick.y; pick.viewM = pick.m;
  renderCalendar(); renderTime();
}
function shiftHour(d){ pick.h = (pick.h + d + 24) % 24; renderTime(); }
function shiftMin(d){ pick.min = (pick.min + d + 60) % 60; renderTime(); }

/* ---------- 年/月快速选择弹层 ---------- */
const calPop = document.getElementById('calPop');
let yearBase = 0;   /* 年份面板视图中心 */

function closePop(){
  calPop.classList.remove('open');
  calPop.innerHTML = '';
}

function openYearPanel(){
  calPop.dataset.mode = 'year';
  yearBase = pick.viewY;
  calPop.innerHTML =
    `<div class="pop-head">
       <button class="pop-nav" data-nav="-10" aria-label="前十年">«</button>
       <button class="pop-nav" data-nav="-1" aria-label="前一年">‹</button>
       <span class="pop-title" id="popTitle"></span>
       <button class="pop-nav" data-nav="1" aria-label="后一年">›</button>
       <button class="pop-nav" data-nav="10" aria-label="后十年">»</button>
     </div>
     <div class="pop-grid years" id="popGrid"></div>`;
  calPop.classList.add('open');
  renderYearGrid();
}

function renderYearGrid(){
  document.getElementById('popTitle').textContent = (yearBase-12) + ' — ' + (yearBase+12);
  const grid = document.getElementById('popGrid');
  grid.innerHTML = '';
  for(let y=yearBase-12; y<=yearBase+12; y++){
    const b = document.createElement('button');
    b.className = 'pop-cell' + (y===pick.viewY ? ' sel' : '') + (y===pick.y ? ' cur' : '');
    b.dataset.year = y;
    b.textContent = y;
    grid.appendChild(b);
  }
  grid.scrollTop = 0;
}

function openMonthPanel(){
  calPop.dataset.mode = 'month';
  calPop.innerHTML = '<div class="pop-grid months" id="popGrid"></div>';
  const grid = document.getElementById('popGrid');
  for(let m=1; m<=12; m++){
    const b = document.createElement('button');
    b.className = 'pop-cell' + (m===pick.viewM ? ' sel' : '');
    b.dataset.month = m;
    b.textContent = m + '月';
    grid.appendChild(b);
  }
  calPop.classList.add('open');
}

/* 标题按钮：开/关对应弹层 */
document.getElementById('calYearBtn').addEventListener('click', e=>{
  e.stopPropagation();
  if(calPop.classList.contains('open') && calPop.dataset.mode === 'year') closePop();
  else openYearPanel();
});
document.getElementById('calMonthBtn').addEventListener('click', e=>{
  e.stopPropagation();
  if(calPop.classList.contains('open') && calPop.dataset.mode === 'month') closePop();
  else openMonthPanel();
});

/* 弹层内点击：选年 / 选月 / 平移年份 */
calPop.addEventListener('click', e=>{
  const nav = e.target.closest('[data-nav]');
  if(nav){ yearBase += Number(nav.dataset.nav); renderYearGrid(); return; }
  const yb = e.target.closest('[data-year]');
  if(yb){ pick.viewY = Number(yb.dataset.year); renderCalendar(); closePop(); return; }
  const mb = e.target.closest('[data-month]');
  if(mb){ pick.viewM = Number(mb.dataset.month); renderCalendar(); closePop(); return; }
});

/* 弹层滚轮：向上滚 = 更早年份，向下滚 = 更晚年份 */
calPop.addEventListener('wheel', e=>{
  if(!calPop.classList.contains('open') || calPop.dataset.mode !== 'year') return;
  e.preventDefault();
  yearBase += (e.deltaY > 0 ? 1 : -1);
  renderYearGrid();
}, { passive:false });

/* 点击弹层外关闭 */
document.addEventListener('click', e=>{
  if(!calPop.classList.contains('open')) return;
  if(!calPop.contains(e.target) && !e.target.closest('.cal-title-btn')) closePop();
});

/* 翻月 */
document.getElementById('calPrev').addEventListener('click', ()=>{
  pick.viewM--; if(pick.viewM < 1){ pick.viewM = 12; pick.viewY--; }
  renderCalendar();
});
document.getElementById('calNext').addEventListener('click', ()=>{
  pick.viewM++; if(pick.viewM > 12){ pick.viewM = 1; pick.viewY++; }
  renderCalendar();
});

/* 日历滚轮：旋转日期，向上滚 = 前一天，向下滚 = 后一天 */
document.getElementById('calGrid').addEventListener('wheel', e=>{
  e.preventDefault();
  shiftDay(e.deltaY > 0 ? 1 : -1);
}, { passive:false });

/* 触屏：左右滑动翻月（滚轮缺失时的移动端替代） */
(function(){
  let tx = null;
  const grid = document.getElementById('calGrid');
  grid.addEventListener('touchstart', e=>{ tx = e.touches[0].clientX; }, { passive:true });
  grid.addEventListener('touchend', e=>{
    if(tx === null) return;
    const dx = e.changedTouches[0].clientX - tx;
    if(Math.abs(dx) > 40){
      if(dx < 0) document.getElementById('calNext').click();
      else document.getElementById('calPrev').click();
    }
    tx = null;
  }, { passive:true });
})();

/* 时/分滚轮与按钮 */
document.getElementById('hourField').addEventListener('wheel', e=>{
  e.preventDefault();
  shiftHour(e.deltaY > 0 ? 1 : -1);
}, { passive:false });
document.getElementById('minField').addEventListener('wheel', e=>{
  e.preventDefault();
  shiftMin(e.deltaY > 0 ? 1 : -1);
}, { passive:false });
document.querySelectorAll('.time-btn').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    if(btn.dataset.kind === 'h') shiftHour(Number(btn.dataset.dir));
    else shiftMin(Number(btn.dataset.dir));
  });
});

/* 现在 */
document.getElementById('todayBtn').addEventListener('click', initPicker);

function renderSummary(r){
  const yang = r.yin ? '阴' : '阳';
  const zfName = r.xunLou === 5 ? '天禽（寄坤随芮）' : r.zhifu;
  paipanSummary.innerHTML =
    `<span class="s-term">${r.term}</span>` +
    `<span class="s-ju">${yang}遁${r.ju}局</span>` +
    `<span class="s-dim">拆补 · ${r.yuan}</span>` +
    `<span class="s-dim">${r.yearGan}年 ${r.monthGan}月 ${r.dayGan}日 ${r.hourGan}时</span>` +
    `<span class="s-dim">值符 ${zfName}</span>` +
    `<span class="s-dim">值使 ${r.zhishi}</span>` +
    `<span class="s-dim">时干${r.shiGan}天盘落${PALACE_NAMES[r.shiTianP]}宫 · 日干${r.dayGan[0] === '甲' ? `甲（${r.dayYi}）` : r.dayGan[0]}落${PALACE_NAMES[r.dayTianP]}宫</span>`;
  paipanSummary.classList.remove('empty');
}

function applyPaipan(r){
  /* 盘面将变，清除旧点击高亮 */
  clearHighlight();
  state.lastPaipan = r;  /* 供点盘观应读取断局辅助（星门旺衰、宫位旬空） */
  /* 1. 同步阴阳遁 */
  const mode = r.yin ? 'yin' : 'yang';
  document.querySelectorAll('#modeSeg button').forEach(b=>b.classList.toggle('active', b.dataset.mode === mode));
  state.mode = mode;
  /* 2. 统一盘面状态：地盘布仪、神盘随遁、四环角度，全部经 renderAll 一次刷新 */
  state.ringText.earth = r.earthShown.shown.slice();
  state.ringText.spirit = SPIRIT[mode].slice();
  state.earthJi = r.earthShown.ji;
  renderAll({
    earth: 0,
    heaven: ((r.angles.heaven % 360) + 360) % 360,
    human: ((r.angles.human % 360) + 360) % 360,
    spirit: ((r.angles.spirit % 360) + 360) % 360,
  });
  /* 3. 摘要 */
  renderSummary(r);
  /* 4. 全局格局（五不遇时 / 玉女守门 / 悖格等） */
  renderGlobalGeju(r);
  /* 5. 旬空宫位标记（钉宫位名旁，与判词同口径） */
  state.kong = computeKong(r).byPalace;
  updateKongMarks();
  /* 6. 持久化本次起局：应用重启（APK 被杀后台）后可恢复最后一盘 */
  try{ localStorage.setItem('qimen.lastJu', JSON.stringify(r)); }catch(err){}
}

/* 起局：从选择器取日期时刻 */
document.getElementById('paipanBtn').addEventListener('click', ()=>{
  try{
    const r = paipan(pick.y, pick.m, pick.d, pick.h, pick.min);
    applyPaipan(r);
  }catch(err){
    paipanSummary.innerHTML = `<span class="s-dim">排盘失败：${err.message}</span>`;
    paipanSummary.classList.remove('empty');
  }
});

initPicker();

/* ============================================================
 * 判断模块 · 点盘观应（十干克应 / 八门克应 / 吉凶格）
 * 克应数据见 qimen-data.js（张志春《神奇之门》原文提取）
 * ============================================================ */
const PALACE_CN = ['离九','坤二','兑七','乾六','坎一','艮八','震三','巽四'];
const GAN_IDX = { '甲':0,'乙':1,'丙':2,'丁':3,'戊':4,'己':5,'庚':6,'辛':7,'壬':8,'癸':9 };
const GAN_WX = { '甲':'木','乙':'木','丙':'火','丁':'火','戊':'土','己':'土','庚':'金','辛':'金','壬':'水','癸':'水' };
const GAN_YY = { '甲':1,'乙':0,'丙':1,'丁':0,'戊':1,'己':0,'庚':1,'辛':0,'壬':1,'癸':0 };
const DOOR_WX = { '休':'水','生':'土','伤':'木','杜':'木','景':'火','死':'土','惊':'金','开':'金' };
/* PALACE_WX（宫位五行）与 palaceRelations（宫间生克）已移至 core/judge.js 的 JUDGE-ALGO 区间，全局可用 */
const GAN_CHONG = { '戊':'辛','辛':'戊','己':'壬','壬':'己','庚':'癸','癸':'庚' };  /* 六仪对冲（值符反吟） */
const GAN_CN = { '戊':'甲子戊','乙':'乙奇','丙':'丙奇','丁':'丁奇','己':'甲戌己','庚':'甲申庚','辛':'甲午辛','壬':'甲辰壬','癸':'甲寅癸' };

/* 天盘干：该宫天盘星所携带的本宫地盘干 */
function tianGanAt(P){
  const star = elementAtPalace('heaven', P);
  const si = HEAVEN.indexOf(star);
  return si >= 0 ? carryGanAt(si) : '';
}

/* 点击罗盘命中宫位（区分拖拽与点击） */
/* 点击盘面不再触发宫位判断（取消跳转）；象数理改由长按（0.5s）显示，关闭由 document click 处理 */

/* 象数理悬停/点按提示（八卦 / 九星 / 八门 / 八神 / 十天干）
 * 桌面：悬停跟随；触屏（hover:none）：点按钉住，再点或点外部关闭 */
const tipEl = document.getElementById('tip');
const tipBody = document.getElementById('tipBody');
function isTouchDevice(){
  return window.matchMedia && window.matchMedia('(hover: none)').matches;
}
function tipShow(key){
  const [kind, name] = key.split('-');
  const data = XIANG[kind] && XIANG[kind][name];
  if(!data){ tipEl.style.display = 'none'; return; }
  let h = `<div class="t-head">${name}${data.tag ? `<span class="t-tag">${data.tag}</span>` : ''}</div>`;
  for(const k in data.body){
    h += `<div class="t-sec"><b>${k}</b><br/>${data.body[k]}</div>`;
  }
  tipBody.innerHTML = h;
  tipEl.style.display = 'block';
}
function tipMove(e){
  const r = tipEl.getBoundingClientRect();
  let x = e.clientX + 16, y = e.clientY + 16;
  if(x + r.width > innerWidth - 8) x = e.clientX - r.width - 16;
  if(y + r.height > innerHeight - 8) y = e.clientY - r.height - 16;
  tipEl.style.left = Math.max(8, x) + 'px';
  tipEl.style.top = Math.max(8, y) + 'px';
}
/* 触屏钉住：固定在点按位置附近，显示关闭按钮 */
function tipPin(e, key){
  tipShow(key);
  tipEl.classList.add('pinned');
  tipMove(e);
  tipEl.scrollTop = 0;
}
function tipClose(){
  tipEl.classList.remove('pinned');
  tipEl._key = null;
  tipEl.style.display = 'none';
}
document.getElementById('tipClose').addEventListener('click', tipClose);
/* 钉住模式下点外部关闭（点在其他符号上由 svg click 分支处理切换） */
document.addEventListener('click', e=>{
  if(!tipEl.classList.contains('pinned')) return;
  if(!tipEl.contains(e.target)) tipClose();
});

/* 取消选宫标注：点按盘面内非环区域（外框/中心/环隙）或盘面以外的空白处，
 * 清除高亮与生克箭头、收起判断卡片，回到刚排好盘的状态（盘面与全局格局不动） */
svg.addEventListener('click', e=>{
  if(selectedPalace === null) return;
  if(e.target.closest && e.target.closest('.ring')) return;   /* 环上点按＝选宫/拖环，由环交互处理 */
  clearSelection();
});
document.addEventListener('click', e=>{
  if(selectedPalace === null) return;
  const t = e.target;
  if(!t.closest) return;
  if(t.closest('#compass')) return;                            /* 盘面内由上方 svg 分支处理 */
  if(t.closest('button, a, input, .card, .tip, .picker, .cal-pop')) return;  /* 控件与内容卡片不算空白 */
  clearSelection();
});
svg.addEventListener('mousemove', e=>{
  if(tipEl.classList.contains('pinned')) return;   /* 钉住时不受悬停干扰 */
  if(svg.classList.contains('has-drag')) return;   /* 拖拽排盘时不弹悬停浮层 */
  const t = e.target && e.target.closest ? e.target.closest('text[data-tip]') : null;
  const key = t ? t.getAttribute('data-tip') : null;
  if(key){
    tipCancelHide();
    if(tipEl._key !== key){
      tipEl._key = key;
      tipShow(key);
      tipMove(e);
    } else {
      tipMove(e);
    }
  } else {
    tipScheduleHide();   /* 不在符号上：给鼠标移向浮层的窗口，延迟隐藏 */
  }
});
svg.addEventListener('mouseleave', tipScheduleHide);
/* 浮层可交互（滚动），进入取消隐藏计时、离开重新计时 */
tipEl.addEventListener('mouseenter', tipCancelHide);
tipEl.addEventListener('mouseleave', tipScheduleHide);

/* 延迟隐藏：鼠标在符号与浮层之间移动时不闪断 */
let tipHideTimer = null;
function tipScheduleHide(){
  clearTimeout(tipHideTimer);
  tipHideTimer = setTimeout(()=>{ tipEl._key = null; tipEl.style.display = 'none'; }, 300);
}
function tipCancelHide(){ clearTimeout(tipHideTimer); }

/* 点按位置 → 宫位（中心太极 = 中五寄坤二） */
function palaceFromPoint(e){
  const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(svg.getScreenCTM().inverse());
  const dx = p.x - CX, dy = p.y - CY;
  const r = Math.sqrt(dx*dx + dy*dy);
  const ang = Math.atan2(dx, -dy) * 180/Math.PI;
  const P = Math.floor(((((ang % 360) + 360) % 360) + 22.5) / 45) % 8;
  return (r < 30) ? 1 : P;   /* 中五无门无神，寄坤二参看 */
}

/* 宫位克应（十干克应 / 八门克应 / 吉凶格）：点按盘面触发，不滚动跳转 */
function showJudgment(P){
  selectedPalace = P;
  highlightPalace(P);
  /* 宫间生克：盘面标注 + 汇总卡片（横看铁律：按落宫地盘五行两两相比） */
  const rel = palaceRelations(P);
  renderRelMarks(P, rel);
  const relSpan = (kind) => rel[kind].map(Q=>
    `<span style="color:${REL_STYLE[kind].color};font-weight:500">${PALACE_CN[Q]}（${PALACE_WX[Q]}）${REL_STYLE[kind].label}</span>`).join('、');
  const relParts = ['shengWo','woSheng','keWo','woKe','biHe'].filter(k=>rel[k].length).map(relSpan);
  const relCard = `<div class="jg-card"><div class="jg-head">宫间生克 · ${PALACE_CN[P]}（${PALACE_WX[P]}）横看</div>`
    + `<div class="jg-txt">${relParts.join('；')}</div>`
    + `<div class="jg-sub">横看一律按落宫地盘五行论：生我者助我、我生者泄我、克我者制我、我克者我占上风、比和主客皆利；盘面以色块与箭头同步标注（实线＝相生，虚线＝相克）。</div></div>`;
  const body = document.getElementById('judgeBody');
  const tian = tianGanAt(P), di = elementAtPalace('earth', P);
  const tianMen = elementAtPalace('human', P), diMen = HUMAN[P];
  const star = elementAtPalace('heaven', P), spirit = elementAtPalace('spirit', P);
  const qin = (star === '天芮') ? center5Gan() : '';   /* 天芮夹带天禽寄干 */
  const cards = [];
  const card = (cls, head, txt, sub) => cards.push(
    `<div class="jg-card ${cls}"><div class="jg-head">${head}</div><div class="jg-txt">${txt}</div>${sub?`<div class="jg-sub">${sub}</div>`:''}</div>`);

  /* 断局辅助（依最近一次起局）：星之旺衰（星对宫）、门之旺衰（门对月令）、宫位旬空 */
  let aux = '';
  if(state.lastPaipan){
    const rp = state.lastPaipan;
    const stWx = STAR_WX[star];
    if(stWx) aux += `<br/>星之旺衰：${star}（${stWx}）落${PALACE_CN[P]}（${PALACE_WX[P]}）为${starState(stWx, PALACE_WX[P])}`;
    const mWx = MONTH_ZHI_WX[rp.monthGan[1]];
    aux += `<br/>门之旺衰：${tianMen}（${DOOR_WX[tianMen[0]]}）遇${rp.monthGan[1]}月（${mWx}）为${gateState(DOOR_WX[tianMen[0]], mWx)}`;
    const xunAux = [{name:XUN_NAMES[rp.hourXun], idx:rp.hourXun, kind:'时旬空'}];
    if(rp.dayXun !== rp.hourXun) xunAux.push({name:XUN_NAMES[rp.dayXun], idx:rp.dayXun, kind:'日旬空'});
    judgeXunKong(xunAux)
      .filter(h=>h.P===P)
      .forEach(h=>{
        const source = xunAux.find(x=>x.name===h.xun);
        aux += `<br/>${source.kind}：${h.xun}旬（${h.zhi.join('、')}空）`;
      });
  }
  card('good', `<span class="jg-tag tag-good">${PALACE_CN[P]}</span>${star} · ${tianMen} · ${spirit} · 天盘${tian}${qin?'+禽'+qin:''} 地盘${di}`, '当前叠合：星、门、神与天地盘干。', '点盘观应 · 中五寄坤二' + aux);

  /* 十干克应 */
  const ganKey = tian + di;
  if(GAN_KEY[ganKey]){
    card('', `十干克应 · ${GAN_CN[tian]}加临${GAN_CN[di]}（${tian}加${di}）`, GAN_KEY[ganKey], '据《神奇之门》第一节 十干克应');
  } else {
    card('', `十干克应 · ${tian}加${di}`, '此组合原书未列专条，可参看同天盘干其余克应。');
  }
  /* 天芮夹带天禽寄干：寄干与地盘干的克应一并参看 */
  if(qin){
    const qk = qin + di;
    if(GAN_KEY[qk]){
      card('', `十干克应 · 天禽寄干${GAN_CN[qin]}加临${GAN_CN[di]}（${qin}加${di}）`, GAN_KEY[qk], '中五寄干随天芮同行，同宫参看');
    }
  }

  /* 八门克应：门加门 + 门加干 */
  const mks = [];
  const mk = tianMen[0] + diMen[0];
  if(DOOR_KEY[mk]) mks.push(`【门加门】${tianMen}加${diMen}：${DOOR_KEY[mk]}`);
  const mgk = tianMen[0] + di;
  if(DOOR_KEY[mgk]) mks.push(`【门加干】${tianMen}加${di}：${DOOR_KEY[mgk]}`);
  if(mks.length) card('', `八门克应 · ${tianMen}加临`, mks.join('<br/>'), '据《神奇之门》第二节 八门克应');

  /* 吉凶格 */
  const ges = [];
  if(GOOD_GE[ganKey]) ges.push({k:'吉', t:`${GOOD_GE[ganKey].name}：${GOOD_GE[ganKey].text}`});
  if(BAD_GE[ganKey]) ges.push({k:'凶', t:`${BAD_GE[ganKey].name}：${BAD_GE[ganKey].text}`});
  if(qin){
    const qk = qin + di;
    if(GOOD_GE[qk]) ges.push({k:'吉', t:`${GOOD_GE[qk].name}（寄干${qin}加${di}）：${GOOD_GE[qk].text}`});
    if(BAD_GE[qk]) ges.push({k:'凶', t:`${BAD_GE[qk].name}（寄干${qin}加${di}）：${BAD_GE[qk].text}`});
  }
  if(tian === di){
    if('戊己庚辛壬癸'.indexOf(tian) >= 0) ges.push({k:'凶', t:`值符伏吟：${GAN_CN[tian]}加临本宫，六仪自加。伏吟利主不利客，主迟主慢，不宜主动。`});
    else ges.push({k:'凶', t:`干伏吟：${tian}加${di}，三奇在本宫不动（克应详见十干克应条）。伏吟利主不利客，主迟主慢，不宜主动。`});
  }
  if(GAN_CHONG[tian] === di) ges.push({k:'凶', t:`值符反吟：${tian}加${di}，六仪对冲。反吟主快主反复，利客不利主。`});
  if(GAN_CHONG_FULL[tian] === di) ges.push({k:'凶', t:`天干相冲：${tian}与${di}相冲（${tian}冲${di}）。吉事逢冲不吉，凶事逢冲不凶。`});
  if(tianMen === diMen) ges.push({k:'凶', t:`门伏吟：${tianMen}加${diMen}，八门在本宫不动，主迟主慢。`});
  if(tianMen === HUMAN[(P+4)%8]) ges.push({k:'凶', t:`门反吟：${tianMen}落对冲宫，主快主反复，利客不利主。`});
  if(star === HEAVEN[P]) ges.push({k:'凶', t:`星伏吟：${star}在本宫不动。`});
  if(star === HEAVEN[(P+4)%8]) ges.push({k:'凶', t:`星反吟：${star}落对冲宫。`});
  JIXING.forEach(j=>{ if(j.gan === tian && j.palace === P) ges.push({k:'凶', t:`六仪击刑：天盘${j.gan}落${PALACE_CN[P]}（${j.note}）。一动必有灾伤，极凶。`}); });
  QI_MU.forEach(q=>{ if(q.gan === tian && q.palaces.indexOf(P) >= 0) ges.push({k:'凶', t:`三奇入墓：${q.gan}奇落${PALACE_CN[P]}（${q.note}）。百事不宜，谋事尽休。`}); });
  if((tian==='丙'||tian==='丁') && (P===4 || di==='壬' || di==='癸')) ges.push({k:'凶', t:`三奇受刑：${tian}奇加临坎宫或遇壬癸水，火入水乡受克，不可行动。`});
  if(tian==='乙' && (P===3||P===2 || di==='庚'||di==='辛')) ges.push({k:'凶', t:`三奇受刑：乙奇加临乾兑或遇庚辛金，木入金乡受克，不可行动。`});
  if(WX_KE[DOOR_WX[tianMen[0]]] === PALACE_WX[P]) ges.push({k:'凶', t:`门迫：${tianMen}（${DOOR_WX[tianMen[0]]}）克${PALACE_CN[P]}之${PALACE_WX[P]}。吉门被迫吉不就，凶门被迫祸重重。`});
  if(WX_KE[PALACE_WX[P]] === DOOR_WX[tianMen[0]]) ges.push({k:'凶', t:`门制（宫克门）：${PALACE_CN[P]}之${PALACE_WX[P]}克${tianMen}（${DOOR_WX[tianMen[0]]}），门受制则吉门减吉。`});
  if(WX_SHENG[DOOR_WX[tianMen[0]]] === PALACE_WX[P]) ges.push({k:'吉', t:`门宫和：${tianMen}（${DOOR_WX[tianMen[0]]}）生${PALACE_CN[P]}之${PALACE_WX[P]}，遇吉门凡事皆吉。`});
  if(WX_SHENG[PALACE_WX[P]] === DOOR_WX[tianMen[0]]) ges.push({k:'吉', t:`门宫义：${PALACE_CN[P]}之${PALACE_WX[P]}生${tianMen}（${DOOR_WX[tianMen[0]]}），遇吉门凡事皆吉。`});
  if(QI_LU[tian] && QI_LU[tian][0] === P) ges.push({k:'吉', t:`奇游禄位：${tian}奇到${QI_LU[tian][1]}。合三吉门，宜上官赴任、求财祈福。`});
  if(QI_SHENG[tian] && QI_SHENG[tian][0] === P) ges.push({k:'吉', t:`三奇贵人升殿：${tian}奇临${QI_SHENG[tian][1]}。百事可为。`});
  judgeJiuDun(tian, di, tianMen, spirit, P).forEach(n=> ges.push({k:'吉', t:`${n}：${JIUDUN[n]}`}));
  if(ges.length){
    card('', '吉凶格局', ges.map(g=>`<span class="jg-tag ${g.k==='吉'?'tag-good':'tag-bad'}">${g.k}</span>${g.t}`).join('<br/><br/>'), '常用吉格 / 常用凶格');
  } else {
    card('', '吉凶格局', '该宫未构成常用吉格或凶格，以十干克应、八门克应参断。');
  }

  body.innerHTML = relCard + cards.join('');
  body.classList.remove('empty');
}

/* 全局格局：排盘后随盘面刷新 */
function renderGlobalGeju(r){
  const rootEl = document.getElementById('judgeGlobal');
  const dayGan = r.dayGan[0], hourGan = r.hourGan[0];
  const items = [];
  /* 全部基于排盘结果 r 计算，不读盘面 DOM（避免动画途中取到旧角度） */
  const tianAt = P => r.tianGans[P];            /* 天盘干 */
  const diAt   = P => r.earthShown.shown[P];    /* 地盘干（中五寄坤） */
  const ruiP   = r.qinAt;                       /* 天芮宫（夹带天禽寄干 r.qinGan） */
  const hasGan = (P, g) => tianAt(P) === g || (P === ruiP && r.qinGan === g);
  /* 五不遇时：时干为日干后第七位（序差 6），阳克阳、阴克阴 */
  if(GAN_IDX[hourGan] === (GAN_IDX[dayGan] + 6) % 10){
    items.push({k:'bad', t:`五不遇时：${r.hourGan}时，${hourGan}${GAN_WX[hourGan]}克${dayGan}${GAN_WX[dayGan]}。事多不顺，用事时辰最好避开。`});
  }
  /* 天显时格：六甲透出 */
  if(hourGan === '甲'){
    items.push({k:'good', t:`天显时格（天辅大吉时）：六甲透出之时，虽伏吟不为凶，反为吉。宜行兵、上官、求财、远行。`});
  }
  /* 时干入墓：天盘时干落墓宫。本书凶格(21)明列丙/戊/丁/己/壬/癸六干
   *（丙戌→乾六、丁丑→艮八、戊戌→乾六、己丑→艮八、壬辰→巽四、癸未→坤二）；庚辛墓库说属他家，不取 */
  const muMap = { '丙':3,'戊':3,'丁':5,'己':5,'壬':7,'癸':1 };
  if(muMap[hourGan] === r.shiTianP){
    items.push({k:'bad', t:`时干入墓：${hourGan}时天盘落${PALACE_CN[r.shiTianP]}，正逢其墓。`});
  }
  /* 悖格：天盘丙奇加地盘旬首仪（值符），或天盘旬首仪（值符）加地盘丙 */
  for(let P=0; P<8; P++){
    if(hasGan(P, '丙') && diAt(P) === r.xunYi){
      items.push({k:'bad', t:`悖格：天盘丙奇加地盘值符（${r.xunYi}）于${PALACE_CN[P]}。举事多倒行逆施，纲纪紊乱；得三吉门相会则可用。`});
    } else if(hasGan(P, r.xunYi) && diAt(P) === '丙'){
      items.push({k:'bad', t:`悖格：值符（${r.xunYi}）加地盘丙奇于${PALACE_CN[P]}。举事多倒行逆施，纲纪紊乱；得三吉门相会则可用。`});
    }
  }
  /* 伏干（日格）/飞干/时格 ＋ 悖格日时干分支（纯函数 judgeGengBei，见 JUDGE-ALGO） */
  const dayIsJia = r.dayGan[0] === '甲';
  const dayRef = dayIsJia ? `日干甲（${r.dayYi}）` : `日干${r.dayYi}`;
  const yearRef = r.yearGan[0] === '甲' ? `年干甲（${r.yearKey}）` : `年干${r.yearKey}`;
  const monthRef = r.monthGan[0] === '甲' ? `月干甲（${r.monthKey}）` : `月干${r.monthKey}`;
  judgeGengBei(r).forEach(h=>{
    if(h.ge==='nianGe') items.push({k:'bad', t:`岁格：天盘庚加地盘${yearRef}于${PALACE_CN[h.P]}。用事大凶。${r.monthKey===r.yearKey?'（月干同年干，亦为月格）':''}`});
    else if(h.ge==='yueGe') items.push({k:'bad', t:`月格：天盘庚加地盘${monthRef}于${PALACE_CN[h.P]}。用事大凶。`});
    else if(h.ge==='fuGan') items.push({k:'bad', t:`伏干格（日格）：天盘庚加地盘${dayRef}于${PALACE_CN[h.P]}。主客皆伤，尤不利主。${r.shiGan===r.dayYi?'（日时同干，亦即时格）':''}${r.monthKey===r.dayYi?'（月干同日干，亦为月格）':''}`});
    else if(h.ge==='feiGan') items.push({k:'bad', t:`飞干格：天盘${dayRef}加地盘庚于${PALACE_CN[h.P]}。大凶，主客两伤，皆不利。`});
    else if(h.ge==='shiGe') items.push({k:'bad', t:`时格：天盘庚加地盘时干（${r.shiGan}）于${PALACE_CN[h.P]}。也主凶。${r.monthKey===r.shiGan?'（月干同时干，亦为月格）':''}`});
    else if(h.ge==='beiDay') items.push({k:'bad', t:`悖格：天盘丙奇加地盘${dayRef}于${PALACE_CN[h.P]}。举事多倒行逆施，纲纪紊乱；得三吉门相会则可用。`});
    else if(h.ge==='beiHour') items.push({k:'bad', t:`悖格：天盘丙奇加地盘时干（${r.shiGan}）于${PALACE_CN[h.P]}。举事多倒行逆施，纲纪紊乱；得三吉门相会则可用。`});
  });
  /* 断局辅助：时旬空主看起局时空，日旬空兼看日干/日用神；两旬相同时只报一次。
   * 判词与盘面旬空标记共用 computeKong，口径一致 */
  const kongCalc = computeKong(r);
  const xunList = kongCalc.xunList;
  const kongHits = kongCalc.hits;
  const kongByXun = {};
  kongHits.forEach(h=>{
    const source = xunList.find(x=>x.name===h.xun);
    const group = kongByXun[source.kind] || (kongByXun[source.kind] = {name:h.xun, note:source.note, palaces:[]});
    group.palaces.push(`${PALACE_CN[h.P]}（${h.zhi.join('、')}空）`);
  });
  for(const kind in kongByXun){
    const xun = kongByXun[kind];
    items.push({k:'info', t:`${kind} · ${xun.name}旬：${xun.palaces.join('、')}。${xun.note}；落空之宫宜结合门、星、格局再断，吉象减力、凶象加重。`});
  }
  const maZhi = judgeMaXing(r.hourGan[1]);
  items.push({k:'info', t:`马星：时支${r.hourGan[1]}，马在${maZhi}，临${PALACE_CN[ZHI_PALACE[maZhi]]}。马星主“动”象，可应出行、迁移、车辆、物流、人员往来、消息传递或事情推进；用神、值使或所问之宫临马时，动象更切近。它提示变化与应期，吉凶仍须合看门、星、格局及旺衰。`});
  /* 值符伏吟 / 反吟：按天盘转角判定（旬首仪在中五时亦成立） */
  const hAng = ((r.angles.heaven % 360) + 360) % 360;
  if(hAng === 0)   items.push({k:'bad', t:`值符伏吟：值符${r.xunYi}加临本宫，利主不利客，主迟主慢。`});
  if(hAng === 180) items.push({k:'bad', t:`值符反吟：值符${r.xunYi}加临对冲之宫，主快主反复，利客不利主。`});
  /* 玉女守门：值使门落宫正遇地盘丁奇 */
  let dingLou = 0; for(let i=1;i<=9;i++) if(r.palace[i] === '丁') dingLou = i;
  const dingP = LOU2P[dingLou];
  const zhishiP = LOU2P[r.shiShiLou];
  if(dingLou !== 0 && zhishiP === dingP){
    items.push({k:'good', t:`玉女守门：值使${r.zhishi}落${PALACE_CN[zhishiP]}正遇地盘丁奇。利宴会喜乐、婚姻之事。`});
  }
  /* 三奇得使：值使宫天盘三奇 + 对应地盘仪 */
  const zsTian = tianAt(zhishiP), zsDi = diAt(zhishiP);
  const deShi = (zsTian==='乙' && (zsDi==='己'||zsDi==='辛')) ||
                (zsTian==='丙' && (zsDi==='戊'||zsDi==='庚')) ||
                (zsTian==='丁' && (zsDi==='壬'||zsDi==='癸'));
  if(deShi){
    items.push({k:'good', t:`三奇得使：${zsTian}奇加临值使宫（${PALACE_CN[zhishiP]}）之${zsDi}，得使可用，若无吉门亦有小助。`});
  }
  rootEl.innerHTML = items.map(it=>`<div class="g-item ${it.k}"><span class="g-tag">${it.k==='bad'?'凶':it.k==='good'?'吉':'辅'}</span>${it.t}</div>`).join('');
  rootEl.classList.toggle('empty', items.length === 0);
}

/* 恢复上次起局（如有）：APK 重启后保留最后一盘；旧版本存档缺字段时静默忽略 */
try{
  const saved = localStorage.getItem('qimen.lastJu');
  if(saved){
    const r = JSON.parse(saved);
    if(r && r.angles && r.tianGans && r.earthShown && r.term && r.yearGan) applyPaipan(r);
  }
}catch(err){}
