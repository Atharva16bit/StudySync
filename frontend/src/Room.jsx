import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { io } from "socket.io-client";

function appendById(items, item) {
  return items.some((existing) => existing.id === item.id)
    ? items
    : [...items, item];
}

function makeId() {
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);

  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join(
    "",
  );
}

function applyBoardEvent(items, event) {
  if (event.ids) {
    return items.filter((item) => !event.ids.includes(item.id));
  }

  if (event.deleted) {
    return items.filter((item) => item.id !== event.id);
  }

  return appendById(items, event);
}

function touchesStroke(stroke, point, bounds) {
  const x = point.x * bounds.width;
  const y = point.y * bounds.height;

  const radius = 14 + (stroke.width * bounds.width) / 2400;

  return stroke.points.some((current, index, points) => {
    const previous = points[Math.max(0, index - 1)];

    const ax = previous.x * bounds.width;
    const ay = previous.y * bounds.height;

    const dx = current.x * bounds.width - ax;
    const dy = current.y * bounds.height - ay;

    const length = dx * dx + dy * dy;

    const t = length
      ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / length))
      : 0;

    return Math.hypot(x - ax - t * dx, y - ay - t * dy) <= radius;
  });
}

function drawStroke(context, stroke, width, height) {
  const [first, ...rest] = stroke.points;
  if (!first) return;

  context.strokeStyle = stroke.color;
  context.fillStyle = stroke.color;
  context.lineWidth = (stroke.width * width) / 1200;
  context.lineCap = "round";
  context.lineJoin = "round";

  if (rest.length === 0) {
    context.beginPath();

    context.arc(
      first.x * width,
      first.y * height,
      context.lineWidth / 2,
      0,
      Math.PI * 2,
    );

    context.fill();
    return;
  }

  context.beginPath();
  context.moveTo(first.x * width, first.y * height);

  for (const point of rest) {
    context.lineTo(point.x * width, point.y * height);
  }

  context.stroke();
}

