package com.se201411.mvc.backend.service.impl;

import com.se201411.mvc.backend.domain.dataset.DatasetManifest;
import com.se201411.mvc.backend.exception.ApiException;
import com.se201411.mvc.backend.repository.DatasetMetadataRepository;
import com.se201411.mvc.backend.service.TemporalSelectionService;
import com.se201411.mvc.backend.service.model.CalendarGranularity;
import com.se201411.mvc.backend.service.model.Coverage;
import com.se201411.mvc.backend.service.model.TemporalSelection;
import com.se201411.mvc.backend.service.model.TemporalSelectionCriteria;
import com.se201411.mvc.backend.service.model.TemporalSelectionType;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.Year;
import java.time.YearMonth;
import java.time.temporal.ChronoUnit;

@Service
public final class TemporalSelectionServiceImpl implements TemporalSelectionService {

	private final LocalDate datasetStart;
	private final LocalDate datasetEnd;

	public TemporalSelectionServiceImpl(DatasetMetadataRepository metadataRepository) {
		DatasetManifest manifest = metadataRepository.getManifest();
		this.datasetStart = LocalDate.parse(manifest.dateRange().start());
		this.datasetEnd = LocalDate.parse(manifest.dateRange().end());
	}

	@Override
	public TemporalSelection resolveMap(TemporalSelectionCriteria criteria) {
		if (criteria == null) {
			throw ApiException.invalidTemporalSelector(
					"Select exactly one of date, year, year plus month, or year plus pentad");
		}
		boolean hasDate = criteria.date() != null;
		boolean hasYear = criteria.year() != null;
		boolean hasMonth = criteria.month() != null;
		boolean hasPentad = criteria.pentad() != null;

		if (hasDate) {
			if (hasYear || hasMonth || hasPentad) {
				throw invalidCombination();
			}
			ensureExactDateSupported(criteria.date());
			return selection(TemporalSelectionType.DATE, criteria.date(), null, null, null,
					criteria.date(), criteria.date());
		}
		if (!hasYear || (hasMonth && hasPentad)) {
			throw invalidCombination();
		}
		validateSupportedYear(criteria.year());
		if (hasMonth) {
			DateRange range = monthRange(criteria.year(), criteria.month());
			return selection(TemporalSelectionType.MONTH, null, criteria.year(), criteria.month(), null,
					range.startDate(), range.endDate());
		}
		if (hasPentad) {
			DateRange range = pentadRange(criteria.year(), criteria.pentad());
			return selection(TemporalSelectionType.PENTAD, null, criteria.year(), null, criteria.pentad(),
					range.startDate(), range.endDate());
		}
		LocalDate start = LocalDate.of(criteria.year(), 1, 1);
		LocalDate end = LocalDate.of(criteria.year(), 12, 31);
		return selection(TemporalSelectionType.YEAR, null, criteria.year(), null, null, start, end);
	}

	@Override
	public Coverage coverage(LocalDate requestedStart, LocalDate requestedEnd) {
		if (requestedStart == null || requestedEnd == null || requestedEnd.isBefore(requestedStart)) {
			throw ApiException.invalidParameter("requested date range is invalid");
		}
		int expected = Math.toIntExact(ChronoUnit.DAYS.between(requestedStart, requestedEnd) + 1);
		LocalDate coveredStart = requestedStart.isBefore(datasetStart) ? datasetStart : requestedStart;
		LocalDate coveredEnd = requestedEnd.isAfter(datasetEnd) ? datasetEnd : requestedEnd;
		if (coveredEnd.isBefore(coveredStart)) {
			return new Coverage(requestedStart, requestedEnd, null, null, expected, 0, expected, true);
		}
		int covered = Math.toIntExact(ChronoUnit.DAYS.between(coveredStart, coveredEnd) + 1);
		return new Coverage(
				requestedStart,
				requestedEnd,
				coveredStart,
				coveredEnd,
				expected,
				covered,
				expected - covered,
				covered < expected);
	}

	@Override
	public DateRange period(int year, CalendarGranularity granularity, int period) {
		validateSupportedYear(year);
		if (granularity == null) {
			throw ApiException.invalidParameter("granularity must be month or pentad");
		}
		return switch (granularity) {
			case MONTH -> monthRange(year, period);
			case PENTAD -> pentadRange(year, period);
		};
	}

	@Override
	public void validateSupportedYear(int year) {
		int firstYear = datasetStart.getYear();
		int lastYear = datasetEnd.getYear();
		if (year < firstYear || year > lastYear) {
			throw ApiException.invalidParameter(
					"year must be between " + firstYear + " and " + lastYear);
		}
	}

	@Override
	public LocalDate datasetStartDate() {
		return datasetStart;
	}

	@Override
	public LocalDate datasetEndDate() {
		return datasetEnd;
	}

	private TemporalSelection selection(
			TemporalSelectionType type,
			LocalDate date,
			Integer year,
			Integer month,
			Integer pentad,
			LocalDate start,
			LocalDate end) {
		return new TemporalSelection(type, date, year, month, pentad, start, end, coverage(start, end));
	}

	private DateRange monthRange(int year, int month) {
		if (month < 1 || month > 12) {
			throw ApiException.invalidParameter("month must be between 1 and 12");
		}
		YearMonth value = YearMonth.of(year, month);
		return new DateRange(value.atDay(1), value.atEndOfMonth());
	}

	private DateRange pentadRange(int year, int pentad) {
		if (pentad < 1 || pentad > 73) {
			throw ApiException.invalidParameter("pentad must be between 1 and 73");
		}
		int startDay = (pentad - 1) * 5 + 1;
		int lastDay = Year.isLeap(year) ? 366 : 365;
		int endDay = pentad == 73 ? lastDay : startDay + 4;
		return new DateRange(LocalDate.ofYearDay(year, startDay), LocalDate.ofYearDay(year, endDay));
	}

	private void ensureExactDateSupported(LocalDate date) {
		if (date.isBefore(datasetStart) || date.isAfter(datasetEnd)) {
			throw ApiException.dateOutsideDatasetRange(
					"date must be between " + datasetStart + " and " + datasetEnd);
		}
	}

	private static ApiException invalidCombination() {
		return ApiException.invalidTemporalSelector(
				"Select exactly one of date, year, year plus month, or year plus pentad");
	}
}
