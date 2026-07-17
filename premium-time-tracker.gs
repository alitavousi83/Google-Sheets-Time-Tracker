/** ═══════════════════════════════════════════════════════════════════════════
 *  ⏱️  PREMIUM TIME TRACKER — automated Google Sheets builder
 *  ───────────────────────────────────────────────────────────────────────────
 *  Builds a complete, fully-automated 5-sheet productivity tracker:
 *    📅 Week 1 … Week 4  — 30-min time grid (Mon–Sun × 48 blocks), dropdowns,
 *                          auto-coloring, daily to-do lists, live statistics,
 *                          8 charts, reflection journal
 *    📊 Monthly Dashboard — KPI cards, auto-aggregated summary, productivity
 *                          score + gauge, 8 charts, monthly reflection
 *
 *  HOW TO INSTALL
 *  1. Open a NEW blank Google Sheet  (sheets.new)
 *  2. Extensions ▸ Apps Script → delete any code there → paste THIS file
 *  3. Click 💾 Save, then select the function  buildTimeTracker  and press ▶ Run
 *  4. Authorize when asked (it only touches this spreadsheet), then wait
 *     ~60–90 seconds while it builds. Done!
 *
 *  A custom menu  "⏱️ Time Tracker"  also appears after you reload the sheet:
 *    🔄 Build / Rebuild   🧹 Clear time entries   🧹 Clear to-dos
 *
 *  CUSTOMIZING
 *  • Score goals (programming/exercise/… targets) live on the hidden
 *    "⚙️ Config" sheet — right-click any tab ▸ show sheet ▸ edit values.
 *  • To change activities or colors, edit ACTIVITIES below and re-run
 *    buildTimeTracker (rebuild wipes entered data — export first!).
 *  ═══════════════════════════════════════════════════════════════════════════ */

const ACTIVITIES = [
  { name: 'Sleep',          emoji: '😴', color: '#4285F4', text: '#FFFFFF' },
  { name: 'Programming',    emoji: '💻', color: '#34A853', text: '#FFFFFF' },
  { name: 'Exercise',       emoji: '🏋️', color: '#FF8F00', text: '#FFFFFF' },
  { name: 'Meditation',     emoji: '🧘', color: '#9C27B0', text: '#FFFFFF' },
  { name: 'Personal Tasks', emoji: '📋', color: '#FBBC04', text: '#5F4B00' },
  { name: 'Wasted Time',    emoji: '⌛', color: '#EA4335', text: '#FFFFFF' },
];

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const THEME = {
  bg: '#F4F6FB',        banner: '#141E3C',    nav: '#1E2A52',
  section: '#1F2A44',   sectionText: '#FFFFFF',
  subHead: '#E8ECF7',   subHeadText: '#1F2A44',
  border: '#C9D4E5',    muted: '#64748B',     totalRow: '#EEF2FF',
  font: 'Poppins',
  weekday: { bg: '#EEF2FF', fg: '#3730A3' },
  weekend: { bg: '#FFF1F2', fg: '#BE123C' },
};

const WEEK_TABS = ['#4285F4', '#34A853', '#FF8F00', '#9C27B0'];

// time-of-day color bands for the hour header (night / morning / afternoon / evening)
const HOUR_BANDS = [
  { from: 0,  to: 5,  bg: '#1E2A4A', fg: '#C7D2FE' },
  { from: 6,  to: 11, bg: '#FFF3D6', fg: '#8A6D1D' },
  { from: 12, to: 17, bg: '#DDEBFF', fg: '#2B5CAB' },
  { from: 18, to: 23, bg: '#EDE4FB', fg: '#5E3B96' },
];

const DASH_NAME = '📊 Monthly Dashboard';
const CFG_NAME  = '⚙️ Config';
const NAMED = ['ACTIVITIES', 'GOAL_PROG', 'GOAL_EXERCISE', 'GOAL_MEDITATION',
               'GOAL_PERSONAL', 'IDEAL_SLEEP', 'WASTED_LIMIT',
               'WEEK1_GRID', 'WEEK2_GRID', 'WEEK3_GRID', 'WEEK4_GRID'];

/* ══════════════════════════ MENU ══════════════════════════ */

function onOpen() {
  SpreadsheetApp.getUi().createMenu('⏱️ Time Tracker')
    .addItem('🔄 Build / Rebuild tracker', 'buildTimeTracker')
    .addSeparator()
    .addItem('🧹 Clear all time entries', 'clearTimeEntries')
    .addItem('🧹 Clear all to-dos', 'clearTodos')
    .addToUi();
}

/* ══════════════════════════ MAIN BUILD ══════════════════════════ */

function buildTimeTracker() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const stale = ss.getSheetByName('⏳ building…');
  if (stale) ss.deleteSheet(stale);
  const temp = ss.insertSheet('⏳ building…');

  // remove previous versions of our sheets + named ranges
  ['Week 1', 'Week 2', 'Week 3', 'Week 4', DASH_NAME, CFG_NAME].forEach(n => {
    const s = ss.getSheetByName(n);
    if (s) ss.deleteSheet(s);
  });
  ss.getNamedRanges().forEach(nr => { if (NAMED.indexOf(nr.getName()) !== -1) nr.remove(); });

  const cfg = buildConfigSheet(ss);

  const weeks = [];
  for (let w = 1; w <= 4; w++) weeks.push(buildWeekSheet(ss, cfg, w));
  const dash = buildDashboardSheet(ss);

  // named ranges used by the dashboard's cross-sheet formulas
  weeks.forEach((sh, i) => ss.setNamedRange('WEEK' + (i + 1) + '_GRID', sh.getRange('C6:AX12')));

  addNavBars(ss, weeks, dash);

  // drop the scaffolding
  ss.deleteSheet(temp);
  const s1 = ss.getSheetByName('Sheet1');
  if (s1 && s1.getLastRow() === 0 && s1.getLastColumn() === 0) ss.deleteSheet(s1);

  ss.setActiveSheet(weeks[0]);
  weeks[0].setActiveSelection('C6');
  SpreadsheetApp.flush();
}

