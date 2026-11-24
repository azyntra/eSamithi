import { useEffect, useRef, useState, type FormEvent } from "react";
import { BookOpenText, FilePlus2, Headphones } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/EmptyState";
import { Field } from "@/components/form/Field";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { errorMessage } from "@/lib/api/errors";
import { formatDate } from "@/lib/format/dates";
import { todayIso } from "@/lib/format/dates";
import { useT } from "@/lib/i18n";
import { meetingRecordsApi } from "./api";
import { DraftEditor } from "./components/DraftEditor";
import { ReportDetail } from "./components/ReportDetail";
import { useInvalidateRecords, useMeetingRecords } from "./queries";
import { formatDuration, type RecordStatus } from "./types";

export interface MeetingRecordsView {
  year?: number;
  month?: number;
  status?: RecordStatus;
  report?: number;
  v?: number;
  edit?: number;
  create?: 1;
}

// Society → Meeting Records (docs/MEETING-MINUTES-REQUIREMENTS.md §4.1, §8.3).
// One page, three views chosen by the URL: the list, a report (?report=&v=),
// and a draft being prepared (?edit=). Meeting Minutes is the only category.
export function MeetingRecordsPage({
  view,
  onChange,
}: {
  view: MeetingRecordsView;
  onChange: (next: MeetingRecordsView, replace?: boolean) => void;
}) {
  const { t, lang, monthsLong } = useT();
  const status = view.status ?? "published";
  const list = useMeetingRecords({
    year: view.year,
    month: view.month,
    status,
  });
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (view.create) {
      setCreating(true);
      onChange({ ...view, create: undefined }, true);
    }
  }, [view, onChange]);

  const toList = () =>
    onChange({ year: view.year, month: view.month, status: view.status });

  if (view.edit) {
    return (
      <DraftEditor
        id={view.edit}
        onBack={toList}
        onPublished={(id) => onChange({ report: id })}
        onDiscarded={toList}
      />
    );
  }
  if (view.report) {
    return (
      <ReportDetail
        id={view.report}
        versionNo={view.v}
        onBack={toList}
        onVersion={(n) => onChange({ ...view, v: n }, true)}
        onEditDraft={(id) => onChange({ edit: id })}
      />
    );
  }

  const can = list.data?.can;
  const years = list.data?.years ?? [];
  const thisYear = new Date().getFullYear();
  const yearOptions = Array.from(
    new Set([thisYear, ...years, ...(view.year ? [view.year] : [])]),
  ).sort((a, b) => b - a);
  const items = list.data?.items ?? [];

  return (
    <>
      <PageHeader
        title={t("mm.title")}
        description={t("mm.subtitle")}
        actions={
          can?.publish ? (
            <Button onClick={() => setCreating(true)}>
              <FilePlus2 /> {t("mm.newMinutes")}
            </Button>
          ) : undefined
        }
      />

      {/* Meeting Minutes is the only category for now; the tab names it and
          the panel holds the list, so the tab's aria-controls has a target */}
      <Tabs value="minutes">
        <TabsList className="mb-4">
          <TabsTrigger value="minutes">{t("mm.categoryMinutes")}</TabsTrigger>
        </TabsList>
        <TabsContent value="minutes">
          <div className="mb-4 flex flex-wrap items-end gap-3">
            <label className="grid gap-1 text-xs font-medium text-muted-foreground">
              {t("mm.year")}
              <NativeSelect
                value={view.year ?? ""}
                onChange={(e) =>
                  onChange(
                    {
                      ...view,
                      year: e.target.value ? Number(e.target.value) : undefined,
                    },
                    true,
                  )
                }
                className="w-32"
              >
                <option value="">{t("mm.allYears")}</option>
                {yearOptions.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </NativeSelect>
            </label>
            <label className="grid gap-1 text-xs font-medium text-muted-foreground">
              {t("mm.month")}
              <NativeSelect
                value={view.month ?? ""}
                onChange={(e) =>
                  onChange(
                    {
                      ...view,
                      month: e.target.value
                        ? Number(e.target.value)
                        : undefined,
                    },
                    true,
                  )
                }
                className="w-40"
              >
                <option value="">{t("mm.allMonths")}</option>
                {monthsLong.map((m, i) => (
                  <option key={m} value={i + 1}>
                    {m}
                  </option>
                ))}
              </NativeSelect>
            </label>
            {(can?.publish || can?.withdraw) && (
              <label className="grid gap-1 text-xs font-medium text-muted-foreground">
                {t("mm.status")}
                <NativeSelect
                  value={status}
                  onChange={(e) =>
                    onChange(
                      {
                        ...view,
                        status:
                          e.target.value === "published"
                            ? undefined
                            : (e.target.value as RecordStatus),
                      },
                      true,
                    )
                  }
                  className="w-40"
                >
                  <option value="published">{t("mm.statusPublished")}</option>
                  {can?.publish && (
                    <option value="drafts">{t("mm.statusDrafts")}</option>
                  )}
                  {can?.withdraw && (
                    <option value="withdrawn">{t("mm.statusWithdrawn")}</option>
                  )}
                </NativeSelect>
              </label>
            )}
          </div>

          {list.isPending ? (
            <div className="grid gap-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : list.isError ? (
            <EmptyState
              title={t("mm.loadFailed")}
              description={errorMessage(list.error)}
              action={
                <Button variant="secondary" onClick={() => void list.refetch()}>
                  {t("common.retry")}
                </Button>
              }
            />
          ) : items.length === 0 ? (
            <EmptyState
              icon={<BookOpenText />}
              title={status === "drafts" ? t("mm.noDrafts") : t("mm.empty")}
              description={
                status === "published" ? t("mm.emptyBody") : undefined
              }
            />
          ) : (
            <Card className="overflow-hidden py-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("mm.meetingDate")}</TableHead>
                      <TableHead>{t("mm.reportTitle")}</TableHead>
                      <TableHead>
                        {status === "drafts" ? t("mm.status") : t("mm.version")}
                      </TableHead>
                      <TableHead>
                        {status === "drafts"
                          ? t("mm.lastSaved")
                          : t("mm.published")}
                      </TableHead>
                      <TableHead>{t("mm.author")}</TableHead>
                      <TableHead className="text-right">
                        {t("mm.pages")}
                      </TableHead>
                      <TableHead>{t("mm.recording")}</TableHead>
                      <TableHead className="text-right">
                        {t("mm.comments")}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((r) => (
                      <TableRow
                        key={`${r.id}-${r.version_no ?? "d"}`}
                        className="cursor-pointer"
                        onClick={() =>
                          onChange(
                            status === "drafts"
                              ? { edit: r.id }
                              : {
                                  report: r.id,
                                  v:
                                    status === "withdrawn"
                                      ? (r.version_no ?? undefined)
                                      : undefined,
                                },
                          )
                        }
                      >
                        <TableCell className="tnum whitespace-nowrap">
                          {formatDate(r.meeting_date, lang)}
                        </TableCell>
                        <TableCell>
                          <button
                            type="button"
                            className="text-left font-medium text-primary hover:underline"
                            onClick={(e) => {
                              e.stopPropagation();
                              onChange(
                                status === "drafts"
                                  ? { edit: r.id }
                                  : {
                                      report: r.id,
                                      v:
                                        status === "withdrawn"
                                          ? (r.version_no ?? undefined)
                                          : undefined,
                                    },
                              );
                            }}
                          >
                            {r.title}
                          </button>
                        </TableCell>
                        <TableCell>
                          {status === "drafts" ? (
                            <Badge variant="neutral">{t("mm.draft")}</Badge>
                          ) : (
                            <Badge
                              variant={
                                r.state === "withdrawn" ? "danger" : "outline"
                              }
                            >
                              {t("mm.versionN", { n: r.version_no ?? "—" })}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="tnum whitespace-nowrap">
                          {formatDate(
                            status === "drafts" ? r.updated_at : r.published_at,
                            lang,
                          )}
                        </TableCell>
                        <TableCell>{r.author_name ?? "—"}</TableCell>
                        <TableCell className="tnum text-right">
                          {r.page_count}
                        </TableCell>
                        <TableCell className="tnum whitespace-nowrap">
                          {r.has_audio ? (
                            <span className="inline-flex items-center gap-1">
                              <Headphones
                                className="size-3.5 text-primary"
                                aria-hidden="true"
                              />{" "}
                              {formatDuration(r.audio_ms)}
                            </span>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell className="tnum text-right">
                          {r.open_comment_count > 0 ? (
                            <Badge variant="warning">
                              {t("mm.openOfTotal", {
                                open: r.open_comment_count,
                                total: r.comment_count,
                              })}
                            </Badge>
                          ) : (
                            r.comment_count
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      <NewMinutesDialog
        open={creating}
        onOpenChange={setCreating}
        onCreated={(id) => onChange({ edit: id })}
      />
    </>
  );
}

function NewMinutesDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreated: (id: number) => void;
}) {
  const { t } = useT();
  const invalidate = useInvalidateRecords();
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // One ref per opening: a double click or retry creates one report
  const ref = useRef(crypto.randomUUID());
  useEffect(() => {
    if (open) {
      setTitle(t("mm.suggestMonthly"));
      setDate("");
      setError(null);
      ref.current = crypto.randomUUID();
    }
  }, [open, t]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return setError(t("mm.titleRequired"));
    if (!date) return setError(t("mm.dateRequired"));
    setBusy(true);
    try {
      const d = await meetingRecordsApi.create({
        client_ref: ref.current,
        title: title.trim(),
        meeting_date: date,
      });
      await invalidate();
      onOpenChange(false);
      toast.success(t("mm.draftCreated"));
      onCreated(d.report_id);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="contents" noValidate>
          <DialogHeader>
            <DialogTitle>{t("mm.newMinutes")}</DialogTitle>
            <DialogDescription>{t("mm.newMinutesDesc")}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <Field label={t("mm.reportTitle")} required>
              {({ id }) => (
                <Input
                  id={id}
                  autoFocus
                  value={title}
                  maxLength={200}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    setError(null);
                  }}
                />
              )}
            </Field>
            <Field label={t("mm.meetingDate")} required>
              {({ id }) => (
                <Input
                  id={id}
                  type="date"
                  max={todayIso()}
                  value={date}
                  onChange={(e) => {
                    setDate(e.target.value);
                    setError(null);
                  }}
                />
              )}
            </Field>
          </div>
          {error && (
            <p
              role="alert"
              className="rounded-lg bg-danger-soft px-3 py-2 text-sm font-medium text-danger"
            >
              {error}
            </p>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={busy}
            >
              {t("common.cancel")}
            </Button>
            <Button type="submit" loading={busy}>
              {t("mm.createDraft")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
