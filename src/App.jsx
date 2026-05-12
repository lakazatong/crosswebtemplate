import { useState } from "react";
import { increment } from "./bridge.js";

export default function App() {
  const [count, setCount] = useState(0);

  async function onClick() {
    const response = await increment(JSON.stringify({ data: count }));
    setCount(JSON.parse(response).data);
  }

  return (
    <main className="screen">
      <p className="value">{count}</p>
      <button className="button" type="button" onClick={onClick}>
        Increment
      </button>
    </main>
  );
}