/* ══════════════════════════ CONFIG SHEET ══════════════════════════ */

function buildConfigSheet(ss) {
  const sh = ss.insertSheet(CFG_NAME);
  sh.setTabColor('#9AA4B8');

  sh.getRange('A1:B1').setValues([['Activity', 'Color']]).setFontWeight('bold');
  ACTIVITIES.forEach((a, i) => {
    sh.getRange(2 + i, 1).setValue(a.name);
    sh.getRange(2 + i, 2).setValue(a.color).setBackground(a.color).setFontColor(a.text);
  });

  sh.getRange('D1').setValue('Productivity-score goals (editable)').setFontWeight('bold');
  const goals = [
    ['Monthly programming goal (hours)',    80, 'GOAL_PROG'],
    ['Monthly exercise goal (hours)',       20, 'GOAL_EXERCISE'],
    ['Monthly meditation goal (hours)',     12, 'GOAL_MEDITATION'],
    ['Monthly personal-tasks goal (hours)', 40, 'GOAL_PERSONAL'],
    ['Ideal sleep per day (hours)',          8, 'IDEAL_SLEEP'],
    ['Wasted-time limit per month (hours)', 40, 'WASTED_LIMIT'],
  ];
  goals.forEach((g, i) => {
    sh.getRange(2 + i, 4).setValue(g[0]);
    sh.getRange(2 + i, 5).setValue(g[1]).setFontWeight('bold');
    ss.setNamedRange(g[2], sh.getRange(2 + i, 5));
  });
  ss.setNamedRange('ACTIVITIES', sh.getRange('A2:A' + (1 + ACTIVITIES.length)));

  sh.setColumnWidth(4, 260);
  sh.hideSheet();
  return sh;
}

/* ══════════════════════════ WEEKLY SHEET ══════════════════════════ */

