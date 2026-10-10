export const EGG_PETTING_EXPERIENCE_FRACTION = 0.01

/** Each stroke earns one percent of the egg's requirement, capped at hatching. */
export const eggPettingExperience = (gauge: number, threshold: number): number =>
  Math.min(threshold, gauge + Math.ceil(threshold * EGG_PETTING_EXPERIENCE_FRACTION))
