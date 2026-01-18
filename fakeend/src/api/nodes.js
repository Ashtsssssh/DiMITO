export async function fetchNodes() {
  const res = await fetch("http://localhost:8000/api/nodes/");
  return res.json();
}

export async function createNode(payload) {
  const res = await fetch("http://localhost:8000/api/node/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return res.json();
}
