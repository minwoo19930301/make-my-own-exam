import { useEffect, useMemo, useState } from "react";
import { useStored } from "./store.js";
import { Build } from "./Build.jsx";
import { Practice } from "./Practice.jsx";
import { Insights } from "./Insights.jsx";
import { HistoryDialog, SettingsDialog } from "./Dialogs.jsx";
import { finalize } from "./build.js";

const TABS = [
  { value: "build", label: "Build" },
  { value: "practice", label: "Practice" },
  { value: "insights", label: "Insights" },
];

const Icon = ({ d }) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>;

export default function App() {
  const [health, setHealth] = useState(null);
  const [exams, setExams] = useStored("mmoe.exams", {});
  const [currentId, setCurrentId] = useStored("mmoe.current", "");
  const [history, setHistory] = useStored("mmoe.history", []);
  const [tab, setTab] = useStored("mmoe.view", "build");
  const [questionId, setQuestionId] = useStored("mmoe.question", "");
  const [dialog, setDialog] = useState(null);

  const [imported, setImported] = useState(null);
  // Links made by the MCP server or a share: ?exam=ID adds the exam, ?grade=ID also shows that graded answer.
  useEffect(() => {
    const q = new URLSearchParams(location.search);
    const examId = q.get("exam"), gradeId = q.get("grade");
    if (!examId && !gradeId) return;
    window.history.replaceState(null, "", "/");
    fetch(`/api/share?${examId ? `exam=${examId}` : `grade=${gradeId}`}`).then((r) => r.json()).then((d) => {
      if (!d.exam) return;
      const e = finalize({ ...d.exam, id: `shared-${examId || d.examId}` });
      setExams((all) => ({ ...all, [e.id]: all[e.id] || e }));
      setCurrentId(e.id);
      if (gradeId && d.grade) {
        setHistory((h) => (h.some((x) => x.gradeId === gradeId) ? h : [...h, { examId: e.id, gradeId, questionId: d.questionId, score: d.grade.score, min: d.grade.min, max: d.grade.max, dimensions: d.grade.dimensions, task: d.grade.task.status, at: d.at, gradedBy: d.gradedBy }]));
        setImported({ examId: e.id, questionId: d.questionId, answer: d.answer, grade: d.grade, gradedBy: d.gradedBy });
        setQuestionId(d.questionId);
        setTab("practice");
      } else setTab("build");
    }).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetch("/api/health").then((r) => r.json()).then(setHealth).catch(() => setHealth({ demoKey: false, models: ["muse-spark-1.3"], defaultModel: "muse-spark-1.3" }));
  }, []);

  const exam = exams[currentId] || null;
  const examHistory = useMemo(() => history.filter((h) => h.examId === currentId), [history, currentId]);
  const go = (t) => { setTab(t); window.scrollTo(0, 0); };
  const save = (e) => { setExams((all) => ({ ...all, [e.id]: e })); setCurrentId(e.id); };
  const pick = (id) => { setQuestionId(id); go("practice"); };
  const remove = (id) => {
    setExams((all) => { const { [id]: _, ...rest } = all; return rest; });
    setHistory((h) => h.filter((x) => x.examId !== id));
    if (id === currentId) setCurrentId("");
  };
  const view = TABS.some((t) => t.value === tab) && (exam || tab === "build") ? tab : "build";

  return (
    <>
      <header className="topbar">
        <a className="logo" href="/" onClick={(e) => { e.preventDefault(); go("build"); }}>Make My Own Exam</a>
        <nav className="navtabs" aria-label="Sections">
          {TABS.map((t) => (
            <button key={t.value} type="button" disabled={!exam && t.value !== "build"} className={`navtab ${view === t.value ? "on" : ""}`} aria-current={view === t.value ? "page" : undefined} onClick={() => go(t.value)}>{t.label}</button>
          ))}
        </nav>
        <div className="topbar-end">
          <button type="button" className="round" aria-label="History" onClick={() => setDialog("history")}><Icon d="M12 8v4l3 2M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5" /></button>
          <button type="button" className="round" aria-label="Settings" onClick={() => setDialog("settings")}><Icon d="M4 6h16M4 12h16M4 18h16" /></button>
        </div>
      </header>
      <main className="wrap">
        {view === "build" && <Build exams={exams} exam={exam} onSave={(e) => save(e)} onOpen={(id) => { setCurrentId(id); }} onRemove={remove} onPractice={() => go("practice")} health={health} />}
        {view === "practice" && exam && <Practice key={exam.id} exam={exam} imported={imported?.examId === exam.id ? imported : null} questionId={questionId} history={examHistory} onPick={setQuestionId} onSaveExam={save} onScored={(row) => setHistory((h) => [...h, { ...row, examId: exam.id }])} />}
        {view === "insights" && exam && <Insights exam={exam} history={examHistory} onPick={pick} />}
      </main>
      <footer className="foot">
        Make My Own Exam builds practice material from public links you supply and keeps it in your browser. Questions are quoted from those sources for study; check each source's terms before sharing what you build.
        Exam names belong to their owners, and this app is not affiliated with any test maker. Scores are practice estimates.
      </footer>
      <SettingsDialog isOpen={dialog === "settings"} onClose={() => setDialog(null)} health={health} />
      <HistoryDialog isOpen={dialog === "history"} onClose={() => setDialog(null)} exams={exams} history={history} onPick={(examId, id) => { setDialog(null); setCurrentId(examId); pick(id); }} />
    </>
  );
}
