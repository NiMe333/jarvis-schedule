export const WISE_ORIGIN = 'https://www.wise-tt.com';
export const WISE_BASE = '/web/feri';
export const CACHE_MS = Number(process.env.CACHE_MS || 8 * 60 * 1000);
export const PORT = Number(process.env.PORT || 4173);
export const DEFAULT_COURSES = [];
export const PROFILE = 'FERI · Wise Timetable';
export const COURSE_ABBREVIATIONS = {
  '12889': 'ATURP', '12904': 'DF', '12965': 'NRS',
  '13007': 'PPR', '13038': 'RGA', '13042': 'RM'
};
export const FETCH_WEEKS_AHEAD = 1;
export const FETCH_WEEKS_BEHIND = 0;
