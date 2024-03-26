import express from "express";
import { BASE_NODE_PORT } from "../config";
import { NodeState, Value } from "../types";
import { delay } from "../utils";

export async function node(
    nodeId: number,
    N: number,
    F: number,
    initialValue: Value,
    isFaulty: boolean,
    nodesAreReady: () => boolean,
    setNodeIsReady: (index: number) => void) {const node = express();node.use(express.json());
  let cur: NodeState = { killed: false, x: null, decided: null, k: null };
  let tries = new Map<number, Value[]>();
  let thepeoplevoice = new Map<number, Value[]>();

  node.get("/status", (req, res) => res.status(isFaulty ? 500 : 200).send(isFaulty ? "faulty" : "live"));
  node.get("/getState", (req, res) => res.status(200).send(cur));
  node.get("/stop", (req, res) => {
    cur.killed = true;
    res.status(200).send("killed");});
  node.post("/message", async (req, res) => {
    let { k, x, messageType } = req.body;
    if (!isFaulty && !cur.killed) {
      if (messageType == "propose") {
        if (!tries.has(k)) {
          tries.set(k, []);}
        tries.get(k)!.push(x);
        let essay = tries.get(k)!;
        if (essay.length >= (N - F)) {
          let fcnt = essay.filter((el)=> el==0).length;
          let fcntsec = essay.filter((el)=> el== 1).length;
          if (fcnt>(N/2)){x = 0;} else if (fcntsec > (N / 2)) {x = 1;} else {x="?";}
          for (let i = 0; i < N; i++) {
            fetch(`http://localhost:${BASE_NODE_PORT + i}/message`, {
              method: 'POST',
              headers: {'Content-Type': 'application/json',},
              body: JSON.stringify({ k: k, x: x, messageType: "Thevoice" }),});}
        }
      }
      else if (messageType == "Thevoice") {
        if (!thepeoplevoice.has(k)) {thepeoplevoice.set(k, []);}
        thepeoplevoice.get(k)!.push(x)
        let Thevoice = thepeoplevoice.get(k)!;
        if (Thevoice.length >= (N - F)) {
          let fcnt = Thevoice.filter((el) => el == 0).length;
          let fcntsec = Thevoice.filter((el) => el == 1).length;
          if (fcnt >= F + 1) {cur.x = 0;
            cur.decided = true;} else if (fcntsec >= F + 1) {
            cur.x = 1;
            cur.decided = true;} else {
            if (fcnt + fcntsec > 0 && fcnt > fcntsec) {
              cur.x = 0;} else if (fcnt + fcntsec > 0 && fcnt < fcntsec) {
              cur.x = 1;} else {
              cur.x = Math.random() > 0.5 ? 0 : 1;}
            cur.k = k + 1;
            for (let i = 0; i < N; i++) {
              fetch(`http://localhost:${BASE_NODE_PORT + i}/message`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json',},
                body: JSON.stringify({k: cur.k, x: cur.x, messageType: "propose"}),});}
          }
        }
      }
    }
    res.status(200).send("Message received and processed.");
  });
  node.get("/start", async (req, res) => {
    while (!nodesAreReady()) await delay(5);
    if (!isFaulty) {
      cur = { killed: false, x: initialValue, decided: false, k: 1 };
      for (let i = 0; i < N; i++) {
        fetch(`http://localhost:${BASE_NODE_PORT + i}/message`, {method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ k: cur.k, x: cur.x, messageType: "propose" }),});}
    } else {cur = { killed: false, x: null, decided: null, k: null };}
    res.status(200).send("Consensus algorithm started.");});

  const server = node.listen(BASE_NODE_PORT + nodeId, () => {
    console.log(`Node ${nodeId} is listening on port ${BASE_NODE_PORT + nodeId}`);
    setNodeIsReady(nodeId);});
  return server;
}