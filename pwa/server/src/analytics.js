/**
 * Productivity score logic ported from premium-time-tracker.gs
 * Score out of 100 based on monthly group totals vs configurable goals.
 */

export function calculateProductivityScore(groupHours, goals) {
  const {
    programming = 0,
    english = 0,
    exercises = 0,
    meditate = 0,
    work = 0,
    personal = 0,
    sleep = 0,
    wasted = 0,
  } = groupHours;

  const {
    goalProgramming = 60,
    goalEnglish = 30,
    goalExercise = 20,
    goalMeditation = 15,
    goalWork = 80,
    goalPersonal = 30,
    idealSleep = 8,
    wastedLimit = 40,
  } = goals;

  const daysInPeriod = goals.daysInPeriod ?? 28;
  const avgSleepPerDay = sleep / daysInPeriod;

  const score = Math.round(Math.max(0,
    Math.min(1, programming / goalProgramming) * 25 +
    Math.min(1, english / goalEnglish) * 15 +
    Math.min(1, exercises / goalExercise) * 12 +
    Math.min(1, meditate / goalMeditation) * 8 +
    Math.min(1, work / goalWork) * 10 +
    Math.min(1, personal / goalPersonal) * 5 +
    Math.max(0, 1 - Math.abs(avgSleepPerDay - idealSleep) / 4) * 25 -
    Math.min(1, wasted / wastedLimit) * 25
  ));

  return score;
}

export function getScoreLabel(score) {
  if (score >= 85) return { label: 'Outstanding', emoji: '🌟' };
  if (score >= 70) return { label: 'Strong', emoji: '💪' };
  if (score >= 50) return { label: 'Decent', emoji: '🙂' };
  if (score >= 30) return { label: 'Needs Focus', emoji: '⚠️' };
  return { label: 'Off Track', emoji: '🔴' };
}

export function getScoreBreakdown(groupHours, goals) {
  const daysInPeriod = goals.daysInPeriod ?? 28;
  const avgSleep = groupHours.sleep / daysInPeriod;

  return [
    { name: 'Programming', points: Math.min(1, groupHours.programming / goals.goalProgramming) * 25, max: 25 },
    { name: 'English', points: Math.min(1, groupHours.english / goals.goalEnglish) * 15, max: 15 },
    { name: 'Exercises', points: Math.min(1, groupHours.exercises / goals.goalExercise) * 12, max: 12 },
    { name: 'Meditate', points: Math.min(1, groupHours.meditate / goals.goalMeditation) * 8, max: 8 },
    { name: 'Work', points: Math.min(1, groupHours.work / goals.goalWork) * 10, max: 10 },
    { name: 'Personal Tasks', points: Math.min(1, groupHours.personal / goals.goalPersonal) * 5, max: 5 },
    { name: 'Healthy Sleep', points: Math.max(0, 1 - Math.abs(avgSleep - goals.idealSleep) / 4) * 25, max: 25 },
    { name: 'Wasted Time Penalty', points: -Math.min(1, groupHours.wasted / goals.wastedLimit) * 25, max: -25 },
  ];
}

export const PRODUCTIVE_GROUPS = ['Programming', 'English', 'Exercises', 'Work'];

export function isProductiveGroup(groupName) {
  return PRODUCTIVE_GROUPS.includes(groupName);
}

export function minutesToHours(minutes) {
  return Math.round((minutes / 60) * 10) / 10;
}

export function blockIndexToTime(blockIndex) {
  const hours = Math.floor(blockIndex / 2);
  const minutes = (blockIndex % 2) * 30;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

export function timeToBlockIndex(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 2 + (m >= 30 ? 1 : 0);
}

export function formatDuration(minutes, format = '24h') {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (format === '12h') {
    const period = h >= 12 ? 'PM' : 'AM';
    const hour12 = h % 12 || 12;
    return m > 0 ? `${hour12}:${String(m).padStart(2, '0')} ${period}` : `${hour12} ${period}`;
  }
  return `${h}h ${m}m`;
}

export function aggregateByGroup(entries, activities) {
  const activityMap = new Map(activities.map(a => [a.id, a]));
  const groupTotals = {};

  for (const entry of entries) {
    const activity = activityMap.get(entry.activity_id);
    if (!activity) continue;
    const group = activity.group_name;
    groupTotals[group] = (groupTotals[group] || 0) + (entry.duration_minutes || 0);
  }

  return {
    programming: (groupTotals['Programming'] || 0) / 60,
    english: (groupTotals['English'] || 0) / 60,
    exercises: (groupTotals['Exercises'] || 0) / 60,
    meditate: (groupTotals['Meditate'] || 0) / 60,
    work: (groupTotals['Work'] || 0) / 60,
    personal: (groupTotals['Personal Tasks'] || 0) / 60,
    sleep: (groupTotals['Sleep'] || 0) / 60,
    wasted: (groupTotals['Wasted Time'] || 0) / 60,
    byGroup: Object.fromEntries(
      Object.entries(groupTotals).map(([k, v]) => [k, v / 60])
    ),
  };
}

export function aggregateByActivity(entries) {
  const totals = {};
  for (const entry of entries) {
    totals[entry.activity_id] = (totals[entry.activity_id] || 0) + (entry.duration_minutes || 0);
  }
  return totals;
}

export function getProductiveMinutes(entries, activities) {
  const activityMap = new Map(activities.map(a => [a.id, a]));
  return entries.reduce((sum, e) => {
    const act = activityMap.get(e.activity_id);
    if (act?.productive) return sum + (e.duration_minutes || 0);
    return sum;
  }, 0);
}

export function getBreakMinutes(entries, activities) {
  const activityMap = new Map(activities.map(a => [a.id, a]));
  return entries.reduce((sum, e) => {
    const act = activityMap.get(e.activity_id);
    if (act?.group_name === 'Wasted Time' || act?.group_name === 'Sleep') return sum + (e.duration_minutes || 0);
    return sum;
  }, 0);
}
