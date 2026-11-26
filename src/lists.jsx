import React, { useEffect, useRef, useState } from "react";
import {
  List,
  Home,
  Briefcase,
  ShoppingCart,
  Heart,
  BookOpen,
  Plane,
  Wallet,
  Film,
  Users,
  School,
  Dumbbell,
  Coffee,
  Music,
  Pill,
  Gift,
  GripVertical,
  MoreHorizontal,
  Plus,
} from "lucide-react";
export const listIcons = {
  list: List,
  home: Home,
  briefcase: Briefcase,
  "shopping-cart": ShoppingCart,
  heart: Heart,
  book: BookOpen,
  plane: Plane,
  wallet: Wallet,
  film: Film,
  users: Users,
  school: School,
  dumbbell: Dumbbell,
  coffee: Coffee,
  music: Music,
  pill: Pill,
  gift: Gift,
};
export function ListIcon({ list, size = 21 }) {
  const Icon = listIcons[list.icon] || List;
  return <Icon size={size} style={{ color: list.accent || "#006644" }} />;
}
export function Avatar({ user, small = false }) {
  return (
    <span className={"avatar" + (small ? " small" : "")}>
      {user.avatar ? (
        <img
          src={`/api/avatars/${user.id}?v=${user.avatar}`}
          alt={`${user.name} profile`}
        />
      ) : (
        user.name?.[0]?.toUpperCase()
      )}
    </span>
  );
}
export function ListEditor({ list, save, busy }) {
  const [name, setName] = useState(list?.name || ""),
    [icon, setIcon] = useState(list?.icon || "list"),
    [accent, setAccent] = useState(list?.accent || "#006644");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save({ name, icon, accent });
      }}
    >
      <span className="eyebrow">MAKE IT YOURS</span>
      <h2>{list ? "Edit list" : "New list"}</h2>
      <label>
        List name
        <input
          required
          maxLength={100}
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />
      </label>
      <fieldset className="icon-picker">
        <legend>List icon</legend>
        {Object.entries(listIcons).map(([key, Icon]) => (
          <button
            type="button"
            key={key}
            aria-label={`Icon ${key}`}
            aria-pressed={icon === key}
            onClick={() => setIcon(key)}
            style={{ color: accent }}
          >
            <Icon size={23} />
          </button>
        ))}
      </fieldset>
      <label>
        List color
        <input
          type="color"
          value={accent}
          onChange={(e) => setAccent(e.target.value)}
        />
      </label>
      <div className="list-color-options">
        {[
          "#006644",
          "#5b61a8",
          "#9b4076",
          "#a64049",
          "#a56818",
          "#167b8b",
          "#4c6370",
        ].map((color) => (
          <button
            type="button"
            key={color}
            aria-label={`Color ${color}`}
            aria-pressed={accent === color}
            style={{ background: color }}
            onClick={() => setAccent(color)}
          />
        ))}
      </div>
      <button className="primary" disabled={busy}>
        {list ? "Save list" : "Create list"}
      </button>
    </form>
  );
}
export function CompactLists({
  workspace,
  lists,
  tasks,
  open,
  create,
  edit,
  reorder,
  share,
}) {
  const [rows, setRows] = useState(lists),
    [dragging, setDragging] = useState(null),
    [message, setMessage] = useState("");
  const root = useRef(null),
    state = useRef({}),
    latest = useRef({ rows, reorder, open });
  latest.current = { rows, reorder, open };
  useEffect(() => {
    if (!state.current.id) setRows(lists);
  }, [lists]);
  const start = (id, x, y) => {
    clearTimeout(state.current.timer);
    state.current = {
      x,
      y,
      source: id,
      timer: setTimeout(() => {
        state.current.id = id;
        setDragging(id);
        setMessage("Reordering. Drag to a new position, then release.");
        navigator.vibrate?.(25);
      }, 380),
    };
  };
  const move = (x, y) => {
    const s = state.current;
    if (!s.id) {
      if (Math.hypot(x - s.x, y - s.y) > 9) clearTimeout(s.timer);
      return;
    }
    const target = document.elementFromPoint(x, y)?.closest("[data-list-id]")
      ?.dataset.listId;
    if (!target || target === s.id) return;
    setRows((old) => {
      const next = [...old],
        a = next.findIndex((l) => l.id === s.id),
        b = next.findIndex((l) => l.id === target);
      if (a < 0 || b < 0) return old;
      next.splice(b, 0, next.splice(a, 1)[0]);
      return next;
    });
  };
  const finish = () => {
    const s = state.current;
    clearTimeout(s.timer);
    if (s.id) {
      state.current = { last: Date.now() };
      setDragging(null);
      latest.current.reorder(latest.current.rows.map((l) => l.id));
      setMessage("List order saved.");
    } else state.current = { last: s.last || 0 };
  };
  useEffect(() => {
    const node = root.current;
    const down = (e) => {
      const id = e.target.closest("[data-list-id]")?.dataset.listId;
      if (id) start(id, e.touches[0].clientX, e.touches[0].clientY);
    };
    const moving = (e) => {
      if (state.current.id) e.preventDefault();
      move(e.touches[0].clientX, e.touches[0].clientY);
    };
    const cancel = () => {
      clearTimeout(state.current.timer);
      state.current = {};
      setDragging(null);
    };
    node.addEventListener("touchstart", down, { passive: true });
    node.addEventListener("touchmove", moving, { passive: false });
    node.addEventListener("touchend", finish);
    node.addEventListener("touchcancel", cancel);
    const endPointer = (event) => {
      if (event.pointerType !== "touch") finish();
    };
    window.addEventListener("pointerup", endPointer);
    return () => {
      clearTimeout(state.current.timer);
      node.removeEventListener("touchstart", down);
      node.removeEventListener("touchmove", moving);
      node.removeEventListener("touchend", finish);
      node.removeEventListener("touchcancel", cancel);
      window.removeEventListener("pointerup", endPointer);
    };
  }, []);
  return (
    <section className="compact-catalogue">
      <div className="section-heading">
        <div>
          <h2>
            {workspace.name} <small>Lists</small>
          </h2>
          <p>Hold a list to rearrange it.</p>
        </div>
        <button className="outline" onClick={share}>
          <Users size={17} /> Share Space
        </button>
      </div>
      <div
        ref={root}
        className="compact-lists"
        onContextMenu={(e) => e.preventDefault()}
      >
        {rows.map((list, index) => (
          <div
            data-list-id={list.id}
            key={list.id}
            className={
              "compact-list" + (dragging === list.id ? " dragging" : "")
            }
            onPointerDown={(e) => {
              if (e.pointerType !== "touch" && e.button === 0)
                start(list.id, e.clientX, e.clientY);
            }}
            onPointerMove={(e) => {
              if (e.pointerType !== "touch") move(e.clientX, e.clientY);
            }}
            onPointerUp={(e) => {
              if (e.pointerType !== "touch") finish();
            }}
            onPointerLeave={(e) => {
              if (e.pointerType !== "touch" && !state.current.id)
                clearTimeout(state.current.timer);
            }}
          >
            <button
              className="list-open"
              onClick={() => {
                if (!dragging && Date.now() - (state.current.last || 0) > 450)
                  open(list.id);
              }}
            >
              <ListIcon list={list} />
              <span>{list.name}</span>
              {list.participants?.length > 1 && (
                <Users size={15} aria-label="Shared list" />
              )}
              <span className="list-count">
                {tasks.filter((t) => t.list === list.id && !t.done).length}
              </span>
            </button>
            {list.role !== "view" && (
              <button
                className="list-options"
                aria-label={`Edit list ${list.name}`}
                onClick={() => edit(list)}
              >
                <MoreHorizontal size={19} />
              </button>
            )}
            <button
              className="reorder-handle"
              aria-label={`Reorder ${list.name}`}
              title="Hold and drag, or use arrow keys"
              onKeyDown={(e) => {
                if (!["ArrowUp", "ArrowDown"].includes(e.key)) return;
                e.preventDefault();
                const next = [...rows],
                  other = index + (e.key === "ArrowUp" ? -1 : 1);
                if (other < 0 || other >= next.length) return;
                [next[index], next[other]] = [next[other], next[index]];
                setRows(next);
                reorder(next.map((l) => l.id));
              }}
            >
              <GripVertical size={17} />
            </button>
          </div>
        ))}
      </div>
      <button
        className="add-inline"
        disabled={workspace.role === "view"}
        onClick={create}
      >
        <Plus size={20} /> New list
      </button>
      <span className="sr-only" role="status">
        {message}
      </span>
    </section>
  );
}