function buildWeekSheet(ss, cfg, w) {
  const sh = ss.insertSheet('Week ' + w);
  sh.setTabColor(WEEK_TABS[w - 1]);

  // ---- canvas size: 130 rows × 64 cols ----
  if (sh.getMaxColumns() < 64) sh.insertColumnsAfter(sh.getMaxColumns(), 64 - sh.getMaxColumns());
  if (sh.getMaxColumns() > 64) sh.deleteColumns(65, sh.getMaxColumns() - 64);
  if (sh.getMaxRows() > 130) sh.deleteRows(131, sh.getMaxRows() - 130);
  if (sh.getMaxRows() < 130) sh.insertRowsAfter(sh.getMaxRows(), 130 - sh.getMaxRows());

  sh.setHiddenGridlines(true);
  sh.getRange(1, 1, 130, 64).setBackground(THEME.bg)
    .setFontFamily(THEME.font).setFontColor('#1F2937').setFontSize(10);

  // ---- column widths ----
  sh.setColumnWidth(1, 16);            // A spacer
  sh.setColumnWidth(2, 112);           // B day names
  sh.setColumnWidths(3, 48, 30);       // C..AX  48 half-hour blocks
  sh.setColumnWidth(51, 22);           // AY spacer
  sh.setColumnWidth(52, 44);           // AZ checkbox
  sh.setColumnWidth(53, 230);          // BA task
  sh.setColumnWidth(54, 250);          // BB notes
  sh.setColumnWidth(55, 20);           // BC spacer
  sh.setColumnWidth(56, 96);           // BD day (breakdown)
  sh.setColumnWidths(57, 6, 100);      // BE..BJ activities
  sh.setColumnWidth(63, 80);           // BK total
  sh.setColumnWidth(64, 16);           // BL spacer

  // ---- row heights ----
  sh.setRowHeight(1, 50); sh.setRowHeight(2, 28); sh.setRowHeight(3, 30);
  sh.setRowHeight(4, 26); sh.setRowHeight(5, 22);
  sh.setRowHeights(6, 7, 34);
  sh.setRowHeight(13, 24); sh.setRowHeight(14, 28); sh.setRowHeight(15, 24);

  // ---- banner ----
  sh.getRange(1, 2, 1, 49).merge().setValue('⏱️  WEEK ' + w + ' — TIME TRACKER')
    .setBackground(THEME.banner).setFontColor('#FFFFFF').setFontWeight('bold')
    .setFontSize(16).setVerticalAlignment('middle');
  sh.getRange(1, 52, 1, 12).merge().setValue('✨ Plan · Track · Improve')
    .setBackground(THEME.banner).setFontColor('#8EA2E8').setFontStyle('italic')
    .setHorizontalAlignment('center').setVerticalAlignment('middle');

  // nav bar background (sheet links are filled in by addNavBars at the end)
  sh.getRange(2, 2, 1, 49).merge().setBackground(THEME.nav).setVerticalAlignment('middle');
  sh.getRange(2, 52, 1, 12).merge().setValue('Every colored block = 30 minutes')
    .setBackground(THEME.nav).setFontColor('#93A5D1').setFontStyle('italic')
    .setFontSize(9).setHorizontalAlignment('center').setVerticalAlignment('middle');

  /* ─────────── 1. TIME GRID  (rows 4–12, cols C–AX) ─────────── */

  sh.getRange(4, 2, 2, 1).merge().setValue('📅 Day')
    .setBackground(THEME.section).setFontColor('#FFFFFF').setFontWeight('bold')
    .setHorizontalAlignment('center').setVerticalAlignment('middle');

  // hour header: 24 merged pairs, colored by time of day
  for (let h = 0; h < 24; h++) {
    const band = HOUR_BANDS.filter(b => h >= b.from && h <= b.to)[0];
    sh.getRange(4, 3 + h * 2, 1, 2).merge()
      .setValue(('0' + h).slice(-2))
      .setBackground(band.bg).setFontColor(band.fg).setFontWeight('bold')
      .setFontSize(9).setHorizontalAlignment('center').setVerticalAlignment('middle');
  }
  // :00 / :30 sub-header
  const halfLabels = [[]];
  for (let h = 0; h < 24; h++) { halfLabels[0].push('00'); halfLabels[0].push('30'); }
  sh.getRange(5, 3, 1, 48).setValues(halfLabels)
    .setBackground('#FFFFFF').setFontColor(THEME.muted).setFontSize(7)
    .setHorizontalAlignment('center');

  // day labels
  DAYS.forEach((d, i) => {
    const c = i >= 5 ? THEME.weekend : THEME.weekday;
    sh.getRange(6 + i, 2).setValue(d).setBackground(c.bg).setFontColor(c.fg)
      .setFontWeight('bold').setHorizontalAlignment('center').setVerticalAlignment('middle');
  });

  // the 336 half-hour cells: white, centered, dropdown-validated
  const grid = sh.getRange(6, 3, 7, 48);
  grid.setBackground('#FFFFFF').setFontSize(9)
    .setHorizontalAlignment('center').setVerticalAlignment('middle')
    .setWrapStrategy(SpreadsheetApp.WrapStrategy.CLIP);
  grid.setDataValidation(
    SpreadsheetApp.newDataValidation()
      .requireValueInRange(cfg.getRange('A2:A' + (1 + ACTIVITIES.length)), true)
      .setAllowInvalid(false)
      .setHelpText('Pick an activity — each block is 30 minutes.')
      .build());
  sh.getRange(4, 2, 9, 49).setBorder(true, true, true, true, true, true,
    THEME.border, SpreadsheetApp.BorderStyle.SOLID);
  sh.getRange(6, 3).setNote('⏱️ Click any cell and pick an activity from the dropdown.\nEach cell = 30 minutes. Colors apply automatically.');

  // legend chips (row 14)
  sh.getRange(14, 2).setValue('🎨 Legend').setFontWeight('bold')
    .setFontColor(THEME.muted).setFontSize(9).setVerticalAlignment('middle');
  ACTIVITIES.forEach((a, i) => {
    sh.getRange(14, 3 + i * 8, 1, 6).merge()
      .setValue(a.emoji + ' ' + a.name)
      .setBackground(a.color).setFontColor(a.text).setFontWeight('bold')
      .setFontSize(9).setHorizontalAlignment('center').setVerticalAlignment('middle');
  });

  /* ─────────── 2. WEEKLY STATISTICS & SUMMARY  (rows 16–25) ─────────── */

  sectionBar(sh, 16, 2, 18, '📊 Weekly Statistics & Summary  (auto-calculated)');

  const headSpans = [[2, 4, 'Activity'], [6, 3, 'Total Hours'], [9, 3, '% of Week'], [12, 7, 'Distribution']];
  headSpans.forEach(hs => {
    sh.getRange(17, hs[0], 1, hs[1]).merge().setValue(hs[2])
      .setBackground(THEME.subHead).setFontColor(THEME.subHeadText).setFontWeight('bold')
      .setHorizontalAlignment('center').setVerticalAlignment('middle');
  });

  ACTIVITIES.forEach((a, i) => {
    const r = 18 + i;
    sh.setRowHeight(r, 26);
    sh.getRange(r, 2, 1, 4).merge().setValue(a.emoji + ' ' + a.name)
      .setBackground('#FFFFFF').setFontWeight('bold').setVerticalAlignment('middle');
    sh.getRange(r, 6, 1, 3).merge()
      .setFormula('=COUNTIF($C$6:$AX$12,"' + a.name + '")*0.5')
      .setNumberFormat('0.0').setBackground('#FFFFFF').setFontWeight('bold')
      .setHorizontalAlignment('center').setVerticalAlignment('middle');
    sh.getRange(r, 9, 1, 3).merge().setFormula('=$F$' + r + '/168')
      .setNumberFormat('0.0%').setBackground('#FFFFFF').setFontColor(THEME.muted)
      .setHorizontalAlignment('center').setVerticalAlignment('middle');
    sh.getRange(r, 12, 1, 7).merge()
      .setFormula('=IFERROR(SPARKLINE($F$' + r + ',{"charttype","bar";"max",MAX($F$18:$F$23)+0.0001;"color1","' + a.color + '"}),"")')
      .setBackground('#FFFFFF').setVerticalAlignment('middle');
  });
  // totals
  sh.setRowHeight(24, 26); sh.setRowHeight(25, 24);
  sh.getRange(24, 2, 1, 4).merge().setValue('Σ Total Tracked').setFontWeight('bold')
    .setBackground(THEME.totalRow).setVerticalAlignment('middle');
  sh.getRange(24, 6, 1, 3).merge().setFormula('=SUM($F$18:$F$23)').setNumberFormat('0.0')
    .setFontWeight('bold').setBackground(THEME.totalRow).setHorizontalAlignment('center').setVerticalAlignment('middle');
  sh.getRange(24, 9, 1, 3).merge().setFormula('=$F$24/168').setNumberFormat('0.0%')
    .setFontWeight('bold').setBackground(THEME.totalRow).setHorizontalAlignment('center').setVerticalAlignment('middle');
  sh.getRange(24, 12, 1, 7).merge().setBackground(THEME.totalRow);
  sh.getRange(25, 2, 1, 4).merge().setValue('⬜ Untracked').setFontColor(THEME.muted)
    .setBackground('#FFFFFF').setVerticalAlignment('middle');
  sh.getRange(25, 6, 1, 3).merge().setFormula('=168-$F$24').setNumberFormat('0.0')
    .setFontColor(THEME.muted).setBackground('#FFFFFF').setHorizontalAlignment('center').setVerticalAlignment('middle');
  sh.getRange(25, 9, 1, 3).merge().setFormula('=$F$25/168').setNumberFormat('0.0%')
    .setFontColor(THEME.muted).setBackground('#FFFFFF').setHorizontalAlignment('center').setVerticalAlignment('middle');
  sh.getRange(25, 12, 1, 7).merge().setBackground('#FFFFFF');
  sh.getRange(17, 2, 9, 17).setBorder(true, true, true, true, true, true,
    THEME.border, SpreadsheetApp.BorderStyle.SOLID);

  /* ─────────── 3. WEEKLY REFLECTION  (rows 27–52) ─────────── */

  sectionBar(sh, 27, 2, 18, '🧠 Weekly Reflection');
  const reflections = [
    ['🏆 Wins This Week', 'What went well?'],
    ['⚔️ Challenges', 'What problems did I face?'],
    ['💡 Lessons Learned', 'What did I learn?'],
    ['🚀 Improvements for Next Week', 'What should I improve?'],
    ['📝 Personal Notes', 'Free writing space'],
  ];
  reflections.forEach((sec, i) => {
    const r = 29 + i * 5;
    sh.getRange(r, 2, 1, 17).merge().setValue(sec[0] + '  ·  ' + sec[1])
      .setBackground(THEME.subHead).setFontColor(THEME.subHeadText)
      .setFontWeight('bold').setVerticalAlignment('middle');
    sh.getRange(r + 1, 2, 3, 17).merge().setBackground('#FFFFFF')
      .setWrapStrategy(SpreadsheetApp.WrapStrategy.WRAP)
      .setVerticalAlignment('top').setHorizontalAlignment('left')
      .setBorder(true, true, true, true, false, false, THEME.border, SpreadsheetApp.BorderStyle.SOLID)
      .setNote('✍️ Write here');
  });

  /* ─────────── 4. DAILY TO-DO LIST  (right zone, AZ–BB) ─────────── */

  sh.getRange(3, 52, 1, 3).merge().setValue('✅ Daily To-Do List')
    .setBackground(THEME.section).setFontColor('#FFFFFF').setFontWeight('bold')
    .setFontSize(11).setVerticalAlignment('middle');

  DAYS.forEach((d, i) => {
    const hr = 4 + i * 5;                       // day header row
    const c = i >= 5 ? THEME.weekend : THEME.weekday;
    sh.getRange(hr, 52, 1, 3).merge().setValue('📅 ' + d)
      .setBackground(c.bg).setFontColor(c.fg).setFontWeight('bold').setVerticalAlignment('middle');
    sh.getRange(hr + 1, 52, 4, 3).setBackground('#FFFFFF')
      .setWrapStrategy(SpreadsheetApp.WrapStrategy.CLIP).setVerticalAlignment('middle');
    sh.getRange(hr + 1, 52, 4, 1).insertCheckboxes().setHorizontalAlignment('center');
  });
  sh.getRange(4, 52, 35, 3).setBorder(true, true, true, true, true, true,
    THEME.border, SpreadsheetApp.BorderStyle.SOLID);
  sh.getRange(5, 53).setNote('Type a task here; the ✓ box grays it out automatically.\nColumn to the right = optional notes.');

  /* ─────────── 5. DAILY BREAKDOWN (chart feed, BD–BK) ─────────── */

  sh.getRange(3, 56, 1, 8).merge().setValue('📅 Daily Breakdown — hours per activity (auto)')
    .setBackground(THEME.section).setFontColor('#FFFFFF').setFontWeight('bold')
    .setFontSize(11).setVerticalAlignment('middle');

  const bh = [['Day'].concat(ACTIVITIES.map(a => a.emoji + ' ' + a.name)).concat(['Σ Total'])];
  sh.getRange(4, 56, 1, 8).setValues(bh)
    .setBackground(THEME.subHead).setFontColor(THEME.subHeadText).setFontWeight('bold')
    .setFontSize(9).setHorizontalAlignment('center').setVerticalAlignment('middle')
    .setWrapStrategy(SpreadsheetApp.WrapStrategy.WRAP);

  DAYS.forEach((d, i) => {
    const r = 5 + i, gr = 6 + i;                // breakdown row, grid row
    const c = i >= 5 ? THEME.weekend : THEME.weekday;
    sh.getRange(r, 56).setValue(d).setBackground(c.bg).setFontColor(c.fg).setFontWeight('bold');
    ACTIVITIES.forEach((a, j) => {
      sh.getRange(r, 57 + j)
        .setFormula('=COUNTIF($C$' + gr + ':$AX$' + gr + ',"' + a.name + '")*0.5')
        .setNumberFormat('0.0').setBackground('#FFFFFF').setHorizontalAlignment('center');
    });
    sh.getRange(r, 63).setFormula('=SUM(BE' + r + ':BJ' + r + ')')
      .setNumberFormat('0.0').setFontWeight('bold').setBackground('#FFFFFF').setHorizontalAlignment('center');
  });
  sh.getRange(12, 56).setValue('Σ Week').setFontWeight('bold').setBackground(THEME.totalRow);
  for (let j = 0; j < 7; j++) {
    const col = 57 + j, letter = colA1(col);
    sh.getRange(12, col).setFormula('=SUM(' + letter + '5:' + letter + '11)')
      .setNumberFormat('0.0').setFontWeight('bold').setBackground(THEME.totalRow).setHorizontalAlignment('center');
  }
  sh.getRange(4, 56, 9, 8).setBorder(true, true, true, true, true, true,
    THEME.border, SpreadsheetApp.BorderStyle.SOLID);

  /* ─────────── CONDITIONAL FORMATTING ─────────── */

  const rules = [];
  ACTIVITIES.forEach(a => {
    rules.push(SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo(a.name)
      .setBackground(a.color).setFontColor(a.text).setBold(true)
      .setRanges([grid]).build());
  });
  // completed to-dos → gray + strikethrough
  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=$AZ4=TRUE')
    .setStrikethrough(true).setFontColor('#94A3B8').setBackground('#F1F5F9')
    .setRanges([sh.getRange(4, 52, 35, 3)]).build());
  sh.setConditionalFormatRules(rules);

  /* ─────────── FREEZE + CHARTS ─────────── */

  // freeze the header rows only — the banner/stats merges span column B,
  // so a column freeze through them is rejected by Sheets
  sh.setFrozenRows(5);

  const dayCat = 'BD4:BD11';
  addCharts(sh, [
    { title: '💻 Daily Programming Hours',  ranges: [dayCat, 'BF4:BF11'], type: 'column', colors: ['#34A853'], row: 55,  col: 2,  vTitle: 'Hours' },
    { title: '😴 Daily Sleep Hours',        ranges: [dayCat, 'BE4:BE11'], type: 'column', colors: ['#4285F4'], row: 55,  col: 20, vTitle: 'Hours' },
    { title: '🏋️ Daily Exercise Hours',     ranges: [dayCat, 'BG4:BG11'], type: 'column', colors: ['#FF8F00'], row: 71,  col: 2,  vTitle: 'Hours' },
    { title: '🧘 Daily Meditation Hours',   ranges: [dayCat, 'BH4:BH11'], type: 'column', colors: ['#9C27B0'], row: 71,  col: 20, vTitle: 'Hours' },
    { title: '📋 Daily Personal Tasks Hours', ranges: [dayCat, 'BI4:BI11'], type: 'column', colors: ['#FBBC04'], row: 87, col: 2,  vTitle: 'Hours' },
    { title: '⌛ Daily Wasted Time Hours',  ranges: [dayCat, 'BJ4:BJ11'], type: 'column', colors: ['#EA4335'], row: 87,  col: 20, vTitle: 'Hours' },
    { title: '🥧 Weekly Activity Distribution', ranges: ['B18:B23', 'F18:F23'], type: 'pie', headers: 0,
      colors: ACTIVITIES.map(a => a.color), row: 103, col: 2, legend: 'right' },
    { title: '📈 Weekly Productivity Trend — how each day was spent', ranges: ['BD4:BJ11'], type: 'column',
      stacked: true, colors: ACTIVITIES.map(a => a.color), row: 103, col: 20, legend: 'bottom', vTitle: 'Hours' },
  ]);

  return sh;
}

