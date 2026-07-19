/** ═══════════════════════════════════════════════════════════════════════════
 *  ⏱️  PREMIUM TIME TRACKER — automated Google Sheets builder  (v4)
 *  ───────────────────────────────────────────────────────────────────────────
 *  Builds a complete, fully-automated 5-sheet productivity tracker:
 *    📅 Week 1 … Week 4  — 30-min time grid (Sat–Fri × 48 blocks), dropdowns,
 *                          auto-coloring, daily to-do lists, per-activity AND
 *                          per-group statistics, 10 charts, reflection journal
 *    📊 Monthly Dashboard — KPI cards by category group, activity & group
 *                          summaries, productivity score + gauge, 10 charts
 *
 *  v3 changes: 12-activity system with category groups (Programming, English,
 *  Exercises, Meditate, Work, Personal, Sleep, Wasted), Saturday-first weeks,
 *  Friday-only weekend styling, no frozen rows/columns, refreshed Config goals.
 *
 *  HOW TO INSTALL
 *  1. Open a NEW blank Google Sheet  (sheets.new)
 *  2. Extensions ▸ Apps Script → delete any code there → paste THIS file
 *  3. Click 💾 Save, then select the function  buildTimeTracker  and press ▶ Run
 *  4. Authorize when asked, then wait ~90 seconds while it builds. Done!
 *
 *  A custom menu  "⏱️ Time Tracker"  also appears after you reload the sheet.
 *  Score goals are editable on the hidden "⚙️ Config" sheet.
 *  ═══════════════════════════════════════════════════════════════════════════ */

const ACTIVITIES = [
  { name: 'codding',         emoji: '💻', color: '#057c31', text: '#FFFFFF' },
  { name: 'learn-prog',      emoji: '💻', color: '#86EFAC', text: '#FFFFFF' },
  { name: 'En-book',         emoji: '📚', color: '#2563EB', text: '#FFFFFF' },
  { name: 'En-listening',    emoji: '📚', color: '#93C5FD', text: '#FFFFFF' },
  { name: 'Run',             emoji: '🏋️', color: '#EA580C', text: '#FFFFFF' },
  { name: 'Gym',             emoji: '🏋️', color: '#FDBA74', text: '#FFFFFF' },
  { name: 'work',            emoji: '🧑‍💻', color: '#89fd05', text: '#FFFFFF' },
  { name: 'Meditation',      emoji: '🧘', color: '#8e029b', text: '#FFFFFF' },
  { name: 'Setar',           emoji: '🧘', color: '#da87de', text: '#FFFFFF' },
  { name: 'Personal Tasks',  emoji: '📋', color: '#eeeeee', text: '#5F4B00' },
  { name: 'Wasted Time',     emoji: '⌛', color: '#ff1500', text: '#FFFFFF' },
  { name: 'Sleep',           emoji: '😴', color: '#4e4d44', text: '#FFFFFF' },
];

// Category groups — members are indexes into ACTIVITIES.
// Individual activities keep their own rows/columns everywhere; groups add
// combined statistics, KPI cards, grouped charts and the productivity score.
const GROUPS = [
  { name: 'Programming',    emoji: '💻', members: [0, 1],  color: '#057c31' },
  { name: 'English',        emoji: '📚', members: [2, 3],  color: '#2563EB' },
  { name: 'Exercises',      emoji: '🏋️', members: [4, 5],  color: '#EA580C' },
  { name: 'Meditate',       emoji: '🧘', members: [7, 8],  color: '#8e029b' },
  { name: 'Work',           emoji: '🧑‍💻', members: [6],    color: '#89fd05' },
  { name: 'Personal Tasks', emoji: '📋', members: [9],     color: '#eeeeee' },
  { name: 'Sleep',          emoji: '😴', members: [11],    color: '#4e4d44' },
  { name: 'Wasted Time',    emoji: '⌛', members: [10],    color: '#ff1500' },
];

// Week starts on Monday; Friday keeps the weekend styling
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
const NAMED = ['ACTIVITIES', 'GOAL_PROG', 'GOAL_ENGLISH', 'GOAL_EXERCISE',
               'GOAL_MEDITATION', 'GOAL_WORK', 'GOAL_PERSONAL',
               'IDEAL_SLEEP', 'WASTED_LIMIT', 'MONTH_START',
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
    ['Monthly Programming goal (codding + learn-prog, hours)', 60, 'GOAL_PROG'],
    ['Monthly English goal (En-book + En-listening, hours)',   30, 'GOAL_ENGLISH'],
    ['Monthly Exercise goal (Run + Gym, hours)',               20, 'GOAL_EXERCISE'],
    ['Monthly Meditate goal (Meditation + Setar, hours)',      15, 'GOAL_MEDITATION'],
    ['Monthly Work goal (hours)',                              80, 'GOAL_WORK'],
    ['Monthly Personal Tasks goal (hours)',                    30, 'GOAL_PERSONAL'],
    ['Ideal sleep per day (hours)',                             8, 'IDEAL_SLEEP'],
    ['Wasted-time limit per month (hours)',                    40, 'WASTED_LIMIT'],
  ];
  goals.forEach((g, i) => {
    sh.getRange(2 + i, 4).setValue(g[0]);
    sh.getRange(2 + i, 5).setValue(g[1]).setFontWeight('bold');
    ss.setNamedRange(g[2], sh.getRange(2 + i, 5));
  });
  // Week 1 start date — drives the calendar dates shown above each weekday.
  // Defaults to the Monday of the current week; edit it to shift all dates.
  const today = new Date();
  const monday = new Date(today.getFullYear(), today.getMonth(),
                          today.getDate() - ((today.getDay() + 6) % 7));
  sh.getRange(10, 4).setValue('Week 1 start date (must be a Monday)');
  sh.getRange(10, 5).setValue(monday).setNumberFormat('d mmm yyyy').setFontWeight('bold')
    .setNote('All weekly-sheet dates are computed from this date.\nWeek 2 starts +7 days, Week 3 +14, Week 4 +21.');
  ss.setNamedRange('MONTH_START', sh.getRange(10, 5));

  ss.setNamedRange('ACTIVITIES', sh.getRange('A2:A' + (1 + ACTIVITIES.length)));

  sh.setColumnWidth(4, 340);
  sh.hideSheet();
  return sh;
}

