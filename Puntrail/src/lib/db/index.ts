export { getDb, isFtsAvailable, closeDb } from './client';

export {
  listCemeteries,
  getCemeteryById,
  upsertCemetery,
  deleteCemetery,
  countCemeteries,
} from './cemeteries';

export {
  listSectionsByCemetery,
  getSectionById,
  upsertSection,
  deleteSection,
  countSectionsByCemetery,
} from './sections';

export {
  listPlotsByCemetery,
  listPlotsBySection,
  listPlotsInBbox,
  getPlotById,
  getPlotByIdentifier,
  upsertPlot,
  deletePlot,
  countPlotsByCemetery,
} from './plots';

export {
  normalizeName,
  searchBurials,
  listBurialsByPlot,
  getBurialById,
  upsertBurial,
  deleteBurial,
  countBurialsByCemetery,
} from './burials';