/* ══════════════════════════ MONTHLY DASHBOARD ══════════════════════════ */

function buildDashboardSheet(ss) {
  const sh = ss.insertSheet(DASH_NAME);
  sh.setTabColor('#4F46E5');

  // canvas: 152 rows × 21 cols
  if (sh.getMaxColumns() > 21) sh.deleteColumns(22, sh.getMaxColumns() - 21);
  if (sh.getMaxRows() > 152) sh.deleteRows(153, sh.getMaxRows() - 152);
  if (sh.getMaxRows() < 152) sh.insertRowsAfter(sh.getMaxRows(), 152 - sh.getMaxRows());

  sh.setHiddenGridlines(true);
  sh.getRange(1, 1, 152, 21).setBackground(THEME.bg)
    .setFontFamily(THEME.font).setFontColor('#1F2937').setFontSize(10);

  sh.setColumnWidth(1, 16);
  sh.setColumnWidth(2, 120);
  sh.setColumnWidths(3, 18, 85);   // C..T
  sh.setColumnWidth(21, 16);

  [[1, 52], [2, 28], [3, 12], [4, 24], [5, 44], [6, 14], [7, 12],
   [8, 24], [9, 44], [10, 14], [11, 14]].forEach(rh => sh.setRowHeight(rh[0], rh[1]));

  // ---- banner + nav ----
  sh.getRange(1, 2, 1, 19).merge().setValue('📊  MONTHLY DASHBOARD & ANALYSIS')
    .setBackground(THEME.banner).setFontColor('#FFFFFF').setFontWeight('bold')
    .setFontSize(16).setVerticalAlignment('middle');
  sh.getRange(2, 2, 1, 19).merge().setBackground(THEME.nav).setVerticalAlignment('middle');

  /* ─────────── KPI CARDS (rows 4–10) ─────────── */

  const cards = [
    { label: '💻 Programming',    f: '=$G$16', fmt: '0.0" h"', bg: '#34A853', fg: '#FFFFFF' },
    { label: '😴 Sleep',          f: '=$G$15', fmt: '0.0" h"', bg: '#4285F4', fg: '#FFFFFF' },
    { label: '🏋️ Exercise',       f: '=$G$17', fmt: '0.0" h"', bg: '#FF8F00', fg: '#FFFFFF' },
    { label: '🧘 Meditation',     f: '=$G$18', fmt: '0.0" h"', bg: '#9C27B0', fg: '#FFFFFF' },
    { label: '📋 Personal Tasks', f: '=$G$19', fmt: '0.0" h"', bg: '#FBBC04', fg: '#5F4B00' },
    { label: '⌛ Wasted Time',    f: '=$G$20', fmt: '0.0" h"', bg: '#EA4335', fg: '#FFFFFF' },
    { label: '🏆 Productivity Score', f: '=$H$31', fmt: '0" / 100"', bg: '#4F46E5', fg: '#FFFFFF' },
    { label: '⚡ Avg Productive / Day', f: '=$E$32', fmt: '0.00" h"', bg: '#0D9488', fg: '#FFFFFF' },
  ];
  const cardCols = [2, 6, 10, 14];   // B, F, J, N — each card spans 3 columns
  cards.forEach((c, i) => {
    const row = i < 4 ? 4 : 8;
    const col = cardCols[i % 4];
    sh.getRange(row, col, 1, 3).merge().setValue(c.label)
      .setBackground(c.bg).setFontColor(c.fg).setFontSize(10).setFontWeight('bold')
      .setHorizontalAlignment('center').setVerticalAlignment('middle');
    sh.getRange(row + 1, col, 2, 3).merge().setFormula(c.f).setNumberFormat(c.fmt)
      .setBackground(c.bg).setFontColor(c.fg).setFontSize(20).setFontWeight('bold')
      .setHorizontalAlignment('center').setVerticalAlignment('middle');
  });

  /* ─────────── MONTHLY SUMMARY BY ACTIVITY (rows 13–21) ─────────── */

  sectionBar(sh, 13, 2, 10, '📊 Monthly Summary by Activity  (auto-collected from Weeks 1–4)');

  sh.getRange(14, 2, 1, 7)
    .setValues([['Activity', 'Week 1', 'Week 2', 'Week 3', 'Week 4', 'Σ Total', '% of Month']]);
  sh.getRange(14, 9, 1, 2).merge().setValue('Trend');
  sh.getRange(14, 2, 1, 9)
    .setBackground(THEME.subHead).setFontColor(THEME.subHeadText).setFontWeight('bold')
    .setHorizontalAlignment('center').setVerticalAlignment('middle')
    .setWrapStrategy(SpreadsheetApp.WrapStrategy.WRAP);

  ACTIVITIES.forEach((a, i) => {
    const r = 15 + i;
    sh.setRowHeight(r, 26);
    sh.getRange(r, 2).setValue(a.emoji + ' ' + a.name).setFontWeight('bold').setBackground('#FFFFFF');
    for (let wk = 1; wk <= 4; wk++) {
      sh.getRange(r, 2 + wk)
        .setFormula('=COUNTIF(WEEK' + wk + '_GRID,"' + a.name + '")*0.5')
        .setNumberFormat('0.0').setBackground('#FFFFFF').setHorizontalAlignment('center');
    }
    sh.getRange(r, 7).setFormula('=SUM(C' + r + ':F' + r + ')').setNumberFormat('0.0')
      .setFontWeight('bold').setBackground('#FFFFFF').setHorizontalAlignment('center');
    sh.getRange(r, 8).setFormula('=$G$' + r + '/672').setNumberFormat('0.0%')
      .setFontColor(THEME.muted).setBackground('#FFFFFF').setHorizontalAlignment('center');
    sh.getRange(r, 9, 1, 2).merge()
      .setFormula('=IFERROR(SPARKLINE(C' + r + ':F' + r + ',{"charttype","line";"linewidth",2;"color","' + a.color + '"}),"")')
      .setBackground('#FFFFFF');
  });
  sh.setRowHeight(21, 26);
  sh.getRange(21, 2).setValue('Σ Total Tracked').setFontWeight('bold').setBackground(THEME.totalRow);
  for (let c = 3; c <= 7; c++) {
    const L = colA1(c);
    sh.getRange(21, c).setFormula('=SUM(' + L + '15:' + L + '20)').setNumberFormat('0.0')
      .setFontWeight('bold').setBackground(THEME.totalRow).setHorizontalAlignment('center');
  }
  sh.getRange(21, 8).setFormula('=$G$21/672').setNumberFormat('0.0%')
    .setFontWeight('bold').setBackground(THEME.totalRow).setHorizontalAlignment('center');
  sh.getRange(21, 9, 1, 2).merge().setBackground(THEME.totalRow);
  sh.getRange(14, 2, 8, 9).setBorder(true, true, true, true, true, true,
    THEME.border, SpreadsheetApp.BorderStyle.SOLID);

  /* ─────────── WEEKLY TOTALS — transposed chart feed (rows 23–28) ─────────── */

  sectionBar(sh, 23, 2, 8, '📅 Weekly Totals by Activity  (auto — feeds the trend charts)');
  sh.getRange(24, 2, 1, 7)
    .setValues([['Week'].concat(ACTIVITIES.map(a => a.emoji + ' ' + a.name))])
    .setBackground(THEME.subHead).setFontColor(THEME.subHeadText).setFontWeight('bold')
    .setFontSize(9).setHorizontalAlignment('center').setVerticalAlignment('middle')
    .setWrapStrategy(SpreadsheetApp.WrapStrategy.WRAP);
  for (let wk = 1; wk <= 4; wk++) {
    const r = 24 + wk;
    sh.getRange(r, 2).setValue('Week ' + wk).setFontWeight('bold').setBackground('#FFFFFF');
    ACTIVITIES.forEach((a, j) => {
      // pulls from the summary table above: activity row 15+j, week column C..F
      sh.getRange(r, 3 + j).setFormula('=' + colA1(2 + wk) + (15 + j))
        .setNumberFormat('0.0').setBackground('#FFFFFF').setHorizontalAlignment('center');
    });
  }
  sh.getRange(24, 2, 5, 7).setBorder(true, true, true, true, true, true,
    THEME.border, SpreadsheetApp.BorderStyle.SOLID);

  /* ─────────── KEY METRICS + PRODUCTIVITY SCORE (rows 30–37) ─────────── */

  sectionBar(sh, 30, 2, 6, '📌 Key Metrics');
  const metrics = [
    ['⏱️ Total Tracked Hours',            '=$G$21',                        '0.0" h"'],
    ['⚡ Avg Productive Hours / Day',      '=($G$16+$G$17+$G$18+$G$19)/28', '0.00" h"'],
    ['😴 Avg Sleep / Day',                 '=$G$15/28',                     '0.00" h"'],
    ['💻 Programming % (of tracked)',      '=IFERROR($G$16/$G$21,0)',       '0.0%'],
    ['🏋️ Exercise % (of tracked)',         '=IFERROR($G$17/$G$21,0)',       '0.0%'],
    ['🧘 Meditation % (of tracked)',       '=IFERROR($G$18/$G$21,0)',       '0.0%'],
    ['⌛ Wasted Time % (of tracked)',      '=IFERROR($G$20/$G$21,0)',       '0.0%'],
  ];
  metrics.forEach((m, i) => {
    const r = 31 + i;
    sh.setRowHeight(r, 25);
    sh.getRange(r, 2, 1, 3).merge().setValue(m[0]).setBackground('#FFFFFF').setVerticalAlignment('middle');
    sh.getRange(r, 5, 1, 2).merge().setFormula(m[1]).setNumberFormat(m[2])
      .setFontWeight('bold').setBackground('#FFFFFF')
      .setHorizontalAlignment('center').setVerticalAlignment('middle');
  });
  sh.getRange(31, 2, 7, 5).setBorder(true, true, true, true, true, true,
    THEME.border, SpreadsheetApp.BorderStyle.SOLID);

  sectionBar(sh, 30, 8, 13, '🏆 Productivity Score');
  sh.getRange(31, 8, 3, 3).merge()
    .setFormula(
      '=ROUND(MAX(0,' +
      ' MIN(1,$G$16/GOAL_PROG)*35' +
      ' + MIN(1,$G$17/GOAL_EXERCISE)*15' +
      ' + MIN(1,$G$18/GOAL_MEDITATION)*10' +
      ' + MIN(1,$G$19/GOAL_PERSONAL)*10' +
      ' + MAX(0,1-ABS($G$15/28-IDEAL_SLEEP)/4)*30' +
      ' - MIN(1,$G$20/WASTED_LIMIT)*25),0)')
    .setNumberFormat('0')
    .setBackground('#4F46E5').setFontColor('#FFFFFF').setFontSize(30).setFontWeight('bold')
    .setHorizontalAlignment('center').setVerticalAlignment('middle')
    .setNote('Score out of 100:\n' +
      '• Programming vs goal → 35 pts\n• Exercise vs goal → 15 pts\n' +
      '• Meditation vs goal → 10 pts\n• Personal tasks vs goal → 10 pts\n' +
      '• Healthy sleep (near ideal/day) → 30 pts\n• Wasted time → up to −25 pts\n\n' +
      'Goals are editable on the hidden "⚙️ Config" sheet\n(right-click a tab ▸ Show sheet).');
  sh.getRange(31, 11, 1, 3).merge()
    .setFormula('=IFERROR(SPARKLINE($H$31,{"charttype","bar";"max",100;"color1","#22C55E"}),"")')
    .setBackground('#FFFFFF').setVerticalAlignment('middle');
  sh.getRange(32, 11, 1, 3).merge().setValue('out of 100').setFontColor(THEME.muted)
    .setFontSize(9).setBackground('#FFFFFF').setHorizontalAlignment('center').setVerticalAlignment('middle');
  sh.getRange(33, 11, 1, 3).merge()
    .setFormula('=IFS($H$31>=85,"🌟 Outstanding",$H$31>=70,"💪 Strong",$H$31>=50,"🙂 Decent",$H$31>=30,"⚠️ Needs Focus",TRUE,"🔴 Off Track")')
    .setFontWeight('bold').setBackground('#FFFFFF')
    .setHorizontalAlignment('center').setVerticalAlignment('middle');
  sh.getRange(31, 8, 3, 6).setBorder(true, true, true, true, false, false,
    THEME.border, SpreadsheetApp.BorderStyle.SOLID);

  /* ─────────── MONTHLY REFLECTION (rows 107–137) ─────────── */

  sectionBar(sh, 107, 2, 10, '🗓️ Monthly Reflection');
  const monthlyRefl = ['🏆 Biggest Achievement', '⚠️ Biggest Mistake', '📈 Habits That Improved',
                       '📉 Habits That Hurt My Productivity', '🎯 Goals for Next Month', '📝 Notes'];
  monthlyRefl.forEach((t, i) => {
    const r = 109 + i * 5;
    sh.getRange(r, 2, 1, 9).merge().setValue(t)
      .setBackground(THEME.subHead).setFontColor(THEME.subHeadText)
      .setFontWeight('bold').setVerticalAlignment('middle');
    sh.getRange(r + 1, 2, 3, 9).merge().setBackground('#FFFFFF')
      .setWrapStrategy(SpreadsheetApp.WrapStrategy.WRAP)
      .setVerticalAlignment('top').setHorizontalAlignment('left')
      .setBorder(true, true, true, true, false, false, THEME.border, SpreadsheetApp.BorderStyle.SOLID)
      .setNote('✍️ Write here');
  });

  // gauge chart feed (kept out of sight — text color matches the background)
  sh.getRange(147, 2).setValue('Metric').setFontColor(THEME.bg);
  sh.getRange(147, 3).setValue('Score').setFontColor(THEME.bg);
  sh.getRange(148, 2).setValue('Productivity').setFontColor(THEME.bg);
  sh.getRange(148, 3).setFormula('=$H$31').setFontColor(THEME.bg);

  /* ─────────── MONTHLY ANALYTICS — 8 CHARTS (rows 40–105) ─────────── */

  sectionBar(sh, 40, 2, 19, '📈 Monthly Analytics');
  const wkCat = 'B24:B28';
  addCharts(sh, [
    { title: '📊 Weekly Comparison by Activity', ranges: ['B14:F20'], type: 'column',
      colors: ['#C7D2FE', '#818CF8', '#4F46E5', '#3730A3'], row: 41, col: 2, legend: 'bottom', vTitle: 'Hours' },
    { title: '🥧 Monthly Activity Distribution', ranges: ['B15:B20', 'G15:G20'], type: 'pie', headers: 0,
      colors: ACTIVITIES.map(a => a.color), row: 41, col: 11, legend: 'right' },
    { title: '💻 Programming Progress (Week 1 → 4)', ranges: [wkCat, 'D24:D28'], type: 'column',
      colors: ['#34A853'], row: 57, col: 2, vTitle: 'Hours' },
    { title: '😴 Sleep Trend', ranges: [wkCat, 'C24:C28'], type: 'line',
      colors: ['#4285F4'], row: 57, col: 11, vTitle: 'Hours' },
    { title: '🏋️ Exercise Trend', ranges: [wkCat, 'E24:E28'], type: 'line',
      colors: ['#FF8F00'], row: 73, col: 2, vTitle: 'Hours' },
    { title: '🧘 Meditation Trend', ranges: [wkCat, 'F24:F28'], type: 'line',
      colors: ['#9C27B0'], row: 73, col: 11, vTitle: 'Hours' },
    { title: '⌛ Wasted Time Trend', ranges: [wkCat, 'H24:H28'], type: 'line',
      colors: ['#EA4335'], row: 89, col: 2, vTitle: 'Hours' },
    { title: '🏆 Productivity Score', ranges: ['B147:C148'], gauge: true, headers: 1, row: 89, col: 11,
      opts: { min: 0, max: 100, redFrom: 0, redTo: 40, yellowFrom: 40, yellowTo: 70, greenFrom: 70, greenTo: 100 } },
  ]);

  sh.setFrozenRows(2);
  return sh;
}

