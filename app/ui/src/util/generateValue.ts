const DAY_MILLIS = 24 * 60 * 60 * 1000

/**
 * Generates measurement values for a specific time.
 * @param period period of the generated data (days)
 * @param min minumum value
 * @param max maximum value excluding 0-1 random
 * @param time time for the generated value (millis)
 * @returns generated value
 */
function generateValue(
  period: number,
  min = 0,
  max = 40,
  time: number
): number {
  const dif = max - min
  // generate main value
  const periodValue =
    (dif / 4) *
    Math.sin((((time / DAY_MILLIS) % period) / period) * 2 * Math.PI)
  // generate secondary value, which is lowest at noon
  const dayValue =
    (dif / 4) *
    Math.sin(((time % DAY_MILLIS) / DAY_MILLIS) * 2 * Math.PI - Math.PI / 2)
  return (
    Math.trunc((min + dif / 2 + periodValue + dayValue + Math.random()) * 10) /
    10
  )
}

export const generateTemperature = generateValue.bind(undefined, 30, 0, 40)
export const generateHumidity = generateValue.bind(undefined, 90, 0, 99)
export const generatePressure = generateValue.bind(undefined, 20, 970, 1050)
export const generateCO2 = generateValue.bind(undefined, 1, 400, 3000)
export const generateTVOC = generateValue.bind(undefined, 1, 250, 2000)
