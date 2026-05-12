import { useState } from "react";
import { increment } from "./bridge.js";

export default function App() {
    const [origin, setOrigin] = useState("");
    const [count, setCount] = useState(0);

    async function onClick() {
        const response = await increment({ value: count });
        setOrigin(response.origin);
        setCount(response.value);
    }

    return (
        <main className="screen">
            <p className="value">
                {origin}
                {count}
            </p>
            <button className="button" type="button" onClick={onClick}>
                Increment
            </button>
        </main>
    );
}
