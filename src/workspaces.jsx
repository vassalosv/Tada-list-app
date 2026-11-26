import React, { useState } from "react";
import { FolderOpen, ArrowUpRight, Plus, Users, Bell } from "lucide-react";
import { api } from "./api.js";

export function ListsHome({
  workspace,
  lists,
  tasks,
  open,
  create,
  device,
  action,
}) {
  return (
    <section className="lists-home">
      <div className="section-heading">
        <div>
          <span className="eyebrow">YOUR SPACE, YOUR PACE</span>
          <h1>{workspace?.name || "My space"}</h1>
          <p>Choose a list to get started.</p>
        </div>
        <button className="primary" onClick={create}>
          <Plus size={18} /> New list
        </button>
      </div>
      {device.native && !device.enabled && (
        <div className="device-prompt">
          <Bell size={22} />
          <div>
            <strong>Keep your plans close</strong>
            <p>Get reminders in Android’s notification shade.</p>
          </div>
          <button
            className="outline"
            disabled={!device.available}
            onClick={() => action(device.enable)}
          >
            Enable notifications
          </button>
        </div>
      )}
      <div className="workspace-list-grid">
        {lists.map((list) => (
          <button
            key={list.id}
            className={"workspace-list-card " + list.color}
            onClick={() => open(list.id)}
          >
            <div>
              <FolderOpen size={25} />
              {list.role !== "owner" && (
                <Users size={18} aria-label="Shared list" />
              )}
            </div>
            <h2>{list.name}</h2>
            <div>
              <span>
                {tasks.filter((t) => t.list === list.id && !t.done).length}{" "}
                tasks
              </span>
              <ArrowUpRight size={20} />
            </div>
          </button>
        ))}
      </div>
      {!lists.length && (
        <div className="workspace-empty">
          <FolderOpen size={40} />
          <h2>A space for what matters</h2>
          <p>Create the first list in this space.</p>
          <button className="primary" onClick={create}>
            <Plus size={18} /> Create list
          </button>
        </div>
      )}
    </section>
  );
}

export function WorkspaceSettings({
  workspaces,
  active,
  changed,
  action,
  busy,
}) {
  const [name, setName] = useState(""),
    [renamed, setRenamed] = useState(active.name),
    [destination, setDestination] = useState(
      workspaces.find((w) => w.id !== active.id && w.role === "owner")?.id ||
        "",
    ),
    [confirm, setConfirm] = useState(false);
  return (
    <section className="workspace-settings">
      <span className="eyebrow">ROOM FOR EVERY PART OF LIFE</span>
      <h2>Your spaces</h2>
      <p>
        Keep work, home and personal lists separate. Shared lists keep their
        existing permissions.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          action(async () => {
            const result = await api("/workspaces", { name });
            await changed(result.id);
          });
        }}
      >
        <h3>
          Create space <small>{workspaces.length}/20</small>
        </h3>
        <label>
          Space name
          <input
            required
            maxLength={60}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Work, Family, Personal…"
          />
        </label>
        <button className="primary" disabled={busy || workspaces.length >= 20}>
          Create space
        </button>
      </form>
      {active.role === "owner" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            action(async () => {
              await api("/workspaces/" + active.id, { name: renamed }, "PATCH");
              await changed(active.id);
            });
          }}
        >
          <h3>Rename {active.name}</h3>
          <label>
            New space name
            <input
              required
              maxLength={60}
              value={renamed}
              onChange={(e) => setRenamed(e.target.value)}
            />
          </label>
          <button className="outline" disabled={busy}>
            Save name
          </button>
        </form>
      )}
      {active.role === "owner" &&
        workspaces.filter((w) => w.role === "owner").length > 1 && (
          <div className="workspace-delete">
            <h3>Remove space</h3>
            <p>Your lists and tasks will move to another space.</p>
            <label>
              Move lists to
              <select
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
              >
                {workspaces
                  .filter((w) => w.id !== active.id)
                  .map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
              </select>
            </label>
            <label className="confirm-workspace">
              <input
                type="checkbox"
                checked={confirm}
                onChange={(e) => setConfirm(e.target.checked)}
              />{" "}
              Remove “{active.name}” and move its lists
            </label>
            <button
              className="danger"
              disabled={busy || !confirm}
              onClick={() =>
                action(async () => {
                  await api(
                    "/workspaces/" + active.id,
                    { destination },
                    "DELETE",
                  );
                  await changed(destination);
                })
              }
            >
              Remove space
            </button>
          </div>
        )}
    </section>
  );
}
