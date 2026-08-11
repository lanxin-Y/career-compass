// XP is based on estimated time: 1 day = 10 XP
function parseXP(timeframe) {
  if (!timeframe) return 10
  const str = timeframe.toLowerCase()
  const num = parseInt(str, 10) || 1
  if (str.includes('week')) return num * 7 * 10
  if (str.includes('day')) return num * 10
  if (str.includes('month')) return num * 30 * 10
  return 10
}

const COINS_PER_TASK = 10

const LEVELS = [
  { level: 1, title: 'Intern', minXP: 0 },
  { level: 2, title: 'Explorer', minXP: 150 },
  { level: 3, title: 'Strategist', minXP: 300 },
  { level: 4, title: 'Specialist', minXP: 600 },
  { level: 5, title: 'Architect', minXP: 1000 },
  { level: 6, title: 'Master', minXP: 1500 },
]

export function computeStats(allTasks) {
  const completedTasks = allTasks.filter((t) => t.is_completed)
  const xp = completedTasks.reduce((sum, t) => sum + parseXP(t.timeframe), 0)
  const coins = completedTasks.length * COINS_PER_TASK
  const level = [...LEVELS].reverse().find((l) => xp >= l.minXP) || LEVELS[0]
  const nextLevel = LEVELS.find((l) => l.minXP > xp)
  const progress = nextLevel
    ? (xp - level.minXP) / (nextLevel.minXP - level.minXP)
    : 1
  return {
    xp,
    coins,
    level: level.level,
    title: level.title,
    progress,
    completed: completedTasks.length,
    total: allTasks.length,
    nextXP: nextLevel ? nextLevel.minXP : level.minXP,
    minXP: level.minXP,
  }
}

export function getTaskXP(timeframe) {
  return parseXP(timeframe)
}
