import "@fontsource/dm-sans/400.css";
import "@fontsource/dm-sans/500.css";
import "@fontsource/dm-sans/600.css";
import "@fontsource/dm-sans/700.css";
import "@fontsource/manrope/600.css";
import "@fontsource/manrope/700.css";
import "@fontsource/manrope/800.css";
import React, { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import {
  Sun,
  CalendarDays,
  Layers,
  Clock3,
  Plus,
  Search,
  Bell,
  Star,
  ChevronRight,
  Check,
  X,
  Paperclip,
  Repeat2,
  Users,
  LogOut,
  Trash2,
  ArrowUpRight,
  Flower2,
  Menu,
} from "lucide-react";
import "./style.css";
import { ListsHome, WorkspaceSettings } from "./workspaces.jsx";
import { isNativeDevice } from "./device-reminders.js";
import { ThemeButton } from "./themes.jsx";
import { Profile } from "./profile.jsx";
import {
  useDeviceReminders,
  clearDeviceReminders,
} from "./device-reminders.js";
import { NotificationSettings } from "./notification-settings.jsx";
import { api } from "./api.js";
// randomUUID requires HTTPS; draft identifiers must also work on a local Wi-Fi URL.
const newId = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
const date = (d) =>
  d
    ? new Date(d).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      })
    : "Anytime";
const local = (d) =>
  d
    ? new Date(new Date(d).getTime() - new Date(d).getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16)
    : "";