export function ShareSpace({ workspace, api, refresh }) {
  const [members, setMembers] = useState([]),
    [url, setUrl] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const load = async () =>
    setMembers(await api(`/workspaces/${workspace.id}/members`));
  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, []);
  return (
    <section>
      <h2>Share {workspace.name}</h2>
      <p>
        Members gain access to all lists owned by this Space, including future
        lists. Individually received lists keep their existing permissions.
      </p>
      {members.map((m) => (
        <div className="member-row" key={m.id}>
          <Avatar user={m} small />
          <span>
            {m.name}
            <small>{m.role}</small>
          </span>
          {workspace.role === "owner" && m.role !== "owner" && (
            <button
              className="text-button"
              onClick={async () => {
                try {
                  await api(
                    `/workspaces/${workspace.id}/members/${m.id}`,
                    {},
                    "DELETE",
                  );
                  await load();
                  await refresh();
                } catch (e) {
                  setError(e.message);
                }
              }}
            >
              Remove
            </button>
          )}
        </div>
      ))}
      {workspace.role === "owner" && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            try {
              const result = await api(
                `/workspaces/${workspace.id}/invite`,
                Object.fromEntries(new FormData(e.currentTarget)),
              );
              setUrl(result.url);
            } catch (e) {
              setError(e.message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            Invite email
            <input required type="email" name="email" />
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
      {url && (
        <label>
          Single-use invitation · expires in 7 days
          <input readOnly value={url} onFocus={(e) => e.target.select()} />
        </label>
      )}
      {error && (
        <p role="alert" className="profile-error">
          {error}
        </p>
      )}
    </section>
  );
}
