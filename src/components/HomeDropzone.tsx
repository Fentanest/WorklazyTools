import { FileUp, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { intakeFiles, type FileIntake, type IntakeCandidate } from "../app/fileIntake";
import { openInIsolatedTool } from "../app/openInIsolatedTool";
import { isolatedFileAccepts, type IsolatedReceiverId } from "../app/fileAccepts";
import { useGuardedNavigate, useMemoryHandoff } from "./AppShell";
import { useAppLanguage } from "../i18n/routing";
import { localizedPath } from "../i18n/languages";
import { withSiteBasePath } from "../app/siteBasePath";
import { openInOfficeEditor } from "../features/office-editor/openInOfficeEditor";
import { useClipboardImages } from "../features/image-studio/imageStudioShared";
import { Button } from "./ui/button";
import { useFileDropTarget } from "./FileDropProvider";
import { formatBytes } from "./ui";

export function HomeDropzone() {
  const { t } = useTranslation("common");
  const language = useAppLanguage();
  const sender = useMemoryHandoff();
  const request = useGuardedNavigate();
  const root = useRef<HTMLElement>(null);
  const selected = useRef<File[]>([]);
  const input = useRef<HTMLInputElement>(null);
  const generation = useRef(0);
  const [result, setResult] = useState<FileIntake>();
  const [files, setFiles] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => () => { generation.current++; }, []);
  const receive = async (incoming: File[], replace = false) => {
    const next = replace ? incoming : [...selected.current, ...incoming];
    const current = ++generation.current;
    setFailed(false); setBusy(true); setFiles([]); setResult(undefined);
    try { const value = await intakeFiles(next); if (current === generation.current) { setResult(value); selected.current = value.tooMany ? [] : next; setFiles(selected.current); } }
    catch { if (current === generation.current) { selected.current = []; setFailed(true); } }
    finally { if (current === generation.current) setBusy(false); }
  };
  useClipboardImages(next => { if (!busy) void receive(next); });
  useFileDropTarget({ element: () => root.current, label: () => t("home.dropzone.title"), accept: "", disabled: busy, receive: next => receive(next) });
  const open = async (item: IntakeCandidate) => {
    if (Object.hasOwn(isolatedFileAccepts, item.receiverId)) {
      const receiverId = item.receiverId as IsolatedReceiverId;
      const to = localizedPath(language, item.entryPath);
      request(to, async () => {
        setBusy(true); setFailed(false);
        try { await openInIsolatedTool(receiverId, item.files, withSiteBasePath(to, import.meta.env.BASE_URL)); return true; }
        catch { setFailed(true); setBusy(false); return false; }
      });
    } else if (item.receiverId === "office") {
      setBusy(true); setFailed(false);
      try { await openInOfficeEditor(item.files[0], withSiteBasePath(localizedPath(language, item.entryPath), import.meta.env.BASE_URL)); }
      catch { setFailed(true); setBusy(false); }
    } else sender.send({ ...item, receiverId: item.receiverId as import("../app/fileAccepts").ReceiverId, origin: "user-input", source: "home" });
  };
  return <section ref={root} className={`home-dropzone${dragging ? " is-dragging" : ""}`} aria-labelledby="home-drop-title" data-testid="home-dropzone"
    onDragOver={event => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)}
    onDrop={event => { event.preventDefault(); setDragging(false); if (!busy) void receive(Array.from(event.dataTransfer.files)); }}>
    <FileUp size={32} aria-hidden="true" />
    <h2 id="home-drop-title">{t("home.dropzone.title")}</h2><p>{t("home.dropzone.description")}</p>
    <input ref={input} type="file" multiple hidden aria-label={t("home.dropzone.choose")} onChange={event => { void receive(Array.from(event.target.files ?? [])); event.target.value = ""; }} />
    <Button type="button" disabled={busy} onClick={() => input.current?.click()}>{t(busy ? "home.dropzone.checking" : files.length ? "home.dropzone.add" : "home.dropzone.choose")}</Button>
    <small>{t("home.dropzone.local")}</small>
    <div aria-live="polite" className="home-drop-results">
      {result?.tooMany && <p role="alert">{t("home.dropzone.limit", { count: result.count })}</p>}
      {(failed || sender.reason) && <p role="alert">{t("home.dropzone.failed")}</p>}
      {!!files.length && <><div className="home-drop-summary"><strong>{t("home.dropzone.count", { count: files.length })}</strong><Button type="button" variant="ghost" size="icon-sm" aria-label={t("handoff.close")} onClick={() => { generation.current++; selected.current = []; setFiles([]); setResult(undefined); }}><X size={16} /></Button></div>
        <ul className="home-drop-files">{files.map((file, index) => <li key={index}><span>{file.name}</span><small>{formatBytes(file.size)}</small><Button type="button" variant="ghost" size="icon-sm" disabled={busy} aria-label={t("home.dropzone.remove", { name: file.name })} onClick={() => { void receive(files.filter((_, at) => at !== index), true); }}><X size={14} /></Button></li>)}</ul>
        {result?.groups.map((group, index) => <div className="home-drop-group" key={index} data-intake-kind={group.kind}>
          <strong>{t(`home.dropzone.groups.${group.kind}`)} · {group.files.length}</strong>
          {group.kind === "video" && <p>{t("home.dropzone.video")}</p>}
          <div className="home-drop-actions">{group.candidates.map(item => <Button key={item.receiverId} type="button" variant="outline" disabled={busy} data-receiver={item.receiverId} onClick={() => { void open(item); }}>{t(`home.dropzone.receivers.${item.receiverId}`)}</Button>)}
            {!group.candidates.length && <Link to={localizedPath(language, "/tools")}>{t("home.dropzone.allTools")}</Link>}</div>
          {group.hint && <p>{t(`home.dropzone.hints.${group.hint}`)}</p>}
        </div>)}
        {(result?.mixed || (result?.groups.length ?? 0) > 1) && <p className="home-drop-bundle-note">{t("home.dropzone.bundle")}</p>}
      </>}
    </div>
  </section>;
}