/* ══════════════════════════ NAVIGATION BARS ══════════════════════════ */

function addNavBars(ss, weeks, dash) {
  const items = weeks.map((s, i) => ({ label: '📅 Week ' + (i + 1), gid: s.getSheetId() }))
    .concat([{ label: '📊 Dashboard', gid: dash.getSheetId() }]);
  const sep = '    |    ';
  const text = items.map(i => i.label).join(sep);
  const linkStyle = SpreadsheetApp.newTextStyle()
    .setForegroundColor('#C7D2FE').setBold(true).setUnderline(false).build();
  const b = SpreadsheetApp.newRichTextValue().setText(text);
  let pos = 0;
  items.forEach(it => {
    b.setLinkUrl(pos, pos + it.label.length, '#gid=' + it.gid);
    b.setTextStyle(pos, pos + it.label.length, linkStyle);
    pos += it.label.length + sep.length;
  });
  const rich = b.build();
  weeks.concat([dash]).forEach(sh => sh.getRange('B2').setRichTextValue(rich).setFontSize(10));
}

/* ══════════════════════════ CHART HELPER ══════════════════════════ */

function addCharts(sheet, defs) {
  defs.forEach(d => {
    try {
      let b = sheet.newChart();
      if (d.gauge) {
        b = b.setChartType(Charts.ChartType.GAUGE);
      } else if (d.type === 'pie') {
        b = b.asPieChart().setOption('pieHole', 0.45);
      } else if (d.type === 'line') {
        b = b.asLineChart().setOption('curveType', 'function')
             .setOption('lineWidth', 3).setOption('pointSize', 7);
      } else {
        b = b.asColumnChart();
        if (d.stacked) b = b.setStacked();
      }
      d.ranges.forEach(r => { b = b.addRange(sheet.getRange(r)); });
      b = b.setNumHeaders(d.headers === undefined ? 1 : d.headers)
           .setPosition(d.row, d.col, 4, 4)
           .setOption('title', d.title)
           .setOption('width', 470).setOption('height', 300)
           .setOption('backgroundColor', '#FFFFFF')
           .setOption('titleTextStyle', { color: '#1F2937', fontSize: 13, bold: true })
           .setOption('legend', { position: d.legend || 'none' });
      if (d.colors) b = b.setOption('colors', d.colors);
      if (d.vTitle) b = b.setOption('vAxis', { title: d.vTitle, minValue: 0 });
      if (d.opts) Object.keys(d.opts).forEach(k => { b = b.setOption(k, d.opts[k]); });
      sheet.insertChart(b.build());
    } catch (e) {
      Logger.log('Chart skipped ("' + d.title + '"): ' + e);
    }
  });
}

