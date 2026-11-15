import type { Daily, Details, Grid, MapCell, Metadata } from './api'
import { cellActivityStatus, CoverageNotice, ResourceNotice } from './display'
import { useI18n } from '../i18n'
import { DatasetLimitations } from './DatasetNotes'
import { SourceList } from './PeriodSummary'
import type { Resource } from './useResource'

export function GridCellDetails({ cellId, resource, mapCell, period, daily, onClose }: {
  cellId: string
  resource: Resource<Details>
  mapCell?: MapCell
  period?: Grid['temporalSelector']
  daily: Resource<Daily>
  onClose: () => void
}) {
  const { t, dateLabel, detectionLabel, number } = useI18n()
  const data = resource.data ?? mapCell
  const temporal = resource.data?.temporalSelector ?? period
  const composition = resource.data?.sourceComposition ?? daily.data?.sourceComposition
  const sensorCount = new Set(composition?.filter((entry) => entry.contributingCellDayCount > 0).map((entry) => entry.source)).size
  const range = temporal && (temporal.startDate === temporal.endDate
    ? dateLabel(temporal.startDate) : `${dateLabel(temporal.startDate)} – ${dateLabel(temporal.endDate)}`)
  return (
    <section className="panel cell-details" aria-labelledby="cell-details-title">
      <div className="panel-heading">
        <h2 id="cell-details-title">{t('cellDetails', { id: cellId })}</h2>
        <button className="quiet" type="button" onClick={onClose}>{t('closeDetails')}</button>
      </div>
      {resource.error !== 'ENDPOINT_UNAVAILABLE' && <ResourceNotice resource={resource} />}
      {data && <>
        <dl>
          {range && <><dt>{t('timeRange')}</dt><dd>{range}</dd></>}
          <dt>{t('value')}</dt><dd>{detectionLabel(data.value, data.valueStatus)}</dd>
          <dt>{t('status')}</dt><dd>{t(cellActivityStatus(data))}</dd>
          <dt>{t('valueOrigin')}</dt>
          <dd>{sensorCount > 1 ? t('multipleSensors', { count: number(sensorCount) }) : t(data.origin ?? 'unknownOrigin')}</dd>
        </dl>
        {temporal?.coverage.partial && <CoverageNotice coverage={temporal.coverage} />}
        {composition && composition.length > 0 && <details>
          <summary>{t('satelliteSources')}</summary>
          <SourceList items={composition} />
        </details>}
      </>}
      <ResourceNotice resource={daily} />
    </section>
  )
}

export function DataNotes({ metadata }: { metadata?: Metadata }) {
  const { t, dateLabel } = useI18n()
  return (
    <details className="panel data-notes" id="data-notes">
      <summary>{t('dataNotes')}</summary>
      <dl>
        <dt>{t('source')}</dt>
        <dd><a href="https://firms.modaps.eosdis.nasa.gov/">NASA FIRMS</a> · {t('instruments')}</dd>
        <dt>{t('calculation')}</dt>
        <dd>{t('metricMethod')}</dd>
        <dt>{t('gridCell')}</dt>
        <dd>{t('gridDescription')}</dd>
        <dt>{t('regions')}</dt>
        <dd>{t('regionMethod')}</dd>
        <dt>{t('dailyValues')}</dt>
        <dd>{t('dailyMethod')}</dd>
        <dt>{t('limitations')}</dt>
        <dd>{t('metricLimit')}</dd>
        {metadata && <>
          <dt>{t('dataThrough')}</dt><dd>{dateLabel(metadata.meta.dataThrough)}</dd>
          <dt>{t('versions')}</dt><dd>{metadata.meta.dataVersion} / {metadata.meta.modelVersion}</dd>
        </>}
      </dl>
      {metadata && <DatasetLimitations limitations={metadata.limitations} />}
    </details>
  )
}