const blank = (list) => ({
  list,
  title: "",
  notes: "",
  subtasks: [],
  star: false,
  done: false,
  priority: 0,
  due: null,
  repeat: "none",
  files: [],
  reminders: [],
});
function App() {
  const [state, setState] = useState(null),
    [auth, setAuth] = useState("login"),
    [error, setError] = useState(""),
    [view, setView] = useState(() =>
      isNativeDevice() || matchMedia("(max-width: 1000px)").matches
        ? "Lists"
        : "Today",
    ),
    [workspaceId, setWorkspaceId] = useState(null),
    [query, setQuery] = useState(""),
    [sort, setSort] = useState("date"),
    [edit, setEdit] = useState(null),
    [modal, setModal] = useState(null),
    [sidebar, setSidebar] = useState(false),
    [compact, setCompact] = useState(
      () => matchMedia("(max-width: 1000px)").matches,
    ),
    [busy, setBusy] = useState(false),
    [toast, setToast] = useState("");
  const device = useDeviceReminders(state);
  useEffect(() => {
    if (
      state &&
      !["Lists", "Today", "Scheduled", "All", "Overdue", "Starred"].includes(
        view,
      ) &&
      !state.lists.some((l) => l.id === view && l.workspace === workspaceId)
    )
      setView("Lists");
  }, [state, view, workspaceId]);
  function signedOut() {
    setState(null);
    setWorkspaceId(null);
    setEdit(null);
    setModal(null);
    setSidebar(false);
    setView(
      isNativeDevice() || matchMedia("(max-width: 1000px)").matches
        ? "Lists"
        : "Today",
    );
  }

  useEffect(() => {
    if (state && workspaceId)
      localStorage.setItem("tada.workspace." + state.user.id, workspaceId);
  }, [workspaceId, state?.user?.id]);
  function switchWorkspace(id) {
    setWorkspaceId(id);
    setView("Lists");
    setQuery("");
    setEdit(null);
    setModal(null);
    setSidebar(false);
  }
  useEffect(() => {
    const media = matchMedia("(max-width: 1000px)");
    const change = () => {
      setCompact(media.matches);
      setSidebar(false);
    };
    media.addEventListener("change", change);
    return () => media.removeEventListener("change", change);
  }, []);
  useEffect(() => {
    if (!edit && !modal && !(compact && sidebar)) return;
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const escape = (e) => {
      if (e.key === "Escape") {
        if (modal) setModal(null);
        else if (edit) setEdit(null);
        else setSidebar(false);
      }
    };
    window.addEventListener("keydown", escape);
    return () => {
      document.body.style.overflow = old;
      window.removeEventListener("keydown", escape);
    };
  }, [edit, modal, sidebar, compact]);
  async function load() {
    try {
      let s = await api("/state");
      setWorkspaceId((current) => {
        const saved =
          current || localStorage.getItem("tada.workspace." + s.user.id);
        return (
          s.workspaces?.find((w) => w.id === saved)?.id || s.workspaces?.[0]?.id
        );
      });
      setState(s);
      return s;
    } catch (e) {
      if (e.message === "Please sign in") {
        clearDeviceReminders().catch(() => {});
        signedOut();
      } else setError(e.message);
    }
  }
  useEffect(() => {
    load();
    let i = setInterval(load, 15000);
    return () => clearInterval(i);
  }, []);
  async function act(fn) {
    setError("");
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    if (state && new URLSearchParams(location.search).has("invite")) {
      let token = new URLSearchParams(location.search).get("invite");
      history.replaceState({}, "", "/");
      act(async () => {
        await api("/invites/accept", { token });
        await load();
        setToast("You joined the shared list");
      });
    }
  }, [!!state]);
  useEffect(() => {
    if (toast) {
      let t = setTimeout(() => setToast(""), 4000);
      return () => clearTimeout(t);
    }
  }, [toast]);
  async function enablePush() {
    if (!window.isSecureContext)
      throw Error(
        "Browser notifications require HTTPS. For local testing on this computer, open http://localhost:3001. Phones need an HTTPS address.",
      );
    if (!("serviceWorker" in navigator) || !("PushManager" in window))
      throw Error(
        "Push is not supported in this browser. The notification inbox still works.",
      );
    let permission = await Notification.requestPermission();
    if (permission !== "granted")
      throw Error(
        "Allow notifications in your browser settings to enable push.",
      );
    let config = await api("/push/config");
    if (!config.publicKey)
      throw Error("Your server administrator must configure VAPID keys first.");
    let reg = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;
    const raw = config.publicKey.replace(/-/g, "+").replace(/_/g, "/");
    const key = Uint8Array.from(
      atob(raw + "=".repeat((4 - (raw.length % 4)) % 4)),
      (c) => c.charCodeAt(0),
    );
    let sub = await reg.pushManager.getSubscription();
    if (sub) {
      const previous = new Uint8Array(sub.options.applicationServerKey || []);
      if (
        previous.length !== key.length ||
        previous.some((b, i) => b !== key[i])
      ) {
        await api("/push/unsubscribe", { endpoint: sub.endpoint });
        await sub.unsubscribe();
        sub = null;
      }
    }
    if (!sub)
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: key,
      });
    await api("/push/subscribe", sub.toJSON());
    setToast("Browser notifications enabled");
  }
  const saveTask = async (t, close = true) => {
    let out;
    if (t.id) out = await api("/tasks/" + t.id, t, "PUT");
    else {
      const form = new FormData();
      const { files, reminders, ...task } = t;
      form.append("task", JSON.stringify(task));
      form.append("reminders", JSON.stringify(reminders));
      files.forEach((f) => form.append("files", f.file));
      out = await api("/tasks/create", form);
    }
    await load();
    if (close) setEdit(null);
    return out;
  };
  if (!state)
    return (
      <div className="auth-shell">
        <div className="auth-art">
          <div className="brand">
            <img className="app-icon" src="/tada-icon.png" alt="" /> TaDa
            <span>®</span>
          </div>
          <h1>
            A little more done.
            <br />A lot more <em>living.</em>
          </h1>
          <p>
            A calmer place for everything on your mind.
            <br />
            Make plans. Share the load. Celebrate the little wins.
          </p>
          <div className="art-card lavender">
            <Sun size={32} />
            <span>Make space for a good day</span>
            <Check />
          </div>
          <div className="art-card mint">
            <Flower2 size={32} />
            <span>One small step at a time</span>
            <Star />
          </div>
          <small>YOUR DAY, WITH ROOM TO BREATHE</small>
        </div>
        <form
          className="auth-form"
          onSubmit={(e) => {
            e.preventDefault();
            let f = new FormData(e.currentTarget);
            act(async () => {
              if (
                auth === "register" &&
                f.get("password") !== f.get("confirmPassword")
              )
                throw Error("Passwords do not match");
              await api("/auth/" + auth, Object.fromEntries(f));
              await load();
            });
          }}
        >
          <div className="brand mobile-brand">
            <img className="app-icon" src="/tada-icon.png" alt="" /> TaDa
          </div>
          <div className="auth-theme">
            <ThemeButton />
          </div>
          <span className="eyebrow">LET’S MAKE THINGS HAPPEN</span>
          <h2>
            {auth === "login" ? "Welcome back." : "Hello, new beginning."}
          </h2>
          <p>Your plans, all in one happy place.</p>
          {auth === "register" && (
            <label>
              Your name
              <input
                name="name"
                required
                autoComplete="name"
                placeholder="Alex"
              />
            </label>
          )}
          <label>
            Email address
            <input
              type="email"
              name="email"
              required
              autoComplete="email"
              placeholder="you@example.com"
            />
          </label>
          <label>
            Password
            <input
              name="password"
              type="password"
              minLength={12}
              required
              autoComplete={
                auth === "login" ? "current-password" : "new-password"
              }
              placeholder="At least 12 characters"
            />
          </label>
          {auth === "register" && (
            <label>
              Confirm password
              <input
                name="confirmPassword"
                type="password"
                required
                minLength={12}
                maxLength={256}
                autoComplete="new-password"
                placeholder="Enter your password again"
                onInput={(e) => e.target.setCustomValidity("")}
              />
            </label>
          )}
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          <button className="primary" disabled={busy}>
            {auth === "login" ? "Sign in" : "Create account"}{" "}
            <ArrowUpRight size={18} />
          </button>
          <button
            type="button"
            className="text-button"
            onClick={() => {
              setAuth(auth === "login" ? "register" : "login");
              setError("");
            }}
          >
            {auth === "login"
              ? "New here? Create an account"
              : "Already have an account? Sign in"}
          </button>
        </form>
      </div>
    );
  const { user, notifications } = state;
  const workspaces = state.workspaces || [];
  const workspace =
    workspaces.find((w) => w.id === workspaceId) || workspaces[0];
  const lists = state.lists.filter((l) => l.workspace === workspace?.id);
  const listIds = new Set(lists.map((l) => l.id));
  const tasks = state.tasks.filter((t) => listIds.has(t.list));
  let today = new Date().toLocaleDateString();
  const matches = {
    Today: (t) => t.due && new Date(t.due).toLocaleDateString() === today,
    Scheduled: (t) => !!t.due,
    All: (t) => true,
    Overdue: (t) => t.due && Date.parse(t.due) < Date.now(),
    Starred: (t) => t.star,
  };
  let selectedList = lists.find((l) => l.id === view);
  function newTask() {
    const list =
      (selectedList?.role !== "view" ? selectedList : null) ||
      lists.find((l) => l.role !== "view");
    if (list) setEdit(blank(list.id));
    else setModal({ type: "list" });
  }
  let visible = tasks
    .filter(
      (t) =>
        (selectedList ? t.list === view : (matches[view] || matches.All)(t)) &&
        t.title.toLowerCase().includes(query.toLowerCase()),
    )
    .sort(
      (a, b) =>
        Number(a.done) - Number(b.done) ||
        (sort === "priority"
          ? b.priority - a.priority
          : sort === "star"
            ? Number(b.star) - Number(a.star)
            : 0) ||
        (a.due ? Date.parse(a.due) : Infinity) -
          (b.due ? Date.parse(b.due) : Infinity),
    );
  let completed = tasks.filter((t) => t.done).length;
  const nav = (v) => {
    setView(v);
    setSidebar(false);
  };
  const editable = (t) => lists.find((l) => l.id === t.list)?.role !== "view";
  return (
    <div className="app">
      <aside
        className={sidebar ? "sidebar open" : "sidebar"}
        inert={compact && !sidebar ? true : undefined}
      >
        <button
          className="drawer-close"
          aria-label="Close menu"
          onClick={() => setSidebar(false)}
        >
          <X size={20} />
        </button>
        <div className="brand">
          <img className="app-icon" src="/tada-icon.png" alt="" /> TaDa
          <span>®</span>
        </div>
        <div className="workspace workspace-picker">
          <label>
            SPACES
            <select
              aria-label="Space"
              value={workspace?.id || ""}
              onChange={(e) => switchWorkspace(e.target.value)}
            >
              {workspaces.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </label>
          <button
            className="text-button"
            aria-label="Manage spaces"
            onClick={() => setModal({ type: "workspace" })}
          >
            Manage spaces
          </button>
        </div>
        <button
          className={view === "Lists" ? "nav active" : "nav"}
          onClick={() => nav("Lists")}
        >
          <Layers size={19} /> My lists <span>{lists.length}</span>
        </button>
        <div className="nav-caption">YOUR SPACE</div>
        <button
          className={view === "Today" ? "nav active" : "nav"}
          onClick={() => nav("Today")}
        >
          <Sun size={19} /> My day{" "}
          <span>{tasks.filter((t) => !t.done && matches.Today(t)).length}</span>
        </button>
        <button
          className={view === "All" ? "nav active" : "nav"}
          onClick={() => nav("All")}
        >
          <Layers size={19} /> All tasks
        </button>
        <button
          className={view === "Starred" ? "nav active" : "nav"}
          onClick={() => nav("Starred")}
        >
          <Star size={19} /> Important
        </button>
        <div className="nav-caption list-caption">
          MY LISTS
          <button
            aria-label="Create list"
            onClick={() => setModal({ type: "list" })}
          >
            <Plus size={17} />
          </button>
        </div>
        {lists.map((l) => (
          <button
            key={l.id}
            className={view === l.id ? "nav active" : "nav"}
            onClick={() => nav(l.id)}
          >
            <span className={"dot " + l.color} />
            {l.name}
            {l.role !== "owner" && <Users size={14} />}
            <span>
              {tasks.filter((t) => t.list === l.id && !t.done).length}
            </span>
          </button>
        ))}
        <button
          className="nav subtle"
          onClick={() => setModal({ type: "list" })}
        >
          <Plus size={18} /> Create a new list
        </button>
        <div className="sidebar-bottom">
          <div className="little-note">
            <Flower2 />
            <p>
              Small steps.
              <br />
              <strong>Lovely progress.</strong>
            </p>
          </div>
          <div className="profile">
            <span className="avatar">{user.name[0]}</span>
            <div>
              {user.name}
              <small>{workspace?.name}</small>
            </div>
            <button
              aria-label="Sign out"
              onClick={() =>
                act(async () => {
                  if ("serviceWorker" in navigator) {
                    let reg = await navigator.serviceWorker.getRegistration();
                    let sub = await reg?.pushManager?.getSubscription();
                    if (sub) {
                      await api("/push/unsubscribe", {
                        endpoint: sub.endpoint,
                      });
                      await sub.unsubscribe();
                    }
                  }
                  await clearDeviceReminders();
                  await api("/logout", {});
                  signedOut();
                })
              }
            >
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </aside>
      {sidebar && <div className="scrim" onClick={() => setSidebar(false)} />}
      <main>
        <header>
          <button
            className="mobile-menu"
            aria-label="Open menu"
            onClick={() => setSidebar(true)}
          >
            <Menu />
            <span>Lists</span>
          </button>
          <span className="breadcrumb">
            {workspace?.name} <ChevronRight size={14} />{" "}
            {selectedList?.name || view}
          </span>
          <div className="header-actions">
            <ThemeButton />
            <span className="today-date">
              {new Date().toLocaleDateString(undefined, {
                weekday: "short",
                month: "long",
                day: "numeric",
              })}
            </span>
            <button
              className="bell"
              aria-label="Notifications"
              onClick={() => setModal({ type: "notifications" })}
            >
              <Bell size={20} />
              {notifications.some((n) => !n.seen) && <i />}
            </button>
            <button
              className="account-trigger"
              aria-label="Account profile"
              aria-haspopup="dialog"
              onClick={() => setModal({ type: "profile" })}
            >
              <span className="avatar small">{user.name[0]}</span>
            </button>
          </div>
        </header>
        <div className={"content" + (view === "Lists" ? " lists-first" : "")}>
          {view === "Lists" && (
            <ListsHome
              workspace={workspace}
              lists={lists}
              tasks={tasks}
              open={nav}
              create={() => setModal({ type: "list" })}
              device={device}
              action={act}
            />
          )}
          {view !== "Lists" && compact && (
            <nav className="quick-lists" aria-label="Quick list access">
              <button className="outline" onClick={() => nav("Lists")}>
                <Layers size={16} /> All lists
              </button>
              {lists.map((l) => (
                <button
                  key={l.id}
                  className={view === l.id ? "outline selected" : "outline"}
                  onClick={() => nav(l.id)}
                >
                  {l.name}
                </button>
              ))}
            </nav>
          )}

          <div className="greeting">
            <div>
              <span className="eyebrow">A FRESH START, EVERY DAY</span>
              <h1>
                Hello, {user.name.split(" ")[0]} <span className="wave">✺</span>
              </h1>
              <p>
                You have{" "}
                {tasks.filter((t) => !t.done && matches.Today(t)).length} things
                to make today a little brighter.
              </p>
            </div>
            <button className="primary" onClick={newTask}>
              <Plus size={19} /> New task
            </button>
          </div>
          <div className="dashboard">
            {[
              ["Today", "lavender", Sun],
              ["Scheduled", "yellow", CalendarDays],
              ["All", "mint", Layers],
              ["Overdue", "pink", Clock3],
            ].map(([name, color, Icon]) => (
              <button
                key={name}
                className={
                  "summary " + color + (view === name ? " selected" : "")
                }
                onClick={() => nav(name)}
              >
                <div>
                  <span className="summary-icon">
                    <Icon size={22} />
                  </span>
                  <ArrowUpRight size={19} />
                </div>
                <div>
                  <span>{name}</span>
                  <strong>
                    {tasks.filter((t) => !t.done && matches[name](t)).length}
                  </strong>
                </div>
              </button>
            ))}
          </div>
          <div className="body-grid">
            <section className="task-section">
              <div className="section-heading">
                <div>
                  <h2>
                    {selectedList?.name ||
                      {
                        Today: "Today’s tasks",
                        All: "All your tasks",
                        Starred: "The important things",
                        Scheduled: "On the horizon",
                        Overdue: "Let’s catch up",
                      }[view]}
                    <span>{visible.filter((t) => !t.done).length}</span>
                  </h2>
                  <p>
                    {view === "Today"
                      ? "A little focus goes a long way."
                      : "Make room for what matters."}
                  </p>
                </div>
                {selectedList && (
                  <label className="move-list">
                    Space
                    <select
                      aria-label="Move list to space"
                      value={workspace?.id || ""}
                      onChange={(e) => {
                        const id = e.target.value;
                        act(async () => {
                          await api(
                            "/lists/" + selectedList.id + "/workspace",
                            { workspace: id },
                            "PUT",
                          );
                          await load();
                          switchWorkspace(id);
                        });
                      }}
                    >
                      {workspaces.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.name}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {selectedList && (
                  <button
                    className="outline"
                    onClick={() =>
                      act(async () => {
                        let members = await api("/lists/" + view + "/members");
                        setModal({
                          type: "share",
                          list: selectedList,
                          members,
                        });
                      })
                    }
                  >
                    <Users size={16} /> Share
                  </button>
                )}
              </div>
              <div className="toolbar">
                <label className="search">
                  <Search size={17} />
                  <input
                    placeholder="Find a task…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </label>
                <select
                  aria-label="Sort tasks"
                  value={sort}
                  onChange={(e) => setSort(e.target.value)}
                >
                  <option value="date">Due date</option>
                  <option value="priority">Priority</option>
                  <option value="star">Important first</option>
                </select>
              </div>
              <div className="task-list">
                {visible.map((t) => (
                  <article
                    className={"task-row" + (t.done ? " done" : "")}
                    key={t.id}
                  >
                    <button
                      aria-label={
                        t.done ? "Reopen " + t.title : "Complete " + t.title
                      }
                      className="check"
                      disabled={!editable(t)}
                      onClick={() =>
                        act(() => saveTask({ ...t, done: !t.done }, false))
                      }
                    >
                      {t.done && <Check size={15} />}
                    </button>
                    <button
                      className="task-main"
                      onClick={() => setEdit(structuredClone(t))}
                    >
                      <span className="task-title">
                        {t.title}
                        {t.reminders?.length > 0 && (
                          <span
                            className="reminder-badge"
                            role="img"
                            aria-label={`${t.reminders.length} reminder${t.reminders.length === 1 ? "" : "s"} set`}
                            title={`${t.reminders.length} reminder(s) set`}
                          >
                            <Bell size={13} />
                          </span>
                        )}
                      </span>
                      <span className="task-meta">
                        <span
                          className={
                            "mini-dot " +
                            lists.find((l) => l.id === t.list)?.color
                          }
                        />
                        {lists.find((l) => l.id === t.list)?.name}
                        <span
                          className={
                            t.due && Date.parse(t.due) < Date.now() && !t.done
                              ? "late"
                              : ""
                          }
                        >
                          <CalendarDays size={12} /> {date(t.due)}
                        </span>
                        {t.subtasks.length > 0 && (
                          <span>
                            <Check size={12} />
                            {t.subtasks.filter((s) => s.done).length}/
                            {t.subtasks.length}
                          </span>
                        )}
                        {t.files.length > 0 && <Paperclip size={12} />}
                        {t.repeat !== "none" && <Repeat2 size={12} />}
                      </span>
                      {t.subtasks.length > 0 && (
                        <span className="progress">
                          <i
                            style={{
                              width:
                                (t.subtasks.filter((s) => s.done).length /
                                  t.subtasks.length) *
                                  100 +
                                "%",
                            }}
                          />
                        </span>
                      )}
                    </button>
                    {t.priority === 2 && <span className="priority">High</span>}
                    <button
                      className={"star " + (t.star ? "starred" : "")}
                      aria-label="Toggle importance"
                      disabled={!editable(t)}
                      onClick={() =>
                        act(() => saveTask({ ...t, star: !t.star }, false))
                      }
                    >
                      <Star size={19} fill={t.star ? "currentColor" : "none"} />
                    </button>
                    <button
                      className="open-task"
                      aria-label={"Edit " + t.title}
                      onClick={() => setEdit(structuredClone(t))}
                    >
                      <ChevronRight size={17} />
                    </button>
                  </article>
                ))}
                {!visible.length && (
                  <div className="empty">
                    <Flower2 size={38} />
                    <h3>A little breathing room.</h3>
                    <p>
                      {query
                        ? "No tasks match your search."
                        : "Add something you’d like to get done."}
                    </p>
                  </div>
                )}
              </div>
              <button className="add-inline" onClick={newTask}>
                <Plus size={19} /> Add a task <span>One small step…</span>
              </button>
              <div className="completion-note">
                <Check size={15} /> {completed} little wins so far. Keep going
                at your own pace.
              </div>
            </section>
            <aside className="right-rail">
              <div className="section-heading">
                <h2>Your lists</h2>
                <button
                  aria-label="New list"
                  onClick={() => setModal({ type: "list" })}
                >
                  <Plus size={18} />
                </button>
              </div>
              <div className="list-cards">
                {lists.map((l) => (
                  <button
                    key={l.id}
                    className={"list-card " + l.color}
                    onClick={() => nav(l.id)}
                  >
                    <div>
                      <span className="list-symbol">
                        {l.color === "mint"
                          ? "✿"
                          : l.color === "yellow"
                            ? "⌂"
                            : "✧"}
                      </span>
                      <span className="pill">
                        {tasks.filter((t) => t.list === l.id && t.done).length}{" "}
                        done
                      </span>
                    </div>
                    <h3>{l.name}</h3>
                    <div>
                      <span>
                        {tasks.filter((t) => t.list === l.id && !t.done).length}{" "}
                        tasks
                      </span>
                      <ArrowUpRight size={20} />
                    </div>
                  </button>
                ))}
              </div>
              <div className="quote">
                <span>✦</span>
                <p>
                  You don’t have to do it all.
                  <br />
                  Just the next little thing.
                </p>
                <small>MAKE TODAY YOURS</small>
              </div>
            </aside>
          </div>
          <footer>
            Less on your mind. More in your day. <Flower2 size={14} />
          </footer>
        </div>
      </main>
      {error && (
        <div className="error-toast" role="alert">
          {error}
          <button aria-label="Dismiss error" onClick={() => setError("")}>
            <X size={16} />
          </button>
        </div>
      )}
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
      {edit && (
        <div className="overlay" onClick={() => setEdit(null)}>
          <form
            className="detail"
            onSubmit={(e) => {
              e.preventDefault();
              act(() => saveTask(edit));
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="detail-top">
              <span className="eyebrow">
                {edit.id ? "TASK DETAILS" : "A NEW LITTLE PLAN"}
              </span>
              <button
                type="button"
                aria-label="Close task"
                onClick={() => setEdit(null)}
              >
                <X size={21} />
              </button>
            </div>
            <fieldset disabled={edit.id && !editable(edit)}>
              <input
                className="title-input"
                aria-label="Task title"
                required
                placeholder="What’s on your mind?"
                value={edit.title}
                onChange={(e) => setEdit({ ...edit, title: e.target.value })}
              />
              <div className="detail-controls">
                <label>
                  List
                  <select
                    value={edit.list}
                    disabled={!!edit.id}
                    onChange={(e) => setEdit({ ...edit, list: e.target.value })}
                  >
                    {lists
                      .filter((l) => l.role !== "view" || l.id === edit.list)
                      .map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.name}
                        </option>
                      ))}
                  </select>
                </label>
                <label>
                  Priority
                  <select
                    value={edit.priority}
                    onChange={(e) =>
                      setEdit({ ...edit, priority: +e.target.value })
                    }
                  >
                    <option value="0">Low</option>
                    <option value="1">Normal</option>
                    <option value="2">High</option>
                  </select>
                </label>
              </div>
              <div className="detail-controls">
                <label>
                  Due date
                  <input
                    type="datetime-local"
                    value={local(edit.due)}
                    onChange={(e) =>
                      setEdit({
                        ...edit,
                        due: e.target.value
                          ? new Date(e.target.value).toISOString()
                          : null,
                      })
                    }
                  />
                </label>
                <label>
                  Repeat task
                  <select
                    value={edit.repeat}
                    onChange={(e) =>
                      setEdit({ ...edit, repeat: e.target.value })
                    }
                  >
                    {["none", "daily", "weekly", "monthly"].map((x) => (
                      <option key={x}>{x}</option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={edit.star}
                  onChange={(e) => setEdit({ ...edit, star: e.target.checked })}
                />{" "}
                Mark as important
              </label>
              <h3>
                Small steps{" "}
                <span>
                  {edit.subtasks.filter((s) => s.done).length}/
                  {edit.subtasks.length}
                </span>
              </h3>
              {edit.subtasks.map((s, i) => (
                <div className="subtask" key={s.id}>
                  <input
                    type="checkbox"
                    checked={s.done}
                    onChange={(e) =>
                      setEdit({
                        ...edit,
                        subtasks: edit.subtasks.map((x, j) =>
                          j === i ? { ...x, done: e.target.checked } : x,
                        ),
                      })
                    }
                  />
                  <input
                    aria-label="Subtask"
                    value={s.title}
                    onChange={(e) =>
                      setEdit({
                        ...edit,
                        subtasks: edit.subtasks.map((x, j) =>
                          j === i ? { ...x, title: e.target.value } : x,
                        ),
                      })
                    }
                  />
                  <button
                    type="button"
                    aria-label="Remove subtask"
                    onClick={() =>
                      setEdit({
                        ...edit,
                        subtasks: edit.subtasks.filter((_, j) => j !== i),
                      })
                    }
                  >
                    <X size={15} />
                  </button>
                </div>
              ))}
              <button
                className="text-button"
                type="button"
                onClick={() =>
                  setEdit({
                    ...edit,
                    subtasks: [
                      ...edit.subtasks,
                      { id: newId(), title: "", done: false },
                    ],
                  })
                }
              >
                + Add a step
              </button>
              <label>
                Notes
                <textarea
                  rows="4"
                  placeholder="Ideas, details, a little context…"
                  value={edit.notes}
                  onChange={(e) => setEdit({ ...edit, notes: e.target.value })}
                />
              </label>
            </fieldset>
            {
              <>
                <h3>
                  <Paperclip size={16} /> Attachments
                </h3>
                {edit.files.map((f) => (
                  <div className="attachment" key={f.id}>
                    {edit.id ? (
                      <a href={"/api/files/" + f.id}>{f.name}</a>
                    ) : (
                      <span>
                        {f.name} <small>Ready to upload when saved</small>
                      </span>
                    )}
                    {editable(edit) && (
                      <button
                        type="button"
                        aria-label="Delete attachment"
                        onClick={() =>
                          act(async () => {
                            if (edit.id)
                              await api(
                                `/tasks/${edit.id}/files/${f.id}`,
                                {},
                                "DELETE",
                              );
                            setEdit({
                              ...edit,
                              files: edit.files.filter((x) => x.id !== f.id),
                            });
                            await load();
                          })
                        }
                      >
                        <X size={15} />
                      </button>
                    )}
                  </div>
                ))}
                {editable(edit) && (
                  <label className="upload">
                    + Add photo, document, or audio · up to 20 MB
                    <input
                      type="file"
                      multiple
                      onChange={(e) => {
                        const files = Array.from(e.target.files);
                        e.target.value = "";
                        if (files.some((f) => f.size > 20 * 1024 * 1024)) {
                          setError("Each attachment must be 20 MB or smaller");
                          return;
                        }
                        if (!edit.id) {
                          if (edit.files.length + files.length > 10) {
                            setError("Maximum 10 attachments per new task");
                            return;
                          }
                          setEdit({
                            ...edit,
                            files: [
                              ...edit.files,
                              ...files.map((file) => ({
                                id: newId(),
                                name: file.name,
                                file,
                              })),
                            ],
                          });
                        } else
                          act(async () => {
                            for (const file of files) {
                              const form = new FormData();
                              form.append("file", file);
                              await api("/tasks/" + edit.id + "/files", form);
                            }
                            const s = await load();
                            setEdit({
                              ...edit,
                              files: s.tasks.find((t) => t.id === edit.id)
                                .files,
                            });
                          });
                      }}
                    />
                  </label>
                )}
                <h3>
                  <Bell size={16} /> Reminders
                </h3>
                {edit.reminders.map((r) => (
                  <div className="attachment" key={r.id}>
                    <span>
                      {new Date(r.at).toLocaleString()} · {r.repeat}
                    </span>
                    {editable(edit) && (
                      <button
                        type="button"
                        aria-label="Delete reminder"
                        onClick={() =>
                          act(async () => {
                            if (edit.id)
                              await api(
                                `/tasks/${edit.id}/reminders/${r.id}`,
                                {},
                                "DELETE",
                              );
                            setEdit({
                              ...edit,
                              reminders: edit.reminders.filter(
                                (x) => x.id !== r.id,
                              ),
                            });
                            await load();
                          })
                        }
                      >
                        <X size={15} />
                      </button>
                    )}
                  </div>
                ))}
                {editable(edit) && (
                  <button
                    className="text-button"
                    type="button"
                    onClick={() =>
                      setModal({ type: "reminder", task: edit.id })
                    }
                  >
                    + Schedule a reminder
                  </button>
                )}
              </>
            }
            <div className="detail-footer">
              {edit.id && editable(edit) && (
                <button
                  type="button"
                  className="danger"
                  aria-label="Delete task"
                  onClick={() => setModal({ type: "delete", task: edit.id })}
                >
                  <Trash2 size={18} />
                </button>
              )}
              {edit.id && !editable(edit) ? (
                <span className="hint">You have view-only access</span>
              ) : (
                <button className="primary" disabled={busy}>
                  Save task <Check size={17} />
                </button>
              )}
            </div>
          </form>
        </div>
      )}
      {modal && (
        <div className="overlay modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <button
              className="modal-close"
              aria-label="Close dialog"
              onClick={() => setModal(null)}
            >
              <X size={20} />
            </button>
            {modal.type === "profile" && (
              <Profile
                user={user}
                changePassword={(body) => api("/profile/password", body)}
              />
            )}
            {modal.type === "workspace" && workspace && (
              <WorkspaceSettings
                key={workspace.id}
                workspaces={workspaces}
                active={workspace}
                busy={busy}
                action={act}
                changed={async (id) => {
                  await load();
                  switchWorkspace(id);
                }}
              />
            )}
            {modal.type === "list" && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  let b = Object.fromEntries(new FormData(e.currentTarget));
                  act(async () => {
                    let l = await api("/lists", {
                      ...b,
                      workspace: workspace?.id,
                    });
                    await load();
                    setView(l.id);
                    setModal(null);
                  });
                }}
              >
                <span className="eyebrow">MAKE SOME ROOM</span>
                <h2>A home for your plans.</h2>
                <label>
                  List name
                  <input
                    name="name"
                    required
                    maxLength={100}
                    placeholder="Weekend adventures"
                    autoFocus
                  />
                </label>
                <label>
                  Theme
                  <select name="color">
                    <option value="mint">Mint</option>
                    <option value="lavender">Lavender</option>
                    <option value="yellow">Sunshine</option>
                    <option value="pink">Blossom</option>
                  </select>
                </label>
                <button className="primary" disabled={busy}>
                  Create list <Plus size={17} />
                </button>
              </form>
            )}
            {modal.type === "share" && (
              <>
                <span className="eyebrow">BETTER TOGETHER</span>
                <h2>Share {modal.list.name}</h2>
                <p>Invite someone to lend a hand, or simply follow along.</p>
                {modal.members.map((m) => (
                  <div className="attachment" key={m.id}>
                    <span>
                      {m.name} · {m.role}
                    </span>
                    {modal.list.role === "owner" && m.role !== "owner" && (
                      <button
                        onClick={() =>
                          act(async () => {
                            await api(
                              `/lists/${modal.list.id}/members/${m.id}`,
                              {},
                              "DELETE",
                            );
                            setModal({
                              ...modal,
                              members: modal.members.filter(
                                (x) => x.id !== m.id,
                              ),
                            });
                          })
                        }
                      >
                        <X size={16} />
                      </button>
                    )}
                  </div>
                ))}
                {modal.list.role === "owner" && (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      let b = Object.fromEntries(new FormData(e.currentTarget));
                      act(async () => {
                        let d = await api(
                          "/lists/" + modal.list.id + "/invite",
                          b,
                        );
                        setModal({ ...modal, url: d.url });
                      });
                    }}
                  >
                    <label>
                      Email (optional)
                      <input
                        type="email"
                        name="email"
                        placeholder="Anyone with the link, if left blank"
                      />
                    </label>
                    <label>
                      Permission
                      <select name="role">
                        <option value="edit">Can edit</option>
                        <option value="view">Can view</option>
                      </select>
                    </label>
                    <button className="primary" disabled={busy}>
                      Create invitation link
                    </button>
                  </form>
                )}
                {modal.url && (
                  <label>
                    Copy this single-use link · expires in 7 days
                    <input
                      readOnly
                      value={modal.url}
                      onFocus={(e) => e.target.select()}
                    />
                  </label>
                )}
              </>
            )}
            {modal.type === "reminder" && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  let b = Object.fromEntries(new FormData(e.currentTarget));
                  b.at = new Date(b.at).toISOString();
                  act(async () => {
                    if (Date.parse(b.at) <= Date.now())
                      throw Error("Choose a future reminder");
                    if (!modal.task) {
                      setEdit({
                        ...edit,
                        reminders: [...edit.reminders, { ...b, id: newId() }],
                      });
                      setModal(null);
                      return;
                    }
                    await api("/tasks/" + modal.task + "/reminders", b);
                    let s = await load();
                    setEdit({
                      ...edit,
                      reminders: s.tasks.find((t) => t.id === modal.task)
                        .reminders,
                    });
                    setModal(null);
                  });
                }}
              >
                <h2>A gentle nudge.</h2>
                <label>
                  Remind me at
                  <input required type="datetime-local" name="at" />
                </label>
                <label>
                  Repeat reminder
                  <select name="repeat">
                    {["none", "daily", "weekly", "monthly"].map((x) => (
                      <option key={x}>{x}</option>
                    ))}
                  </select>
                </label>
                <button className="primary" disabled={busy}>
                  Schedule reminder
                </button>
              </form>
            )}
            {modal.type === "delete" && (
              <>
                <h2>Delete this task?</h2>
                <p>Its attachments and reminders will also be removed.</p>
                <button
                  className="primary"
                  disabled={busy}
                  onClick={() =>
                    act(async () => {
                      await api("/tasks/" + modal.task, {}, "DELETE");
                      await load();
                      setEdit(null);
                      setModal(null);
                    })
                  }
                >
                  Delete task
                </button>
              </>
            )}
            {modal.type === "notifications" && (
              <>
                <h2>Your gentle nudges</h2>
                <p>Upcoming deadlines and scheduled reminders.</p>
                <NotificationSettings
                  device={device}
                  enableBrowser={enablePush}
                  refresh={load}
                />
                <button
                  className="text-button"
                  onClick={() =>
                    act(async () => {
                      await api("/notifications/read", {});
                      await load();
                    })
                  }
                >
                  Mark all as read
                </button>
                {!notifications.length && (
                  <p className="empty">All quiet. You’re up to date.</p>
                )}
                {notifications.map((n) => (
                  <button
                    key={n.id}
                    className={"notification " + (!n.seen ? "unread" : "")}
                    onClick={() => {
                      let t = state.tasks.find((t) => t.id === n.task);
                      if (t) {
                        const target = state.lists.find((l) => l.id === t.list);
                        setWorkspaceId(target?.workspace);
                        setView(t.list);
                      }
                      if (t) setEdit(structuredClone(t));
                      setModal(null);
                    }}
                  >
                    <Bell size={16} />
                    <span>
                      {n.title}
                      <small>{new Date(n.created).toLocaleString()}</small>
                    </span>
                  </button>
                ))}
                <p className="hint">
                  {device.native
                    ? "Android delivers alerts through TaDa’s native notification channels. Allow notifications and precise alarms in Android settings."
                    : "Enable browser push for alerts when this page is closed. Your server needs VAPID keys."}
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
createRoot(document.getElementById("root")).render(<App />);
