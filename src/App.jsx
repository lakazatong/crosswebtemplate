import { useState } from "react";
import { increment } from "./middle-end/core.js";

export default function App() {
    const [origin, setOrigin] = useState("");
    const [count, setCount] = useState(0);

    async function onClick() {
        const response = await increment({ value: count });
        if (response.error) {
            console.error("increment error:", response.error);
            return;
        }
        setOrigin(response.origin);
        setCount(response.value);
    }

    const onDragStart = () => {
        window.start_dragging("");
    };

    return (
        <div className={`app ${__PLATFORM__}`}>
            {__PLATFORM__ === "desktop" && (
                <header className="titlebar" onMouseDown={onDragStart}>
                    <div className="title">CrossWebTemplate</div>

                    <div className="window-controls">
                        <button>−</button>
                        <button>□</button>
                        <button>✕</button>
                    </div>
                </header>
            )}
            <main className="screen">
                <p className="value">
                    {origin}
                    {count}
                </p>

                <button className="button" type="button" onClick={onClick}>
                    Increment
                </button>
            </main>
        </div>
    );
}