function Whiteboard({ strokes, enabled, onStroke, onErase, onShareSteps }) {
  const canvasRef = useRef(null);
  const pointerRef = useRef(null);
  const draftRef = useRef(null);
  const erasedRef = useRef(new Set());
  const gestureTool = useRef("pen");

  const [color, setColor] = useState("#4338ca");
  const [width, setWidth] = useState(4);
  const [tool, setTool] = useState("pen");

  function paint() {
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");

    context.clearRect(0, 0, canvas.width, canvas.height);

    for (const stroke of strokes) {
      drawStroke(context, stroke, canvas.width, canvas.height);
    }

    if (draftRef.current) {
      drawStroke(context, draftRef.current, canvas.width, canvas.height);
    }
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");

    context.clearRect(0, 0, canvas.width, canvas.height);

    for (const stroke of strokes) {
      drawStroke(context, stroke, canvas.width, canvas.height);
    }

    if (draftRef.current) {
      drawStroke(context, draftRef.current, canvas.width, canvas.height);
    }
  }, [strokes]);

  function point(event) {
    const bounds = event.currentTarget.getBoundingClientRect();

    const clamp = (value) => Math.min(1, Math.max(0, value));

    return {
      x: clamp((event.clientX - bounds.left) / bounds.width),
      y: clamp((event.clientY - bounds.top) / bounds.height),
    };
  }

  function eraseAt(event) {
    const bounds = event.currentTarget.getBoundingClientRect();

    for (const stroke of strokes) {
      if (
        erasedRef.current.size < 200 &&
        touchesStroke(stroke, point(event), bounds)
      ) {
        erasedRef.current.add(stroke.id);
      }
    }
  }

  function start(event) {
    if (!enabled || event.button !== 0 || pointerRef.current !== null) {
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);

    pointerRef.current = event.pointerId;
    erasedRef.current = new Set();
    gestureTool.current = tool;

    if (gestureTool.current === "eraser") {
      eraseAt(event);
      return;
    }

    draftRef.current = {
      id: makeId(),
      color,
      width,
      points: [point(event)],
    };

    paint();
  }

  function move(event) {
    if (pointerRef.current !== event.pointerId) {
      return;
    }

    if (gestureTool.current === "eraser") {
      eraseAt(event);
      return;
    }

    if (!draftRef.current) return;

    const points = draftRef.current.points;

    if (points.length < 1000) {
      points.push(point(event));
      paint();
    }
  }

  function finish(event, save) {
    if (pointerRef.current !== event.pointerId) {
      return;
    }

    const stroke = draftRef.current;

    draftRef.current = null;
    pointerRef.current = null;

    paint();

    if (save && enabled) {
      if (gestureTool.current === "eraser" && erasedRef.current.size) {
        onErase([...erasedRef.current]);
      } else if (stroke) {
        onStroke(stroke);
      }
    }

    erasedRef.current.clear();
  }

  return (
    <section className="card stack">
      <div className="row spread">
        <h2>Whiteboard</h2>

        <div className="row" role="group" aria-label="Drawing tools">
          <button
            type="button"
            className="secondary"
            aria-pressed={tool === "pen"}
            onClick={() => setTool("pen")}
          >
            Pen
          </button>

          <button
            type="button"
            className="secondary"
            aria-pressed={tool === "eraser"}
            onClick={() => setTool("eraser")}
          >
            Eraser
          </button>

          <button
            type="button"
            className="secondary"
            disabled={!enabled || !strokes.length}
            onClick={() => onErase([strokes.at(-1).id])}
          >
            Erase last stroke
          </button>
        </div>

        <div className="row">
          <label className="row">
            Pen colour
            <input
              type="color"
              value={color}
              onChange={(event) => setColor(event.target.value)}
            />
          </label>

          <label>
            Pen width
            <select
              value={width}
              onChange={(event) => setWidth(Number(event.target.value))}
            >
              <option value={2}>Fine</option>
              <option value={4}>Medium</option>
              <option value={8}>Thick</option>
            </select>
          </label>
        </div>
      </div>

      <p className="muted">
        Pen adds a stroke. Eraser removes whole strokes you touch when you lift
        your finger. Erase last stroke also works with the keyboard.
      </p>

      <canvas
        className="board"
        ref={canvasRef}
        width={1200}
        height={750}
        aria-label="Shared drawing canvas; use chat to share board steps in text"
        aria-disabled={!enabled}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={(event) => finish(event, true)}
        onPointerCancel={(event) => finish(event, false)}
        onLostPointerCapture={(event) => finish(event, false)}
      >
        Your browser does not support the drawing canvas.
      </canvas>

      <button type="button" className="secondary" onClick={onShareSteps}>
        Share board steps in chat
      </button>
    </section>
  );
}

