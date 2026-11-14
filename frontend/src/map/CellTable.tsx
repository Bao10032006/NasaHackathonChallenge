import type { MapCellValue } from '../api/types'
import { DataTable } from '../components/DataTable'
import { OriginBadge, ValueWithStatus } from '../components/ui'
import { SOURCE_LABEL, formatInteger } from '../lib/format'

/** Keyboard/screen-reader alternative to clicking map cells; also the raw numbers of the map. */
export function CellTable({
  cells,
  exactDate,
  selectedCellId,
  onSelectCell,
}: {
  cells: MapCellValue[]
  exactDate: boolean
  selectedCellId: string | null
  onSelectCell: (cellId: string) => void
}) {
  return (
    <details className="table-details">
      <summary>Bảng số liệu theo ô ({cells.length} ô)</summary>
      <DataTable label="Giá trị snpp_eq theo ô lưới">
        <thead>
          <tr>
            <th scope="col">Ô</th>
            <th scope="col">Tâm (vĩ, kinh)</th>
            <th scope="col" className="num-col">snpp_eq</th>
            <th scope="col">Nguồn gốc</th>
            <th scope="col">Đầy đủ</th>
            {exactDate && <th scope="col">Vệ tinh</th>}
            {exactDate && <th scope="col" className="num-col">Phát hiện đầu vào</th>}
          </tr>
        </thead>
        <tbody>
          {cells.map((cell) => (
            <tr key={cell.cellId} aria-selected={cell.cellId === selectedCellId}>
              <th scope="row">
                <button
                  type="button"
                  className="link-button"
                  aria-pressed={cell.cellId === selectedCellId}
                  onClick={() => onSelectCell(cell.cellId)}
                >
                  {cell.cellId}
                </button>
              </th>
              <td className="num">{cell.center.lat}, {cell.center.lon}</td>
              <td className="num-col"><ValueWithStatus value={cell.value} status={cell.valueStatus} /></td>
              <td><OriginBadge origin={cell.origin} long /></td>
              <td>{cell.partial ? 'Chưa đầy đủ' : 'Đủ'}</td>
              {exactDate && <td>{cell.source ? SOURCE_LABEL[cell.source] : '—'}</td>}
              {exactDate && <td className="num-col">{formatInteger(cell.inputObservationCount)}</td>}
            </tr>
          ))}
        </tbody>
      </DataTable>
    </details>
  )
}
