<!-- 
import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";

const TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OGUyMTE2ODhiMDBkMWEyMWIxNzg4MzgiLCJyb2xlIjoidXNlciIsImlhdCI6MTc1OTY1OTc3NiwiZXhwIjoxNzYwMjY0NTc2fQ.Qfoa8s0leLgZHtuToLkmVT8HJdBpe3vx8dLg0Uic1Ag";
const WS_URL = "http://localhost:5000/game";

function emitAck(socket, event, payload, timeoutMs = 6000) {
  return new Promise((resolve, reject) => {
    let done = false;
    const t = setTimeout(() => {
      if (!done) {
        done = true;
        reject(new Error(`${event} timeout`));
      }
    }, timeoutMs);
    socket.emit(event, payload, (res) => {
      if (!done) {
        done = true;
        clearTimeout(t);
        resolve(res);
      }
    });
  });
}

function useSocket() {
  const ref = useRef(null);
  if (!ref.current) {
    ref.current = io(WS_URL, {
      auth: TOKEN ? { token: TOKEN } : undefined,
      transports: ["polling", "websocket"],
      withCredentials: false
    });
  }
  useEffect(() => {
    const s = ref.current;
    const onErr = (e) => console.log("connect_error:", e?.message || e);
    s.on("connect_error", onErr);
    return () => s.off("connect_error", onErr);
  }, []);
  return ref.current;
}

export default function App() {
  const socket = useSocket();
  const [round, setRound] = useState(null);
  const [balance, setBalance] = useState(0);
  const [amount, setAmount] = useState(500);
  const [sid, setSid] = useState(null);
  const [log, setLog] = useState([]);

  const addLog = (x) => setLog((p) => [...p.slice(-200), `[${new Date().toLocaleTimeString()}] ${x}`]);

  useEffect(() => {
    if (!socket) return;
    const onConnect = () => {
      setSid(socket.id);
      socket.emit("join", { room: "table:alpha" }, () => {});
      socket.emit("get_balance", {}, (res) => {
        if (res?.success) setBalance(res.balance);
      });
      addLog("connected");
    };
    const onDisconnect = (r) => {
      setSid(null);
      addLog(`disconnect: ${r}`);
    };
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
    };
  }, [socket]);

  useEffect(() => {
    if (!socket) return;
    const onStart = (d) => { setRound({ ...d, status: "OPEN" }); addLog(`roundStarted #${d.roundNumber}`); };
    const onClosed = (d) => { setRound((p) => p ? ({ ...p, ...d, status: "CLOSED" }) : d); addLog(`roundClosed #${d.roundNumber}`); };
    const onWinner = (d) => { setRound((p) => p ? ({ ...p, winningBox: d.winnerBox }) : p); addLog(`winnerRevealed ${d.winnerBox}`); };
    const onEnded = (d) => { setRound((p) => p ? ({ ...p, status: "SETTLED" }) : p); addLog(`roundEnded #${d.roundNumber}`); };
    const onAccepted = ({ bet }) => { setBalance((b) => Math.max(0, b - (bet?.amount || 0))); addLog(`bet_accepted ${bet.box}/${bet.amount}`); };
    const onBalance = ({ balance }) => { if (typeof balance === "number") setBalance(balance); addLog(`balance:update ${balance}`); };
    const onBetErr = (res) => addLog(`bet_error ${JSON.stringify(res)}`);

    socket.on("roundStarted", onStart);
    socket.on("roundClosed", onClosed);
    socket.on("winnerRevealed", onWinner);
    socket.on("roundEnded", onEnded);
    socket.on("bet_accepted", onAccepted);
    socket.on("balance:update", onBalance);
    socket.on("bet_error", onBetErr);

    return () => {
      socket.off("roundStarted", onStart);
      socket.off("roundClosed", onClosed);
      socket.off("winnerRevealed", onWinner);
      socket.off("roundEnded", onEnded);
      socket.off("bet_accepted", onAccepted);
      socket.off("balance:update", onBalance);
      socket.off("bet_error", onBetErr);
    };
  }, [socket]);

  async function refreshBalance() {
    const res = await emitAck(socket, "get_balance", {});
    if (res?.success) setBalance(res.balance);
    addLog(`get_balance → ${JSON.stringify(res)}`);
  }

  async function place(box) {
    if (!round || round.status !== "OPEN") return;
    if (!round._id) return addLog("no round _id");
    const amt = Math.max(500, Number(amount) || 0);
    const res = await emitAck(socket, "place_bet", { roundId: round._id, box, amount: amt });
    if (!res?.success && typeof res?.balance === "number") setBalance(res.balance);
    addLog(`place_bet → ${JSON.stringify(res)}`);
  }

  if (!round) {
    return <div style={{minHeight: "100vh", display:"grid", placeItems:"center", background:"#111", color:"#fff"}}>
      <div>SID: {sid || "-"}</div>
      <div style={{opacity:.8}}>Waiting for round…</div>
    </div>;
  }

  return (
    <div style={{padding:16, color:"#e6eef8", background:"#0b0f14", minHeight:"100vh"}}>
      <header style={{display:"flex", justifyContent:"space-between", marginBottom:12}}>
        <div>
          <div style={{fontWeight:600}}>Round #{round.roundNumber} — {round.status}</div>
          {round.winningBox && <div style={{color:"#ffd54a"}}>Winner: {round.winningBox}</div>}
        </div>
        <div style={{display:"flex", gap:8, alignItems:"center"}}>
          <span>Balance: {balance}</span>
          <button onClick={refreshBalance} style={btn}>Refresh</button>
        </div>
      </header>

      <div style={{display:"flex", gap:8, alignItems:"center", marginBottom:12}}>
        <label style={{opacity:.8}}>Amount</label>
        <input type="number" min={1} step={1} value={amount}
          onChange={e=>setAmount(Math.max(0, Number(e.target.value)||0))}
          style={input}/>
        <div style={{display:"flex", gap:6}}>
          {[500,1000,2000,5000,10000].map(v=> <button key={v} style={chip} onClick={()=>setAmount(v)}>{v}</button>)}
        </div>
      </div>

      <div style={{display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:8}}>
        {(round.boxes||[]).map((b,i)=>{
          const label = typeof b==="string" ? b : b.title;
          const mult = typeof b==="string" ? "" : b.multiplier ? ` (${b.multiplier}x)` : "";
          return <button key={`${label}-${i}`} style={btn} onClick={()=>place(label)}>Bet {label}{mult}</button>;
        })}
      </div>

      <div style={{marginTop:12, fontFamily:"ui-monospace,monospace", fontSize:12, opacity:.9, maxHeight:260, overflow:"auto"}}>
        {log.map((L,i)=><div key={i}>{L}</div>)}
      </div>
    </div>
  );
}

const btn   = { background:"#121821", color:"#e6eef8", border:"1px solid #2a3a52", borderRadius:8, padding:"8px 12px", cursor:"pointer" };
const input = { background:"#121821", color:"#e6eef8", border:"1px solid #223044", borderRadius:8, padding:"8px 10px", width:120 };
const chip  = { background:"#0f141b", color:"#e6eef8", border:"1px solid #223044", borderRadius:999, padding:"6px 10px", cursor:"pointer" }; -->
