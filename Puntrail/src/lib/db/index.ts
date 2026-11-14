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
  listAllBurials,
  listBurialsByPlot,
  getBurialById,
  createBurial,
  updateBurialStatus,
  upsertBurial,
  deleteBurial,
  countBurialsByCemetery,
} from './burials';