/* ══════════════════════════ WEEKLY SHEET ══════════════════════════ */

function buildWeekSheet(ss, cfg, w) {
  const sh = ss.insertSheet('Week ' + w);
  sh.setTabColor(WEEK_TABS[w - 1]);

  // ---- canvas size: 172 rows × 70 cols ----
  if (sh.getMaxColumns() < 70) sh.insertColumnsAfter(sh.getMaxColumns(), 70 - sh.getMaxColumns());
  if (sh.getMaxColumns() > 70) sh.deleteColumns(71, sh.getMaxColumns() - 70);
  if (sh.getMaxRows() > 172) sh.deleteRows(173, sh.getMaxRows() - 172);
  if (sh.getMaxRows() < 172) sh.insertRowsAfter(sh.getMaxRows(), 172 - sh.getMaxRows());

  sh.setHiddenGridlines(true);
  sh.getRange(1, 1, 172, 70).setBackground(THEME.bg)
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
  sh.setColumnWidths(57, 12, 85);      // BE..BP  12 activities
  sh.setColumnWidth(69, 80);           // BQ total
  sh.setColumnWidth(70, 16);           // BR spacer

  // ---- row heights ----
  sh.setRowHeight(1, 50); sh.setRowHeight(2, 28); sh.setRowHeight(3, 30);
  sh.setRowHeight(4, 26); sh.setRowHeight(5, 22);
  sh.setRowHeights(6, 7, 36);
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

  // day labels — weekday name + actual calendar date (from MONTH_START on Config);
  // month transitions are automatic. Friday is the only weekend day.
  DAYS.forEach((d, i) => {
    const c = d === 'Friday' ? THEME.weekend : THEME.weekday;
    const off = (w - 1) * 7 + i;
    sh.getRange(6 + i, 2)
      .setFormula('="' + d + '"&CHAR(10)&TEXT(MONTH_START+' + off + ',"d mmm")')
      .setBackground(c.bg).setFontColor(c.fg).setFontWeight('bold').setFontSize(9)
      .setWrapStrategy(SpreadsheetApp.WrapStrategy.WRAP)
      .setHorizontalAlignment('center').setVerticalAlignment('middle');
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

  // legend chips (row 14) — 12 chips × 4 columns
  sh.getRange(14, 2).setValue('🎨 Legend').setFontWeight('bold')
    .setFontColor(THEME.muted).setFontSize(9).setVerticalAlignment('middle');
  ACTIVITIES.forEach((a, i) => {
    sh.getRange(14, 3 + i * 4, 1, 4).merge()
      .setValue(a.emoji + ' ' + a.name)
      .setBackground(a.color).setFontColor(a.text).setFontWeight('bold')
      .setFontSize(8).setHorizontalAlignment('center').setVerticalAlignment('middle')
      .setWrapStrategy(SpreadsheetApp.WrapStrategy.CLIP);
  });

  /* ─────────── 2. WEEKLY STATISTICS & SUMMARY  (rows 16–31) ─────────── */

  sectionBar(sh, 16, 2, 18, '📊 Weekly Statistics & Summary  (auto-calculated)');

  const headSpans = [[2, 4, 'Activity'], [6, 3, 'Total Hours'], [9, 3, '% of Week'], [12, 7, 'Distribution']];
  headSpans.forEach(hs => {
    sh.getRange(17, hs[0], 1, hs[1]).merge().setValue(hs[2])
      .setBackground(THEME.subHead).setFontColor(THEME.subHeadText).setFontWeight('bold')
      .setHorizontalAlignment('center').setVerticalAlignment('middle');
  });

  ACTIVITIES.forEach((a, i) => {
    const r = 18 + i;                            // rows 18–29
    sh.setRowHeight(r, 24);
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
      .setFormula('=IFERROR(SPARKLINE($F$' + r + ',{"charttype","bar";"max",MAX($F$18:$F$29)+0.0001;"color1","' + a.color + '"}),"")')
      .setBackground('#FFFFFF').setVerticalAlignment('middle');
  });
  // totals (rows 30–31)
  sh.setRowHeight(30, 26); sh.setRowHeight(31, 24);
  sh.getRange(30, 2, 1, 4).merge().setValue('Σ Total Tracked').setFontWeight('bold')
    .setBackground(THEME.totalRow).setVerticalAlignment('middle');
  sh.getRange(30, 6, 1, 3).merge().setFormula('=SUM($F$18:$F$29)').setNumberFormat('0.0')
    .setFontWeight('bold').setBackground(THEME.totalRow).setHorizontalAlignment('center').setVerticalAlignment('middle');
  sh.getRange(30, 9, 1, 3).merge().setFormula('=$F$30/168').setNumberFormat('0.0%')
    .setFontWeight('bold').setBackground(THEME.totalRow).setHorizontalAlignment('center').setVerticalAlignment('middle');
  sh.getRange(30, 12, 1, 7).merge().setBackground(THEME.totalRow);
  sh.getRange(31, 2, 1, 4).merge().setValue('⬜ Untracked').setFontColor(THEME.muted)
    .setBackground('#FFFFFF').setVerticalAlignment('middle');
  sh.getRange(31, 6, 1, 3).merge().setFormula('=168-$F$30').setNumberFormat('0.0')
    .setFontColor(THEME.muted).setBackground('#FFFFFF').setHorizontalAlignment('center').setVerticalAlignment('middle');
  sh.getRange(31, 9, 1, 3).merge().setFormula('=$F$31/168').setNumberFormat('0.0%')
    .setFontColor(THEME.muted).setBackground('#FFFFFF').setHorizontalAlignment('center').setVerticalAlignment('middle');
  sh.getRange(31, 12, 1, 7).merge().setBackground('#FFFFFF');
  sh.getRange(17, 2, 15, 17).setBorder(true, true, true, true, true, true,
    THEME.border, SpreadsheetApp.BorderStyle.SOLID);

  /* ─────────── 3. CATEGORY GROUPS  (rows 33–42) ─────────── */

  sectionBar(sh, 33, 2, 18, '📦 Category Groups  (combined totals — activities stay tracked individually)');
  headSpans.forEach(hs => {
    sh.getRange(34, hs[0], 1, hs[1]).merge().setValue(hs[2] === 'Activity' ? 'Group' : hs[2])
      .setBackground(THEME.subHead).setFontColor(THEME.subHeadText).setFontWeight('bold')
      .setHorizontalAlignment('center').setVerticalAlignment('middle');
  });
  GROUPS.forEach((g, i) => {
    const r = 35 + i;                            // rows 35–42
    sh.setRowHeight(r, 24);
    const sum = '=' + g.members.map(m => 'F' + (18 + m)).join('+');
    sh.getRange(r, 2, 1, 4).merge().setValue(g.emoji + ' ' + g.name)
      .setBackground('#FFFFFF').setFontWeight('bold').setVerticalAlignment('middle');
    sh.getRange(r, 6, 1, 3).merge().setFormula(sum)
      .setNumberFormat('0.0').setBackground('#FFFFFF').setFontWeight('bold')
      .setHorizontalAlignment('center').setVerticalAlignment('middle');
    sh.getRange(r, 9, 1, 3).merge().setFormula('=$F$' + r + '/168')
      .setNumberFormat('0.0%').setBackground('#FFFFFF').setFontColor(THEME.muted)
      .setHorizontalAlignment('center').setVerticalAlignment('middle');
    sh.getRange(r, 12, 1, 7).merge()
      .setFormula('=IFERROR(SPARKLINE($F$' + r + ',{"charttype","bar";"max",MAX($F$35:$F$42)+0.0001;"color1","' + g.color + '"}),"")')
      .setBackground('#FFFFFF').setVerticalAlignment('middle');
  });
  sh.getRange(34, 2, 9, 17).setBorder(true, true, true, true, true, true,
    THEME.border, SpreadsheetApp.BorderStyle.SOLID);

  /* ─────────── 4. WEEKLY REFLECTION  (rows 44–69) ─────────── */

  sectionBar(sh, 44, 2, 18, '🧠 Weekly Reflection');
  const reflections = [
    ['🏆 Wins This Week', 'What went well?'],
    ['⚔️ Challenges', 'What problems did I face?'],
    ['💡 Lessons Learned', 'What did I learn?'],
    ['🚀 Improvements for Next Week', 'What should I improve?'],
    ['📝 Personal Notes', 'Free writing space'],
  ];
  reflections.forEach((sec, i) => {
    const r = 46 + i * 5;
    sh.getRange(r, 2, 1, 17).merge().setValue(sec[0] + '  ·  ' + sec[1])
      .setBackground(THEME.subHead).setFontColor(THEME.subHeadText)
      .setFontWeight('bold').setVerticalAlignment('middle');
    sh.getRange(r + 1, 2, 3, 17).merge().setBackground('#FFFFFF')
      .setWrapStrategy(SpreadsheetApp.WrapStrategy.WRAP)
      .setVerticalAlignment('top').setHorizontalAlignment('left')
      .setBorder(true, true, true, true, false, false, THEME.border, SpreadsheetApp.BorderStyle.SOLID)
      .setNote('✍️ Write here');
  });

  /* ─────────── 5. DAILY TO-DO LIST  (right zone, AZ–BB) ─────────── */

  sh.getRange(3, 52, 1, 3).merge().setValue('✅ Daily To-Do List')
    .setBackground(THEME.section).setFontColor('#FFFFFF').setFontWeight('bold')
    .setFontSize(11).setVerticalAlignment('middle');

  DAYS.forEach((d, i) => {
    const hr = 4 + i * 5;                       // day header row
    const c = d === 'Friday' ? THEME.weekend : THEME.weekday;
    sh.getRange(hr, 52, 1, 3).merge().setValue('📅 ' + d)
      .setBackground(c.bg).setFontColor(c.fg).setFontWeight('bold').setVerticalAlignment('middle');
    sh.getRange(hr + 1, 52, 4, 3).setBackground('#FFFFFF')
      .setWrapStrategy(SpreadsheetApp.WrapStrategy.CLIP).setVerticalAlignment('middle');
    sh.getRange(hr + 1, 52, 4, 1).insertCheckboxes().setHorizontalAlignment('center');
  });
  sh.getRange(4, 52, 35, 3).setBorder(true, true, true, true, true, true,
    THEME.border, SpreadsheetApp.BorderStyle.SOLID);
  sh.getRange(5, 53).setNote('Type a task here; the ✓ box grays it out automatically.\nColumn to the right = optional notes.');

  /* ─────────── 6. DAILY BREAKDOWN (chart feed, BD–BQ) ─────────── */

  sh.getRange(3, 56, 1, 14).merge().setValue('📅 Daily Breakdown — hours per activity (auto)')
    .setBackground(THEME.section).setFontColor('#FFFFFF').setFontWeight('bold')
    .setFontSize(11).setVerticalAlignment('middle');

  const bh = [['Day'].concat(ACTIVITIES.map(a => a.emoji + ' ' + a.name)).concat(['Σ Total'])];
  sh.getRange(4, 56, 1, 14).setValues(bh)
    .setBackground(THEME.subHead).setFontColor(THEME.subHeadText).setFontWeight('bold')
    .setFontSize(9).setHorizontalAlignment('center').setVerticalAlignment('middle')
    .setWrapStrategy(SpreadsheetApp.WrapStrategy.WRAP);

  DAYS.forEach((d, i) => {
    const r = 5 + i, gr = 6 + i;                // breakdown row, grid row
    const c = d === 'Friday' ? THEME.weekend : THEME.weekday;
    sh.getRange(r, 56).setValue(d).setBackground(c.bg).setFontColor(c.fg).setFontWeight('bold');
    ACTIVITIES.forEach((a, j) => {
      sh.getRange(r, 57 + j)
        .setFormula('=COUNTIF($C$' + gr + ':$AX$' + gr + ',"' + a.name + '")*0.5')
        .setNumberFormat('0.0').setBackground('#FFFFFF').setHorizontalAlignment('center');
    });
    sh.getRange(r, 69).setFormula('=SUM(BE' + r + ':BP' + r + ')')
      .setNumberFormat('0.0').setFontWeight('bold').setBackground('#FFFFFF').setHorizontalAlignment('center');
  });
  sh.getRange(12, 56).setValue('Σ Week').setFontWeight('bold').setBackground(THEME.totalRow);
  for (let j = 0; j < 13; j++) {
    const col = 57 + j, letter = colA1(col);
    sh.getRange(12, col).setFormula('=SUM(' + letter + '5:' + letter + '11)')
      .setNumberFormat('0.0').setFontWeight('bold').setBackground(THEME.totalRow).setHorizontalAlignment('center');
  }
  sh.getRange(4, 56, 9, 14).setBorder(true, true, true, true, true, true,
    THEME.border, SpreadsheetApp.BorderStyle.SOLID);

  /* ─────────── 7. PRODUCTIVE TIME (right zone, rows 14–28) ─────────── */
  // Productive = Programming + English + Exercises + Work
  // (breakdown columns BE..BK are exactly codding…work, so daily sums are contiguous)

  sectionBar(sh, 14, 56, 69, '⚡ Productive Time — Programming + English + Exercises + Work');

  const prodCards = [
    { c1: 56, w2: 4, label: "⚡ Today's Productive Hours",
      f: '=IFERROR(INDEX($BE$20:$BE$26,TODAY()-(MONTH_START+' + ((w - 1) * 7) + ')+1),"—")' },
    { c1: 61, w2: 3, label: 'Σ Week Total', f: '=$BE$27' },
    { c1: 65, w2: 4, label: '📈 Avg / Day', f: '=$BE$28' },
  ];
  prodCards.forEach(pc => {
    sh.getRange(15, pc.c1, 1, pc.w2).merge().setValue(pc.label)
      .setBackground('#0D9488').setFontColor('#FFFFFF').setFontSize(9).setFontWeight('bold')
      .setHorizontalAlignment('center').setVerticalAlignment('middle');
    sh.getRange(16, pc.c1, 2, pc.w2).merge().setFormula(pc.f).setNumberFormat('0.0" h"')
      .setBackground('#0D9488').setFontColor('#FFFFFF').setFontSize(18).setFontWeight('bold')
      .setHorizontalAlignment('center').setVerticalAlignment('middle');
  });
  sh.getRange(15, 56).setNote("Shows today's productive hours while this sheet's week is the current week; otherwise —");

  // daily comparison table (rows 19–28) — feeds the productive chart
  sh.getRange(19, 56).setValue('Day');
  sh.getRange(19, 57).setValue('⚡ Hours');
  sh.getRange(19, 58, 1, 3).merge().setValue('Comparison');
  sh.getRange(19, 56, 1, 5)
    .setBackground(THEME.subHead).setFontColor(THEME.subHeadText).setFontWeight('bold')
    .setFontSize(9).setHorizontalAlignment('center').setVerticalAlignment('middle');
  DAYS.forEach((d, i) => {
    const r = 20 + i, br = 5 + i;               // table row, breakdown row
    const c = d === 'Friday' ? THEME.weekend : THEME.weekday;
    sh.getRange(r, 56).setValue(d).setBackground(c.bg).setFontColor(c.fg).setFontWeight('bold');
    sh.getRange(r, 57).setFormula('=SUM(BE' + br + ':BK' + br + ')')
      .setNumberFormat('0.0').setFontWeight('bold').setBackground('#FFFFFF').setHorizontalAlignment('center');
    sh.getRange(r, 58, 1, 3).merge()
      .setFormula('=IFERROR(SPARKLINE($BE' + r + ',{"charttype","bar";"max",MAX($BE$20:$BE$26)+0.0001;"color1","#0D9488"}),"")')
      .setBackground('#FFFFFF').setVerticalAlignment('middle');
  });
  sh.getRange(27, 56).setValue('Σ Week').setFontWeight('bold').setBackground(THEME.totalRow);
  sh.getRange(27, 57).setFormula('=SUM(BE20:BE26)').setNumberFormat('0.0')
    .setFontWeight('bold').setBackground(THEME.totalRow).setHorizontalAlignment('center');
  sh.getRange(27, 58, 1, 3).merge().setBackground(THEME.totalRow);
  sh.getRange(28, 56).setValue('Avg / day').setFontColor(THEME.muted).setBackground('#FFFFFF');
  sh.getRange(28, 57).setFormula('=BE27/7').setNumberFormat('0.00')
    .setFontWeight('bold').setBackground('#FFFFFF').setHorizontalAlignment('center');
  sh.getRange(28, 58, 1, 3).merge().setBackground('#FFFFFF');
  sh.getRange(19, 56, 10, 5).setBorder(true, true, true, true, true, true,
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

  // no frozen rows or columns anywhere
  sh.setFrozenRows(0);
  sh.setFrozenColumns(0);

  /* ─────────── WEEKLY CHARTS (10) ─────────── */
  // breakdown columns: BE codding, BF learn-prog, BG En-book, BH En-listening,
  // BI Run, BJ Gym, BK work, BL Meditation, BM Setar, BN Personal, BO Wasted, BP Sleep
  const dayCat = 'BD4:BD11';
  addCharts(sh, [
    { title: '💻 Programming — codding + learn-prog (daily)', ranges: ['BD4:BF11'], type: 'column',
      stacked: true, colors: ['#057c31', '#86EFAC'], row: 72, col: 2, legend: 'bottom', vTitle: 'Hours' },
    { title: '📚 English — En-book + En-listening (daily)', ranges: [dayCat, 'BG4:BH11'], type: 'column',
      stacked: true, colors: ['#2563EB', '#93C5FD'], row: 72, col: 20, legend: 'bottom', vTitle: 'Hours' },
    { title: '🏋️ Exercises — Run + Gym (daily)', ranges: [dayCat, 'BI4:BJ11'], type: 'column',
      stacked: true, colors: ['#EA580C', '#FDBA74'], row: 88, col: 2, legend: 'bottom', vTitle: 'Hours' },
    { title: '🧘 Meditate — Meditation + Setar (daily)', ranges: [dayCat, 'BL4:BM11'], type: 'column',
      stacked: true, colors: ['#8e029b', '#da87de'], row: 88, col: 20, legend: 'bottom', vTitle: 'Hours' },
    { title: '🧑‍💻 Daily Work Hours', ranges: [dayCat, 'BK4:BK11'], type: 'column',
      colors: ['#89fd05'], row: 104, col: 2, vTitle: 'Hours' },
    { title: '😴 Daily Sleep Hours', ranges: [dayCat, 'BP4:BP11'], type: 'column',
      colors: ['#4e4d44'], row: 104, col: 20, vTitle: 'Hours' },
    { title: '📋 Daily Personal Tasks Hours', ranges: [dayCat, 'BN4:BN11'], type: 'column',
      colors: ['#CFCFCF'], row: 120, col: 2, vTitle: 'Hours' },
    { title: '⌛ Daily Wasted Time Hours', ranges: [dayCat, 'BO4:BO11'], type: 'column',
      colors: ['#ff1500'], row: 120, col: 20, vTitle: 'Hours' },
    { title: '🥧 Weekly Activity Distribution', ranges: ['B18:B29', 'F18:F29'], type: 'pie', headers: 0,
      colors: ACTIVITIES.map(a => a.color), row: 136, col: 2, legend: 'right' },
    { title: '📈 Weekly Productivity Trend — how each day was spent', ranges: ['BD4:BP11'], type: 'column',
      stacked: true, colors: ACTIVITIES.map(a => a.color), row: 136, col: 20, legend: 'bottom', vTitle: 'Hours' },
    { title: '⚡ Daily Productive Hours — Programming + English + Exercises + Work', ranges: ['BD19:BE26'],
      type: 'column', colors: ['#0D9488'], row: 152, col: 2, vTitle: 'Hours' },
  ]);

  return sh;
}

/* ══════════════════════════ MONTHLY DASHBOARD ══════════════════════════ */

function buildDashboardSheet(ss) {
  const sh = ss.insertSheet(DASH_NAME);
  sh.setTabColor('#4F46E5');

  // canvas: 195 rows × 21 cols
  if (sh.getMaxColumns() > 21) sh.deleteColumns(22, sh.getMaxColumns() - 21);
  if (sh.getMaxRows() > 195) sh.deleteRows(196, sh.getMaxRows() - 195);
  if (sh.getMaxRows() < 195) sh.insertRowsAfter(sh.getMaxRows(), 195 - sh.getMaxRows());

  sh.setHiddenGridlines(true);
  sh.getRange(1, 1, 195, 21).setBackground(THEME.bg)
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

  /* ─────────── KPI CARDS (rows 4–10) — one per category group + score ─────────── */
  // group totals live in the Group Summary table: G31..G38

  const cards = [
    { label: '💻 Programming', f: '=$G$31', fmt: '0.0" h"', bg: '#057c31', fg: '#FFFFFF' },
    { label: '📚 English',     f: '=$G$32', fmt: '0.0" h"', bg: '#2563EB', fg: '#FFFFFF' },
    { label: '🏋️ Exercises',   f: '=$G$33', fmt: '0.0" h"', bg: '#EA580C', fg: '#FFFFFF' },
    { label: '🧘 Meditate',    f: '=$G$34', fmt: '0.0" h"', bg: '#8e029b', fg: '#FFFFFF' },
    { label: '⚡ Productive (Month)', f: '=$Q$52', fmt: '0.0" h"', bg: '#0D9488', fg: '#FFFFFF' },
    { label: '🧑‍💻 Work',        f: '=$G$35', fmt: '0.0" h"', bg: '#89fd05', fg: '#FFFFFF' },
    { label: '😴 Sleep',       f: '=$G$37', fmt: '0.0" h"', bg: '#4e4d44', fg: '#FFFFFF' },
    { label: '⌛ Wasted Time', f: '=$G$38', fmt: '0.0" h"', bg: '#ff1500', fg: '#FFFFFF' },
    { label: '🏆 Productivity Score', f: '=$H$48', fmt: '0" / 100"', bg: '#4F46E5', fg: '#FFFFFF' },
    { label: '⚡ Avg Productive / Day', f: '=$Q$53', fmt: '0.00" h"', bg: '#0F766E', fg: '#FFFFFF' },
  ];
  const cardCols = [2, 6, 10, 14, 18];   // B, F, J, N, R — each card spans 3 columns
  cards.forEach((c, i) => {
    const row = i < 5 ? 4 : 8;
    const col = cardCols[i % 5];
    sh.getRange(row, col, 1, 3).merge().setValue(c.label)
      .setBackground(c.bg).setFontColor(c.fg).setFontSize(10).setFontWeight('bold')
      .setHorizontalAlignment('center').setVerticalAlignment('middle');
    sh.getRange(row + 1, col, 2, 3).merge().setFormula(c.f).setNumberFormat(c.fmt)
      .setBackground(c.bg).setFontColor(c.fg).setFontSize(20).setFontWeight('bold')
      .setHorizontalAlignment('center').setVerticalAlignment('middle');
  });

  /* ─────────── MONTHLY SUMMARY BY ACTIVITY (rows 13–27) ─────────── */

  sectionBar(sh, 13, 2, 10, '📊 Monthly Summary by Activity  (auto-collected from Weeks 1–4)');

  sh.getRange(14, 2, 1, 7)
    .setValues([['Activity', 'Week 1', 'Week 2', 'Week 3', 'Week 4', 'Σ Total', '% of Month']]);
  sh.getRange(14, 9, 1, 2).merge().setValue('Trend');
  sh.getRange(14, 2, 1, 9)
    .setBackground(THEME.subHead).setFontColor(THEME.subHeadText).setFontWeight('bold')
    .setHorizontalAlignment('center').setVerticalAlignment('middle')
    .setWrapStrategy(SpreadsheetApp.WrapStrategy.WRAP);

  ACTIVITIES.forEach((a, i) => {
    const r = 15 + i;                            // rows 15–26
    sh.setRowHeight(r, 24);
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
  sh.setRowHeight(27, 26);
  sh.getRange(27, 2).setValue('Σ Total Tracked').setFontWeight('bold').setBackground(THEME.totalRow);
  for (let c = 3; c <= 7; c++) {
    const L = colA1(c);
    sh.getRange(27, c).setFormula('=SUM(' + L + '15:' + L + '26)').setNumberFormat('0.0')
      .setFontWeight('bold').setBackground(THEME.totalRow).setHorizontalAlignment('center');
  }
  sh.getRange(27, 8).setFormula('=$G$27/672').setNumberFormat('0.0%')
    .setFontWeight('bold').setBackground(THEME.totalRow).setHorizontalAlignment('center');
  sh.getRange(27, 9, 1, 2).merge().setBackground(THEME.totalRow);
  sh.getRange(14, 2, 14, 9).setBorder(true, true, true, true, true, true,
    THEME.border, SpreadsheetApp.BorderStyle.SOLID);

  /* ─────────── GROUP SUMMARY (rows 29–38) ─────────── */

  sectionBar(sh, 29, 2, 10, '📦 Group Summary  (Programming, English, Exercises, Meditate, …)');
  sh.getRange(30, 2, 1, 7)
    .setValues([['Group', 'Week 1', 'Week 2', 'Week 3', 'Week 4', 'Σ Total', '% of Month']]);
  sh.getRange(30, 9, 1, 2).merge().setValue('Trend');
  sh.getRange(30, 2, 1, 9)
    .setBackground(THEME.subHead).setFontColor(THEME.subHeadText).setFontWeight('bold')
    .setHorizontalAlignment('center').setVerticalAlignment('middle')
    .setWrapStrategy(SpreadsheetApp.WrapStrategy.WRAP);

  GROUPS.forEach((g, i) => {
    const r = 31 + i;                            // rows 31–38
    sh.setRowHeight(r, 24);
    sh.getRange(r, 2).setValue(g.emoji + ' ' + g.name).setFontWeight('bold').setBackground('#FFFFFF');
    for (let wk = 1; wk <= 4; wk++) {
      const L = colA1(2 + wk);
      sh.getRange(r, 2 + wk)
        .setFormula('=' + g.members.map(m => L + (15 + m)).join('+'))
        .setNumberFormat('0.0').setBackground('#FFFFFF').setHorizontalAlignment('center');
    }
    sh.getRange(r, 7).setFormula('=SUM(C' + r + ':F' + r + ')').setNumberFormat('0.0')
      .setFontWeight('bold').setBackground('#FFFFFF').setHorizontalAlignment('center');
    sh.getRange(r, 8).setFormula('=$G$' + r + '/672').setNumberFormat('0.0%')
      .setFontColor(THEME.muted).setBackground('#FFFFFF').setHorizontalAlignment('center');
    sh.getRange(r, 9, 1, 2).merge()
      .setFormula('=IFERROR(SPARKLINE(C' + r + ':F' + r + ',{"charttype","line";"linewidth",2;"color","' + g.color + '"}),"")')
      .setBackground('#FFFFFF');
  });
  sh.getRange(30, 2, 9, 9).setBorder(true, true, true, true, true, true,
    THEME.border, SpreadsheetApp.BorderStyle.SOLID);

  /* ─────────── WEEKLY TOTALS — transposed chart feed (rows 40–45) ─────────── */

  sectionBar(sh, 40, 2, 14, '📅 Weekly Totals by Activity  (auto — feeds the trend charts)');
  sh.getRange(41, 2, 1, 13)
    .setValues([['Week'].concat(ACTIVITIES.map(a => a.emoji + ' ' + a.name))])
    .setBackground(THEME.subHead).setFontColor(THEME.subHeadText).setFontWeight('bold')
    .setFontSize(9).setHorizontalAlignment('center').setVerticalAlignment('middle')
    .setWrapStrategy(SpreadsheetApp.WrapStrategy.WRAP);
  for (let wk = 1; wk <= 4; wk++) {
    const r = 41 + wk;                           // rows 42–45
    sh.getRange(r, 2).setValue('Week ' + wk).setFontWeight('bold').setBackground('#FFFFFF');
    ACTIVITIES.forEach((a, j) => {
      // pulls from the activity summary: activity row 15+j, week column C..F
      sh.getRange(r, 3 + j).setFormula('=' + colA1(2 + wk) + (15 + j))
        .setNumberFormat('0.0').setBackground('#FFFFFF').setHorizontalAlignment('center');
    });
  }
  sh.getRange(41, 2, 5, 13).setBorder(true, true, true, true, true, true,
    THEME.border, SpreadsheetApp.BorderStyle.SOLID);

  /* ─────────── KEY METRICS + PRODUCTIVITY SCORE (rows 47–54) ─────────── */

  sectionBar(sh, 47, 2, 6, '📌 Key Metrics');
  const metrics = [
    ['⏱️ Total Tracked Hours',        '=$G$27',                                        '0.0" h"'],
    ['⚡ Avg Productive Hours / Day',  '=($G$31+$G$32+$G$33+$G$34+$G$35+$G$36)/28',     '0.00" h"'],
    ['😴 Avg Sleep / Day',             '=$G$37/28',                                     '0.00" h"'],
    ['💻 Programming % (of tracked)',  '=IFERROR($G$31/$G$27,0)',                       '0.0%'],
    ['📚 English % (of tracked)',      '=IFERROR($G$32/$G$27,0)',                       '0.0%'],
    ['🏋️ Exercises % (of tracked)',    '=IFERROR($G$33/$G$27,0)',                       '0.0%'],
    ['⌛ Wasted Time % (of tracked)',  '=IFERROR($G$38/$G$27,0)',                       '0.0%'],
  ];
  metrics.forEach((m, i) => {
    const r = 48 + i;                            // rows 48–54
    sh.setRowHeight(r, 25);
    sh.getRange(r, 2, 1, 3).merge().setValue(m[0]).setBackground('#FFFFFF').setVerticalAlignment('middle');
    sh.getRange(r, 5, 1, 2).merge().setFormula(m[1]).setNumberFormat(m[2])
      .setFontWeight('bold').setBackground('#FFFFFF')
      .setHorizontalAlignment('center').setVerticalAlignment('middle');
  });
  sh.getRange(48, 2, 7, 5).setBorder(true, true, true, true, true, true,
    THEME.border, SpreadsheetApp.BorderStyle.SOLID);

  sectionBar(sh, 47, 8, 13, '🏆 Productivity Score');
  sh.getRange(48, 8, 3, 3).merge()
    .setFormula(
      '=ROUND(MAX(0,' +
      ' MIN(1,$G$31/GOAL_PROG)*25' +
      ' + MIN(1,$G$32/GOAL_ENGLISH)*15' +
      ' + MIN(1,$G$33/GOAL_EXERCISE)*12' +
      ' + MIN(1,$G$34/GOAL_MEDITATION)*8' +
      ' + MIN(1,$G$35/GOAL_WORK)*10' +
      ' + MIN(1,$G$36/GOAL_PERSONAL)*5' +
      ' + MAX(0,1-ABS($G$37/28-IDEAL_SLEEP)/4)*25' +
      ' - MIN(1,$G$38/WASTED_LIMIT)*25),0)')
    .setNumberFormat('0')
    .setBackground('#4F46E5').setFontColor('#FFFFFF').setFontSize(30).setFontWeight('bold')
    .setHorizontalAlignment('center').setVerticalAlignment('middle')
    .setNote('Score out of 100:\n' +
      '• Programming (codding + learn-prog) vs goal → 25 pts\n' +
      '• English (En-book + En-listening) vs goal → 15 pts\n' +
      '• Exercises (Run + Gym) vs goal → 12 pts\n' +
      '• Meditate (Meditation + Setar) vs goal → 8 pts\n' +
      '• Work vs goal → 10 pts\n• Personal Tasks vs goal → 5 pts\n' +
      '• Healthy sleep (near ideal/day) → 25 pts\n• Wasted time → up to −25 pts\n\n' +
      'Goals are editable on the hidden "⚙️ Config" sheet\n(right-click a tab ▸ Show sheet).');
  sh.getRange(48, 11, 1, 3).merge()
    .setFormula('=IFERROR(SPARKLINE($H$48,{"charttype","bar";"max",100;"color1","#22C55E"}),"")')
    .setBackground('#FFFFFF').setVerticalAlignment('middle');
  sh.getRange(49, 11, 1, 3).merge().setValue('out of 100').setFontColor(THEME.muted)
    .setFontSize(9).setBackground('#FFFFFF').setHorizontalAlignment('center').setVerticalAlignment('middle');
  sh.getRange(50, 11, 1, 3).merge()
    .setFormula('=IFS($H$48>=85,"🌟 Outstanding",$H$48>=70,"💪 Strong",$H$48>=50,"🙂 Decent",$H$48>=30,"⚠️ Needs Focus",TRUE,"🔴 Off Track")')
    .setFontWeight('bold').setBackground('#FFFFFF')
    .setHorizontalAlignment('center').setVerticalAlignment('middle');
  sh.getRange(48, 8, 3, 6).setBorder(true, true, true, true, false, false,
    THEME.border, SpreadsheetApp.BorderStyle.SOLID);

  /* ─────────── PRODUCTIVE TIME (rows 47–54, right block) ─────────── */
  // Productive = Programming + English + Exercises + Work (group rows 31, 32, 33, 35)

  sectionBar(sh, 47, 15, 20, '⚡ Productive Time');
  for (let wk = 0; wk < 4; wk++) {
    const r = 48 + wk;
    const L = colA1(3 + wk);                    // C..F = Week 1..4
    sh.setRowHeight(r, 25);
    sh.getRange(r, 15, 1, 2).merge().setValue('Week ' + (wk + 1))
      .setFontWeight('bold').setBackground('#FFFFFF').setVerticalAlignment('middle');
    sh.getRange(r, 17, 1, 2).merge()
      .setFormula('=' + L + '31+' + L + '32+' + L + '33+' + L + '35')
      .setNumberFormat('0.0" h"').setFontWeight('bold').setBackground('#FFFFFF')
      .setHorizontalAlignment('center').setVerticalAlignment('middle');
    sh.getRange(r, 19, 1, 2).merge()
      .setFormula('=IFERROR(SPARKLINE($Q$' + r + ',{"charttype","bar";"max",MAX($Q$48:$Q$51)+0.0001;"color1","#0D9488"}),"")')
      .setBackground('#FFFFFF').setVerticalAlignment('middle');
  }
  const prodRows = [
    [52, 'Σ Month',    '=SUM($Q$48:$Q$51)', '0.0" h"', THEME.totalRow],
    [53, '⚡ Avg / Day', '=$Q$52/28',        '0.00" h"', '#FFFFFF'],
    [54, '🏅 Best Week', '=IFERROR("Week "&MATCH(MAX($Q$48:$Q$51),$Q$48:$Q$51,0),"—")', '@', '#FFFFFF'],
  ];
  prodRows.forEach(pr => {
    sh.setRowHeight(pr[0], 25);
    sh.getRange(pr[0], 15, 1, 2).merge().setValue(pr[1])
      .setFontWeight('bold').setBackground(pr[4]).setVerticalAlignment('middle');
    sh.getRange(pr[0], 17, 1, 2).merge().setFormula(pr[2]).setNumberFormat(pr[3])
      .setFontWeight('bold').setBackground(pr[4])
      .setHorizontalAlignment('center').setVerticalAlignment('middle');
    sh.getRange(pr[0], 19, 1, 2).merge().setBackground(pr[4]);
  });
  sh.getRange(48, 15, 7, 6).setBorder(true, true, true, true, true, true,
    THEME.border, SpreadsheetApp.BorderStyle.SOLID);

  /* ─────────── MONTHLY REFLECTION (rows 155–185) ─────────── */

  sectionBar(sh, 155, 2, 10, '🗓️ Monthly Reflection');
  const monthlyRefl = ['🏆 Biggest Achievement', '⚠️ Biggest Mistake', '📈 Habits That Improved',
                       '📉 Habits That Hurt My Productivity', '🎯 Goals for Next Month', '📝 Notes'];
  monthlyRefl.forEach((t, i) => {
    const r = 157 + i * 5;
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
  sh.getRange(188, 2).setValue('Metric').setFontColor(THEME.bg);
  sh.getRange(188, 3).setValue('Score').setFontColor(THEME.bg);
  sh.getRange(189, 2).setValue('Productivity').setFontColor(THEME.bg);
  sh.getRange(189, 3).setFormula('=$H$48').setFontColor(THEME.bg);

  /* ─────────── MONTHLY ANALYTICS — 11 CHARTS (rows 57–153) ─────────── */
  // transposed helper columns: C codding, D learn-prog, E En-book, F En-listening,
  // G Run, H Gym, I work, J Meditation, K Setar, L Personal, M Wasted, N Sleep

  sectionBar(sh, 57, 2, 19, '📈 Monthly Analytics');
  const wkCat = 'B41:B45';
  addCharts(sh, [
    { title: '📊 Weekly Comparison by Group', ranges: ['B30:F38'], type: 'column',
      colors: ['#C7D2FE', '#818CF8', '#4F46E5', '#3730A3'], row: 58, col: 2, legend: 'bottom', vTitle: 'Hours' },
    { title: '🥧 Monthly Distribution by Group', ranges: ['B31:B38', 'G31:G38'], type: 'pie', headers: 0,
      colors: GROUPS.map(g => g.color), row: 58, col: 11, legend: 'right' },
    { title: '💻 Programming Progress — codding + learn-prog (W1→4)', ranges: [wkCat, 'C41:D45'], type: 'column',
      stacked: true, colors: ['#057c31', '#86EFAC'], row: 74, col: 2, legend: 'bottom', vTitle: 'Hours' },
    { title: '📚 English Progress — En-book + En-listening (W1→4)', ranges: [wkCat, 'E41:F45'], type: 'column',
      stacked: true, colors: ['#2563EB', '#93C5FD'], row: 74, col: 11, legend: 'bottom', vTitle: 'Hours' },
    { title: '🏋️ Exercises Progress — Run + Gym (W1→4)', ranges: [wkCat, 'G41:H45'], type: 'column',
      stacked: true, colors: ['#EA580C', '#FDBA74'], row: 90, col: 2, legend: 'bottom', vTitle: 'Hours' },
    { title: '🧘 Meditate Progress — Meditation + Setar (W1→4)', ranges: [wkCat, 'J41:K45'], type: 'column',
      stacked: true, colors: ['#8e029b', '#da87de'], row: 90, col: 11, legend: 'bottom', vTitle: 'Hours' },
    { title: '🧑‍💻 Work Trend', ranges: [wkCat, 'I41:I45'], type: 'line',
      colors: ['#89fd05'], row: 106, col: 2, vTitle: 'Hours' },
    { title: '😴 Sleep Trend', ranges: [wkCat, 'N41:N45'], type: 'line',
      colors: ['#4e4d44'], row: 106, col: 11, vTitle: 'Hours' },
    { title: '⌛ Wasted Time Trend', ranges: [wkCat, 'M41:M45'], type: 'line',
      colors: ['#ff1500'], row: 122, col: 2, vTitle: 'Hours' },
    { title: '⚡ Productive Hours by Week — which week won?', ranges: ['O48:O51', 'Q48:Q51'], type: 'column',
      headers: 0, colors: ['#0D9488'], row: 138, col: 2, vTitle: 'Hours' },
    { title: '🏆 Productivity Score', ranges: ['B188:C189'], gauge: true, headers: 1, row: 122, col: 11,
      opts: { min: 0, max: 100, redFrom: 0, redTo: 40, yellowFrom: 40, yellowTo: 70, greenFrom: 70, greenTo: 100 } },
  ]);

  // no frozen rows or columns anywhere
  sh.setFrozenRows(0);
  sh.setFrozenColumns(0);
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
