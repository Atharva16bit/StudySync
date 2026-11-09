import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { io } from "socket.io-client";

function appendById(items, item) {
  return items.some((existing) => existing.id === item.id)
    ? items
    : [...items, item];
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

function Whiteboard({ strokes, enabled, onStroke }) {
  const canvasRef = useRef(null);
  const pointerRef = useRef(null);
  const draftRef = useRef(null);
  const [color, setColor] = useState("#4f46e5");

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

  function start(event) {
    if (!enabled || event.button !== 0 || pointerRef.current !== null) return;

    event.currentTarget.setPointerCapture(event.pointerId);
    pointerRef.current = event.pointerId;
    draftRef.current = {
      id: crypto.randomUUID(),
      color,
      width: 4,
      points: [point(event)],
    };
    paint();
  }

  function move(event) {
    if (pointerRef.current !== event.pointerId || !draftRef.current) return;

    const points = draftRef.current.points;
    if (points.length < 1000) {
      points.push(point(event));
      paint();
    }
  }

  function finish(event, save) {
    if (pointerRef.current !== event.pointerId) return;

    const stroke = draftRef.current;
    draftRef.current = null;
    pointerRef.current = null;
    paint();

    if (save && enabled && stroke) onStroke(stroke);
  }

  return (
    <section className="card stack">
      <div className="row spread">
        <h2>Whiteboard</h2>
        <label className="row">
          Pen colour
          <input
            type="color"
            value={color}
            onChange={(event) => setColor(event.target.value)}
          />
        </label>
      </div>
      <p className="muted">
        Draw with a mouse or touch. Your stroke syncs when you lift the pen.
      </p>
      <canvas
        className="board"
        ref={canvasRef}
        width={1200}
        height={750}
        aria-label="Shared drawing canvas"
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={(event) => finish(event, true)}
        onPointerCancel={(event) => finish(event, false)}
        onLostPointerCapture={(event) => finish(event, false)}
      >
        Your browser does not support the drawing canvas.
      </canvas>
    </section>
  );
}

export default function Room({ groupId }) {
  const socketRef = useRef(null);
  const [connection, setConnection] = useState("Connecting…");
  const [joined, setJoined] = useState(false);
  const [messages, setMessages] = useState([]);
  const [strokes, setStrokes] = useState([]);
  const [members, setMembers] = useState([]);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const socket = io({ autoConnect: false });
    socketRef.current = socket;
    let active = true;

    socket.on("connect", async () => {
      setConnection("Joining room…");
      setError("");

      try {
        const snapshot = await socket
          .timeout(5000)
          .emitWithAck("room:join", { groupId });
        if (!active || !socket.connected) return;
        if (!snapshot?.ok)
          throw new Error(snapshot?.message || "Room access denied.");

        setMessages(snapshot.messages);
        setStrokes(snapshot.strokes);
        setMembers(snapshot.members);
        setJoined(true);
        setConnection("Live");
      } catch (failure) {
        if (!active) return;
        setJoined(false);
        setConnection("Unable to join");
        setError(failure.message);
      }
    });

    socket.on("connect_error", () => {
      setJoined(false);
      setConnection("Room server unavailable");
    });

    socket.on("disconnect", () => {
      setJoined(false);
      setConnection("Disconnected");
    });

    socket.on("chat:message", (item) =>
      setMessages((items) => appendById(items, item)),
    );
    socket.on("board:stroke", (stroke) =>
      setStrokes((items) => appendById(items, stroke)),
    );
    socket.on("room:presence", setMembers);

    socket.connect();

    return () => {
      active = false;
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [groupId]);

  async function send(eventName, payload) {
    const socket = socketRef.current;

    if (!joined || !socket?.connected) {
      throw new Error("Reconnect to the room before sending.");
    }

    const response = await socket
      .timeout(5000)
      .emitWithAck(eventName, { groupId, ...payload });

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

    setSending(true);
    setError("");

    try {
      const item = await send("chat:send", { id: crypto.randomUUID(), text });
      setMessages((items) => appendById(items, item));
      setMessage("");
    } catch (failure) {
      setError(`Message could not be confirmed. ${failure.message}`);
    } finally {
      setSending(false);
    }
  }

  async function saveStroke(stroke) {
    setError("");

    try {
      const item = await send("board:draw", { stroke });
      setStrokes((items) => appendById(items, item));
    } catch (failure) {
      setError(`Stroke could not be confirmed. ${failure.message}`);
    }
  }

  return (
    <>
      <div className="row spread">
        <Link to={`/groups/${groupId}`}>← Leave room</Link>
        <span className="badge" role="status">
          {connection}
        </span>
      </div>
      <h1>Live study room</h1>

      {!joined && (
        <button className="secondary" onClick={() => window.location.reload()}>
          Reconnect
        </button>
      )}

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      <div className="room-layout">
        <Whiteboard strokes={strokes} enabled={joined} onStroke={saveStroke} />

        <section className="card stack">
          <h2>Room chat</h2>
          <p className="muted">
            {members.length
              ? `Online · ${members.map((member) => member.name).join(", ")}`
              : "No online members listed."}
          </p>

          <ul className="messages stack" role="log" aria-label="Room messages">
            {messages.map((item) => (
              <li key={item.id}>
                <strong>{item.senderName}</strong>
                <p>{item.text}</p>
              </li>
            ))}
          </ul>

          <form className="stack" onSubmit={sendMessage}>
            <label>
              Message
              <input
                value={message}
                maxLength={1000}
                disabled={!joined || sending}
                onChange={(event) => setMessage(event.target.value)}
              />
            </label>
            <button disabled={!joined || sending || !message.trim()}>
              {sending ? "Sending…" : "Send message"}
            </button>
          </form>
        </section>
      </div>
    </>
  );
}
