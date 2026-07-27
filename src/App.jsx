import { useState } from "react";
import { increment } from "./middle-end/core.js";

export default function App() {
    const [origin, setOrigin] = useState("");
    const [count, setCount] = useState(0);

    async function onClick() {
        const response = await increment({ value: count });
        setOrigin(response.origin);
        setCount(response.value);
    }

    // const onDragStart = (e) => {
    //     console.log(
    //         `Calling window.start_dragging with ${JSON.stringify({
    //             button: e.button,
    //             x: e.clientX,
    //             y: e.clientY,
    //             time: Date.now(),
    //         })}`,
    //     );
    //     window.start_dragging(
    //         JSON.stringify({
    //             button: e.button,
    //             x: e.clientX,
    //             y: e.clientY,
    //             time: Date.now(),
    //         }),
    //     );
    // };

    return (
        <div className={`app ${__PLATFORM__}`}>
            {/* {["windows", "linux", "macos"].includes(__PLATFORM__) && (
                <header className="titlebar" onMouseDown={onDragStart}>
                    <div className="title">CrossWebTemplate</div>

                    <div className="window-controls">
                        <button>−</button>
                        <button>□</button>
                        <button>✕</button>
                    </div>
                </header>
            )} */}
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
