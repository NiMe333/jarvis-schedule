export const WISE_ORIGIN = 'https://www.wise-tt.com';
export const WISE_BASE = '/web/feri';
export const CACHE_MS = Number(process.env.CACHE_MS || 8 * 60 * 1000);
export const PORT = Number(process.env.PORT || 4173);
export const DEFAULT_COURSES = ['12889', '12904', '12965', '13007', '13038', '13042'];
export const PROFILE = 'FERI · RIT VS · 1. stopnja · 3. letnik';
export const COURSE_ABBREVIATIONS = {
  '12889': 'ATURP', '12904': 'DF', '12965': 'NRS',
  '13007': 'PPR', '13038': 'RGA', '13042': 'RM'
};