/* ══════════════════════════ MAINTENANCE ══════════════════════════ */

function clearTimeEntries() {
  const ui = SpreadsheetApp.getUi();
  if (ui.alert('Clear ALL time entries in Weeks 1–4?', ui.ButtonSet.YES_NO) !== ui.Button.YES) return;
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  for (let w = 1; w <= 4; w++) {
    const sh = ss.getSheetByName('Week ' + w);
    if (sh) sh.getRange('C6:AX12').clearContent();
  }
}

function clearTodos() {
  const ui = SpreadsheetApp.getUi();
  if (ui.alert('Clear ALL to-do lists in Weeks 1–4?', ui.ButtonSet.YES_NO) !== ui.Button.YES) return;
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  for (let w = 1; w <= 4; w++) {
    const sh = ss.getSheetByName('Week ' + w);
    if (!sh) continue;
    for (let i = 0; i < 7; i++) {
      const r = 5 + i * 5;                       // first task row of each day block
      sh.getRange(r, 53, 4, 2).clearContent();   // task + notes
      sh.getRange(r, 52, 4, 1).setValue(false);  // uncheck boxes
    }
  }
}

/* ══════════════════════════ UTILS ══════════════════════════ */

function sectionBar(sheet, row, col1, col2, text) {
  sheet.getRange(row, col1, 1, col2 - col1 + 1).merge().setValue(text)
    .setBackground(THEME.section).setFontColor(THEME.sectionText)
    .setFontWeight('bold').setFontSize(11)
    .setVerticalAlignment('middle').setHorizontalAlignment('left');
  sheet.setRowHeight(row, 30);
}

function colA1(c) {
  let s = '';
  while (c > 0) { const m = (c - 1) % 26; s = String.fromCharCode(65 + m) + s; c = (c - 1 - m) / 26; }
  return s;
}
