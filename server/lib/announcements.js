// How long a notice stays in the member app (requested 22 Nov 2026: old
// notices must drop out of the app by themselves).
//
//   death    7 days after the funeral; 14 days after posting if no funeral date
//   meeting  until the day after the meeting
//   general  21 days (3 weeks) after posting
//
// Staff can pick their own "show until" date on any notice (show_until); NULL
// means "use the rule above", so the date follows a funeral or meeting that is
// moved later. Nothing is deleted: expired notices stay in the staff Message
// Portal as the society's record, marked as no longer shown.
const RETENTION = {
  deathAfterFuneralDays: 7,
  deathWithoutDateDays: 14,
  meetingAfterDays: 1,
  generalDays: 21
};

// The last day (inclusive) a notice is shown, as a SQL DATE expression over an
// `announcements` row aliased as `a`.
const VISIBLE_UNTIL_SQL = `COALESCE(a.show_until, CASE a.type
    WHEN 'death' THEN COALESCE(DATE_ADD(a.funeral_date, INTERVAL ${RETENTION.deathAfterFuneralDays} DAY),
                               DATE_ADD(DATE(a.created_at), INTERVAL ${RETENTION.deathWithoutDateDays} DAY))
    WHEN 'meeting' THEN DATE_ADD(COALESCE(a.event_date, DATE(a.created_at)), INTERVAL ${RETENTION.meetingAfterDays} DAY)
    ELSE DATE_ADD(DATE(a.created_at), INTERVAL ${RETENTION.generalDays} DAY)
  END)`;

module.exports = { RETENTION, VISIBLE_UNTIL_SQL };
