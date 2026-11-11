import { useState } from "react";
import { zigExport, increment, sleep } from "./core.js";

export default function App() {
    const [origin, setOrigin] = useState("");
    const [count, setCount] = useState(0);

    async function onClick() {
        console.log("allocs: ", await zigExport("alloc_count"));
        console.log("frees: ", await zigExport("free_count"));
        // await increment({ value: count });
        // const responses = await Promise.all([
        //     increment({ value: count }),
        //     increment({ value: count + 1 }),
        //     increment({ value: count + 2 }),
        //     increment({ value: count + 3 }),
        //     increment({ value: count + 4 }),
        //     increment({ value: count + 5 }),
        //     increment({ value: count + 6 }),
        // ]);
        console.time("sequential");

        await sleep();
        await sleep();

        console.timeEnd("sequential");

        console.time("parallel");
        const responses = await Promise.all([
            sleep(),
            sleep(),
        ]);
        console.timeEnd("parallel");

        console.log(responses);

        const successful = responses.filter((response) => response.code === 0);

        if (successful.length === 0) {
            console.log("all failed");
            return;
        }

        const best = successful.reduce((a, b) => (b.value > a.value ? b : a));

        setOrigin(best.origin);
        setCount(best.value);
        console.log("allocs: ", await zigExport("alloc_count"));
        console.log("frees: ", await zigExport("free_count"));
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
                    From {origin}: {count}
                </p>

                <button className="button" type="button" onClick={onClick}>
                    Increment
                </button>
            </main>
        </div>
    );
}