export default function Room({ groupId }) {
  const socketRef = useRef(null);
  const composerRef = useRef(null);
  const retryMessage = useRef(null);
  const pendingBoard = useRef(null);
  const focusComposer = useRef(false);

  const [boardBusy, setBoardBusy] = useState(false);
  const [boardFailed, setBoardFailed] = useState(false);
  const [boardStatus, setBoardStatus] = useState("");

  const [view, setView] = useState("Board");
  const [revision, setRevision] = useState(0);
  const [delivery, setDelivery] = useState("");

  const [connection, setConnection] = useState("Connecting…");
  const [joined, setJoined] = useState(false);

  const [messages, setMessages] = useState([]);
  const [strokes, setStrokes] = useState([]);
  const [members, setMembers] = useState([]);

  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (view === "Chat" && focusComposer.current) {
      composerRef.current?.focus();
      focusComposer.current = false;
    }
  }, [view]);

  useEffect(() => {
    const socket = io({
      autoConnect: false,
      timeout: 20000,
      withCredentials: true,
    });

    socketRef.current = socket;

    let active = true;
    let generation = 0;
    let syncing = true;
    let bufferedMessages = [];
    let bufferedStrokes = [];
    let latestMembers = null;

    socket.on("connect", async () => {
      const attempt = ++generation;

      syncing = true;
      bufferedMessages = [];
      bufferedStrokes = [];
      latestMembers = null;

      setJoined(false);
      setConnection("Restoring shared room…");
      setError("");

      try {
        const snapshot = await socket
          .timeout(20000)
          .emitWithAck("room:join", { groupId });

        if (!active || !socket.connected || attempt !== generation) {
          return;
        }

        if (!snapshot?.ok) {
          throw new Error(snapshot?.message || "Room access denied.");
        }

        setMessages(bufferedMessages.reduce(appendById, snapshot.messages));

        setStrokes(bufferedStrokes.reduce(applyBoardEvent, snapshot.strokes));

        setMembers(latestMembers ?? snapshot.members);

        syncing = false;
        setJoined(true);
        setConnection("Live");
      } catch (failure) {
        if (!active || attempt !== generation) {
          return;
        }

        setJoined(false);
        setConnection("Unable to join");
        setError(failure.message);
      }
    });

    socket.on("connect_error", (failure) => {
      setJoined(false);

      setConnection(
        socket.active ? "Unable to connect. Retrying…" : "Connection blocked",
      );

      setError(
        `${failure.message}. Check your connection. If you signed out, sign in again. If this persists, ask the group owner for help.`,
      );
    });

    socket.on("disconnect", () => {
      generation += 1;
      setJoined(false);

      setConnection(socket.active ? "Reconnecting…" : "Disconnected");
    });

    socket.on("chat:message", (item) => {
      if (syncing) {
        bufferedMessages.push(item);
      } else {
        setMessages((items) => appendById(items, item));
      }
    });

    socket.on("board:stroke", (stroke) => {
      if (syncing) {
        bufferedStrokes.push(stroke);
      } else {
        setStrokes((items) => applyBoardEvent(items, stroke));
      }
    });

    socket.on("board:erased", (item) => {
      if (syncing) {
        bufferedStrokes.push(item);
      } else {
        setStrokes((items) => applyBoardEvent(items, item));
      }
    });

    socket.on("room:presence", (people) => {
      if (syncing) {
        latestMembers = people;
      } else {
        setMembers(people);
      }
    });

    // Reload shared state after mobile background suspension.
    function resume() {
      if (document.visibilityState !== "visible" || !navigator.onLine) {
        return;
      }

      socket.disconnect();
      socket.connect();
    }

    function offline() {
      socket.disconnect();
      setJoined(false);

      setConnection("Offline — waiting for a connection");
    }

    document.addEventListener("visibilitychange", resume);

    window.addEventListener("online", resume);

    window.addEventListener("offline", offline);

    socket.connect();

    return () => {
      active = false;

      document.removeEventListener("visibilitychange", resume);

      window.removeEventListener("online", resume);

      window.removeEventListener("offline", offline);

      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [groupId, revision]);

  async function send(eventName, payload) {
    const socket = socketRef.current;

    if (!joined || !socket?.connected) {
      throw new Error("Reconnect to the room before sending.");
    }

    const response = await socket.timeout(20000).emitWithAck(eventName, {
      groupId,
      ...payload,
    });

    if (!response?.ok) {
      throw new Error(
        response?.message || "The room server rejected the update.",
      );
    }

    return response.item;
  }

  async function sendMessage(event) {
    event.preventDefault();

    const text = message.trim();
    if (!text || sending) return;

    const pending =
      retryMessage.current?.text === text
        ? retryMessage.current
        : {
            id: makeId(),
            text,
          };

    retryMessage.current = pending;

    setSending(true);
    setDelivery("Sending message…");
    setError("");

    try {
      const item = await send("chat:send", pending);

      setMessages((items) => appendById(items, item));

      retryMessage.current = null;

      setMessage((draft) => (draft.trim() === text ? "" : draft));

      setDelivery("Message delivered.");
    } catch (failure) {
      setDelivery(
        `Message unconfirmed. Submit the same draft to retry. ${failure.message}`,
      );
    } finally {
      setSending(false);
    }
  }

  async function saveBoard(eventName, payload) {
    if (boardBusy) return;

    pendingBoard.current = {
      eventName,
      payload,
    };

    setBoardBusy(true);
    setBoardFailed(false);
    setBoardStatus("Saving board change…");

    try {
      const item = await send(eventName, payload);

      setStrokes((items) => applyBoardEvent(items, item));

      pendingBoard.current = null;

      setBoardStatus("Board change saved.");
    } catch (failure) {
      setBoardFailed(true);

      setBoardStatus(
        `Change not confirmed. Reconnect if needed, then retry. ${failure.message}`,
      );
    } finally {
      setBoardBusy(false);
    }
  }

  function shareSteps() {
    setView("Chat");

    setMessage((draft) => draft || "Board step: ");

    if (view === "Chat") {
      composerRef.current?.focus();
    } else {
      focusComposer.current = true;
    }
  }

  return (
    <>
      <header className="row spread">
        <div className="stack">
          <Link to={`/groups/${groupId}`}>Back to group</Link>

          <h1>Live study room</h1>
        </div>

        <span
          className={`badge ${joined ? "room-live" : "room-waiting"}`}
          role="status"
        >
          {connection}
        </span>
      </header>

      {!joined && (
        <button
          type="button"
          className="secondary"
          onClick={() => {
            setConnection("Connecting…");

            setRevision((value) => value + 1);
          }}
        >
          Reconnect
        </button>
      )}

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      <p role="status" className="muted">
        {boardStatus}
      </p>

      {boardFailed && (
        <div className="row">
          <button
            type="button"
            disabled={!joined || boardBusy}
            onClick={() => {
              const pending = pendingBoard.current;

              if (pending) {
                saveBoard(pending.eventName, pending.payload);
              }
            }}
          >
            Retry board change
          </button>

          <button
            type="button"
            className="secondary"
            onClick={() => {
              pendingBoard.current = null;

              setBoardFailed(false);

              setBoardStatus(
                "Unconfirmed change dismissed. Reconnect to load the saved board.",
              );
            }}
          >
            Dismiss unconfirmed change
          </button>
        </div>
      )}

      <div className="row room-controls" role="group" aria-label="Room views">
        {["Board", "Chat", "People"].map((name) => (
          <button
            key={name}
            type="button"
            className="secondary"
            aria-pressed={view === name}
            onClick={() => setView(name)}
          >
            {name}
            {name === "People" && joined ? ` (${members.length})` : ""}
          </button>
        ))}
      </div>

      <div className={`room-layout room-view-${view.toLowerCase()}`}>
        <div className="room-board">
          <Whiteboard
            strokes={strokes}
            enabled={joined && !boardBusy && !boardFailed}
            onStroke={(stroke) => saveBoard("board:draw", { stroke })}
            onErase={(ids) => saveBoard("board:erase", { ids })}
            onShareSteps={shareSteps}
          />
        </div>

        {view === "People" && (
          <section className="card stack">
            <h2>People in this room</h2>

            {!joined ? (
              <p className="muted">Presence will update after reconnecting.</p>
            ) : members.length ? (
              <ul className="list">
                {members.map((member) => (
                  <li key={member.id}>{member.name}</li>
                ))}
              </ul>
            ) : (
              <p className="empty">No classmates are listed yet.</p>
            )}
          </section>
        )}

        {view === "Chat" && (
          <section className="card stack room-chat">
            <h2>Room chat</h2>

            <p className="muted">
              Share a board step in text so classmates can follow it here.
            </p>

            <ul
              className="messages stack"
              role="log"
              aria-label="Room messages"
              tabIndex={0}
            >
              {messages.map((item) => (
                <li key={item.id}>
                  <strong>{item.senderName}</strong>
                  <p>{item.text}</p>
                </li>
              ))}
            </ul>

            {!messages.length && <p className="empty">No messages yet.</p>}

            <form className="stack" onSubmit={sendMessage}>
              <label>
                Message
                <textarea
                  ref={composerRef}
                  rows={2}
                  value={message}
                  maxLength={1000}
                  onChange={(event) => setMessage(event.target.value)}
                />
              </label>

              <button disabled={!joined || sending || !message.trim()}>
                {sending ? "Sending…" : "Send message"}
              </button>
            </form>

            <p className="muted" role="status">
              {delivery}
            </p>
          </section>
        )}
      </div>
    </>
  );
}
